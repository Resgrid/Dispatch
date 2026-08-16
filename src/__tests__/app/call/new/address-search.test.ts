import axios from 'axios';
import { type GetConfigResultData } from '@/models/v4/configs/getConfigResultData';

// Mock axios
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

// Address search logic extracted for testing
const performAddressSearch = async (
  address: string,
  config: GetConfigResultData | null
): Promise<{
  success: boolean;
  results?: GeocodingResult[];
  error?: string;
}> => {
  if (!address.trim()) {
    return { success: false, error: 'Address is required' };
  }

  try {
    // Get Google Maps API key from CoreStore config
    const apiKey = config?.GoogleMapsKey;

    if (!apiKey) {
      return { success: false, error: 'Google Maps API key not configured' };
    }

    // Make request to Google Maps Geocoding API
    const response = await axios.get<GeocodingResponse>(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`);

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      return { success: true, results: response.data.results };
    } else {
      return { success: false, error: 'No results found' };
    }
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
};

describe('Address Search Logic', () => {
  const mockSingleGeocodingResult: GeocodingResponse = {
    status: 'OK',
    results: [
      {
        formatted_address: '123 Main St, New York, NY 10001, USA',
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

  const mockMultipleGeocodingResults: GeocodingResponse = {
    status: 'OK',
    results: [
      {
        formatted_address: '123 Main St, New York, NY 10001, USA',
        geometry: {
          location: {
            lat: 40.7128,
            lng: -74.006,
          },
        },
        place_id: 'ChIJOwg_06VPwokRYv534QaPC8g',
      },
      {
        formatted_address: '123 Main St, Brooklyn, NY 11201, USA',
        geometry: {
          location: {
            lat: 40.6892,
            lng: -73.9442,
          },
        },
        place_id: 'ChIJOwg_06VPwokRYv534QaPC8h',
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
    mockedAxios.get.mockResolvedValue({ data: mockSingleGeocodingResult });
  });

  describe('Input Validation', () => {
    it('should reject empty address string', async () => {
      const result = await performAddressSearch('', mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Address is required');
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only address string', async () => {
      const result = await performAddressSearch('   ', mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Address is required');
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

      const result = await performAddressSearch('123 Main St', configWithoutKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Google Maps API key not configured');
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should use correct API endpoint and parameters', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockSingleGeocodingResult });

      await performAddressSearch('123 Main St, New York', mockConfig);

      expect(mockedAxios.get).toHaveBeenCalledWith('https://maps.googleapis.com/maps/api/geocode/json?address=123%20Main%20St%2C%20New%20York&key=test-api-key');
    });
  });

  describe('Geocoding Results', () => {
    it('should handle single geocoding result', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockSingleGeocodingResult });

      const result = await performAddressSearch('123 Main St', mockConfig);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results![0].formatted_address).toBe('123 Main St, New York, NY 10001, USA');
      expect(result.results![0].geometry.location.lat).toBe(40.7128);
      expect(result.results![0].geometry.location.lng).toBe(-74.006);
    });

    it('should handle multiple geocoding results', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockMultipleGeocodingResults });

      const result = await performAddressSearch('123 Main St', mockConfig);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results![0].formatted_address).toBe('123 Main St, New York, NY 10001, USA');
      expect(result.results![1].formatted_address).toBe('123 Main St, Brooklyn, NY 11201, USA');
    });

    it('should handle no results from geocoding API', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { status: 'ZERO_RESULTS', results: [] },
      });

      const result = await performAddressSearch('NonExistentAddress', mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No results found');
    });

    it('should handle invalid status from geocoding API', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { status: 'INVALID_REQUEST', results: [] },
      });

      const result = await performAddressSearch('123 Main St', mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No results found');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network Error'));

      const result = await performAddressSearch('123 Main St', mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle API timeout errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('timeout'));

      const result = await performAddressSearch('123 Main St', mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle null config', async () => {
      const result = await performAddressSearch('123 Main St', null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Google Maps API key not configured');
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  describe('Address Encoding', () => {
    it('should properly encode special characters in addresses', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockSingleGeocodingResult });

      await performAddressSearch('123 Main St, New York & Brooklyn', mockConfig);

      expect(mockedAxios.get).toHaveBeenCalledWith('https://maps.googleapis.com/maps/api/geocode/json?address=123%20Main%20St%2C%20New%20York%20%26%20Brooklyn&key=test-api-key');
    });

    it('should handle addresses with unicode characters', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockSingleGeocodingResult });

      await performAddressSearch('123 Café Street, Montréal', mockConfig);

      expect(mockedAxios.get).toHaveBeenCalledWith('https://maps.googleapis.com/maps/api/geocode/json?address=123%20Caf%C3%A9%20Street%2C%20Montr%C3%A9al&key=test-api-key');
    });
  });

  describe('Data Structure Validation', () => {
    it('should validate geocoding result structure', async () => {
      const validResult = {
        formatted_address: '123 Main St, New York, NY 10001, USA',
        geometry: {
          location: {
            lat: 40.7128,
            lng: -74.006,
          },
        },
        place_id: 'ChIJOwg_06VPwokRYv534QaPC8g',
      };

      mockedAxios.get.mockResolvedValue({ data: { status: 'OK', results: [validResult] } });

      const result = await performAddressSearch('123 Main St', mockConfig);

      expect(result.success).toBe(true);
      expect(result.results![0]).toEqual(validResult);
      expect(result.results![0].geometry.location.lat).toBeDefined();
      expect(result.results![0].geometry.location.lng).toBeDefined();
      expect(result.results![0].formatted_address).toBeDefined();
    });
  });

  describe('Integration Flow', () => {
    it('should complete entire geocoding flow successfully', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockSingleGeocodingResult });

      // Test complete flow
      const result = await performAddressSearch('123 Main St, New York', mockConfig);

      // Verify API was called correctly
      expect(mockedAxios.get).toHaveBeenCalledWith('https://maps.googleapis.com/maps/api/geocode/json?address=123%20Main%20St%2C%20New%20York&key=test-api-key');

      // Verify result structure
      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.results![0].formatted_address).toBe('123 Main St, New York, NY 10001, USA');
      expect(result.results![0].geometry.location.lat).toBe(40.7128);
      expect(result.results![0].geometry.location.lng).toBe(-74.006);
      expect(result.results![0].place_id).toBeDefined();

      // Verify error is not present
      expect(result.error).toBeUndefined();
    });
  });
});
