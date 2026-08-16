import axios from 'axios';
import { type GetConfigResultData } from '@/models/v4/configs/getConfigResultData';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Google Maps Geocoding API response types
interface GeocodingResult {
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  place_id: string;
}

interface GeocodingResponse {
  results: GeocodingResult[];
  status: string;
}

// Plus code search logic extracted for testing
const performPlusCodeSearch = async (
  plusCode: string,
  config: GetConfigResultData | null
): Promise<{
  success: boolean;
  result?: GeocodingResult;
  error?: string;
}> => {
  if (!plusCode.trim()) {
    return { success: false, error: 'Plus code is required' };
  }

  try {
    // Get Google Maps API key from CoreStore config
    const apiKey = config?.GoogleMapsKey;

    if (!apiKey) {
      return { success: false, error: 'Google Maps API key not configured' };
    }

    // Make request to Google Maps Geocoding API
    const response = await axios.get<GeocodingResponse>(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(plusCode)}&key=${apiKey}`);

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      return { success: true, result: response.data.results[0] };
    } else {
      return { success: false, error: 'No results found' };
    }
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
};

describe('Plus Code Search Logic', () => {
  const mockPlusCodeGeocodingResult: GeocodingResponse = {
    status: 'OK',
    results: [
      {
        formatted_address: '1600 Amphitheatre Parkway, Mountain View, CA 94043, USA',
        geometry: {
          location: {
            lat: 37.4220936,
            lng: -122.083922,
          },
        },
        place_id: 'ChIJtYuu0V25j4ARwu5e4wwRYgE',
      },
    ],
  };

  // Mock config with API key
  const mockConfig: GetConfigResultData = {
    GoogleMapsKey: 'test-api-key',
    W3WKey: '',
    EventingUrl: '',
    LoggingKey: '',
    MapUrl: '',
    MapAttribution: '',
    OpenWeatherApiKey: '',
    DirectionsMapKey: '',
    PersonnelLocationStaleSeconds: 300,
    UnitLocationStaleSeconds: 300,
    PersonnelLocationMinMeters: 15,
    UnitLocationMinMeters: 15,
    NovuBackendApiUrl: '',
    NovuSocketUrl: '',
    NovuApplicationId: '',
    AnalyticsApiKey: '',
    AnalyticsHost: '',
    MapCenterLatitude: 0,
    MapCenterLongitude: 0,
    MapCenterZoomLevel: 9,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Set default successful axios response
    mockedAxios.get.mockResolvedValue({ data: mockPlusCodeGeocodingResult });
  });

  describe('Input Validation', () => {
    it('should reject empty plus code string', async () => {
      const result = await performPlusCodeSearch('', mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Plus code is required');
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only plus code string', async () => {
      const result = await performPlusCodeSearch('   ', mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Plus code is required');
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  describe('API Configuration', () => {
    it('should handle missing API key gracefully', async () => {
      // Mock config without API key
      const configWithoutKey: GetConfigResultData = {
        GoogleMapsKey: '',
        W3WKey: '',
        EventingUrl: '',
        LoggingKey: '',
        MapUrl: '',
        MapAttribution: '',
        OpenWeatherApiKey: '',
        DirectionsMapKey: '',
        PersonnelLocationStaleSeconds: 300,
        UnitLocationStaleSeconds: 300,
        PersonnelLocationMinMeters: 15,
        UnitLocationMinMeters: 15,
        NovuBackendApiUrl: '',
        NovuSocketUrl: '',
        NovuApplicationId: '',
        AnalyticsApiKey: '',
        AnalyticsHost: '',
        MapCenterLatitude: 0,
        MapCenterLongitude: 0,
        MapCenterZoomLevel: 9,
      };

      const result = await performPlusCodeSearch('849VCWC8+R9', configWithoutKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Google Maps API key not configured');
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should use correct API endpoint and parameters', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockPlusCodeGeocodingResult });

      await performPlusCodeSearch('849VCWC8+R9', mockConfig);

      expect(mockedAxios.get).toHaveBeenCalledWith('https://maps.googleapis.com/maps/api/geocode/json?address=849VCWC8%2BR9&key=test-api-key');
    });
  });

  describe('Plus Code Formats', () => {
    it('should handle full plus code with area code', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockPlusCodeGeocodingResult });

      const result = await performPlusCodeSearch('849VCWC8+R9', mockConfig);

      expect(result.success).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith('https://maps.googleapis.com/maps/api/geocode/json?address=849VCWC8%2BR9&key=test-api-key');
    });

    it('should handle short plus code (without area code)', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockPlusCodeGeocodingResult });

      const result = await performPlusCodeSearch('CWC8+R9', mockConfig);

      expect(result.success).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith('https://maps.googleapis.com/maps/api/geocode/json?address=CWC8%2BR9&key=test-api-key');
    });

    it('should handle plus code with city context', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockPlusCodeGeocodingResult });

      const result = await performPlusCodeSearch('CWC8+R9 Mountain View', mockConfig);

      expect(result.success).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith('https://maps.googleapis.com/maps/api/geocode/json?address=CWC8%2BR9%20Mountain%20View&key=test-api-key');
    });

    it('should handle plus code with special characters', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockPlusCodeGeocodingResult });

      const result = await performPlusCodeSearch('849VCWC8+R9 Mountain View, CA', mockConfig);

      expect(result.success).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith('https://maps.googleapis.com/maps/api/geocode/json?address=849VCWC8%2BR9%20Mountain%20View%2C%20CA&key=test-api-key');
    });
  });

  describe('Geocoding Results', () => {
    it('should handle successful geocoding result', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockPlusCodeGeocodingResult });

      const result = await performPlusCodeSearch('849VCWC8+R9', mockConfig);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result?.formatted_address).toBe('1600 Amphitheatre Parkway, Mountain View, CA 94043, USA');
      expect(result.result?.geometry.location.lat).toBe(37.4220936);
      expect(result.result?.geometry.location.lng).toBe(-122.083922);
    });

    it('should handle no results from geocoding API', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { status: 'ZERO_RESULTS', results: [] },
      });

      const result = await performPlusCodeSearch('INVALID+CODE', mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No results found');
    });

    it('should handle invalid status from geocoding API', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { status: 'INVALID_REQUEST', results: [] },
      });

      const result = await performPlusCodeSearch('849VCWC8+R9', mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No results found');
    });

    it('should handle REQUEST_DENIED status', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { status: 'REQUEST_DENIED', results: [] },
      });

      const result = await performPlusCodeSearch('849VCWC8+R9', mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No results found');
    });

    it('should handle OVER_QUERY_LIMIT status', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { status: 'OVER_QUERY_LIMIT', results: [] },
      });

      const result = await performPlusCodeSearch('849VCWC8+R9', mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No results found');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network Error'));

      const result = await performPlusCodeSearch('849VCWC8+R9', mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle API timeout errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('timeout'));

      const result = await performPlusCodeSearch('849VCWC8+R9', mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle null config', async () => {
      const result = await performPlusCodeSearch('849VCWC8+R9', null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Google Maps API key not configured');
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  describe('Plus Code Encoding', () => {
    it('should properly encode plus sign in plus codes', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockPlusCodeGeocodingResult });

      await performPlusCodeSearch('849VCWC8+R9', mockConfig);

      expect(mockedAxios.get).toHaveBeenCalledWith('https://maps.googleapis.com/maps/api/geocode/json?address=849VCWC8%2BR9&key=test-api-key');
    });

    it('should handle plus codes with spaces', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockPlusCodeGeocodingResult });

      await performPlusCodeSearch('849V CWC8+R9', mockConfig);

      expect(mockedAxios.get).toHaveBeenCalledWith('https://maps.googleapis.com/maps/api/geocode/json?address=849V%20CWC8%2BR9&key=test-api-key');
    });

    it('should handle plus codes with unicode characters', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockPlusCodeGeocodingResult });

      await performPlusCodeSearch('849VCWC8+R9 Montréal', mockConfig);

      expect(mockedAxios.get).toHaveBeenCalledWith('https://maps.googleapis.com/maps/api/geocode/json?address=849VCWC8%2BR9%20Montr%C3%A9al&key=test-api-key');
    });
  });

  describe('Data Structure Validation', () => {
    it('should validate geocoding result structure', async () => {
      const validResult = {
        formatted_address: '1600 Amphitheatre Parkway, Mountain View, CA 94043, USA',
        geometry: {
          location: {
            lat: 37.4220936,
            lng: -122.083922,
          },
        },
        place_id: 'ChIJtYuu0V25j4ARwu5e4wwRYgE',
      };

      mockedAxios.get.mockResolvedValue({ data: { status: 'OK', results: [validResult] } });

      const result = await performPlusCodeSearch('849VCWC8+R9', mockConfig);

      expect(result.success).toBe(true);
      expect(result.result).toEqual(validResult);
      expect(result.result?.geometry.location.lat).toBeDefined();
      expect(result.result?.geometry.location.lng).toBeDefined();
      expect(result.result?.formatted_address).toBeDefined();
    });
  });

  describe('Integration Flow', () => {
    it('should complete entire plus code geocoding flow successfully', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockPlusCodeGeocodingResult });

      // Test complete flow
      const result = await performPlusCodeSearch('849VCWC8+R9', mockConfig);

      // Verify API was called correctly
      expect(mockedAxios.get).toHaveBeenCalledWith('https://maps.googleapis.com/maps/api/geocode/json?address=849VCWC8%2BR9&key=test-api-key');

      // Verify result structure
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result?.formatted_address).toBe('1600 Amphitheatre Parkway, Mountain View, CA 94043, USA');
      expect(result.result?.geometry.location.lat).toBe(37.4220936);
      expect(result.result?.geometry.location.lng).toBe(-122.083922);
      expect(result.result?.place_id).toBeDefined();

      // Verify error is not present
      expect(result.error).toBeUndefined();
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent plus code searches', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockPlusCodeGeocodingResult });

      const promises = [performPlusCodeSearch('849VCWC8+R9', mockConfig), performPlusCodeSearch('CWC8+R9', mockConfig), performPlusCodeSearch('849VCWC8+R9 Mountain View', mockConfig)];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.result).toBeDefined();
      });
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });
  });

  describe('Real-world Plus Code Examples', () => {
    it('should handle Mountain View, CA plus code', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockPlusCodeGeocodingResult });

      const result = await performPlusCodeSearch('849VCWC8+R9', mockConfig);

      expect(result.success).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith('https://maps.googleapis.com/maps/api/geocode/json?address=849VCWC8%2BR9&key=test-api-key');
    });

    it('should handle New York City plus code', async () => {
      const nycResult: GeocodingResponse = {
        status: 'OK',
        results: [
          {
            formatted_address: 'New York, NY 10001, USA',
            geometry: {
              location: {
                lat: 40.7128,
                lng: -74.006,
              },
            },
            place_id: 'ChIJOwg_06VPwokRYv534QaPC8g',
          },
        ],
      };

      mockedAxios.get.mockResolvedValue({ data: nycResult });

      const result = await performPlusCodeSearch('87G8Q23X+GF', mockConfig);

      expect(result.success).toBe(true);
      expect(result.result?.geometry.location.lat).toBe(40.7128);
      expect(result.result?.geometry.location.lng).toBe(-74.006);
    });

    it('should handle London, UK plus code', async () => {
      const londonResult: GeocodingResponse = {
        status: 'OK',
        results: [
          {
            formatted_address: 'London, UK',
            geometry: {
              location: {
                lat: 51.5074,
                lng: -0.1278,
              },
            },
            place_id: 'ChIJdd4hrwug2EcRmSrV3Vo6llI',
          },
        ],
      };

      mockedAxios.get.mockResolvedValue({ data: londonResult });

      const result = await performPlusCodeSearch('9C3XGV6C+R5', mockConfig);

      expect(result.success).toBe(true);
      expect(result.result?.geometry.location.lat).toBe(51.5074);
      expect(result.result?.geometry.location.lng).toBe(-0.1278);
    });
  });
});
