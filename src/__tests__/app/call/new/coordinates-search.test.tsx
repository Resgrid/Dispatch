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

// Coordinates search logic extracted for testing
const performCoordinatesSearch = async (
  coordinates: string,
  config: GetConfigResultData | null
): Promise<{
  success: boolean;
  result?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  error?: string;
}> => {
  if (!coordinates.trim()) {
    return { success: false, error: 'Coordinates are required' };
  }

  // Parse coordinates - expect format like "40.7128, -74.0060" or "40.7128,-74.0060"
  const coordRegex = /^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/;
  const match = coordinates.trim().match(coordRegex);

  if (!match) {
    return { success: false, error: 'Invalid coordinates format' };
  }

  const latitude = parseFloat(match[1]);
  const longitude = parseFloat(match[2]);

  // Validate coordinate ranges
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { success: false, error: 'Coordinates out of range' };
  }

  try {
    // Get Google Maps API key from CoreStore config
    const apiKey = config?.GoogleMapsKey;

    if (!apiKey) {
      // Still set location even without API key, just no address
      return {
        success: true,
        result: {
          latitude,
          longitude,
        },
      };
    }

    // Make request to Google Maps Reverse Geocoding API
    const response = await axios.get<GeocodingResponse>(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`);

    const result = {
      latitude,
      longitude,
      address: response.data.status === 'OK' && response.data.results.length > 0 ? response.data.results[0].formatted_address : undefined,
    };

    return { success: true, result };
  } catch (error) {
    // Even if geocoding fails, still set the location on the map
    return {
      success: true,
      result: {
        latitude,
        longitude,
      },
    };
  }
};

describe('Coordinates Search Logic', () => {
  const mockGeocodingResponse: GeocodingResponse = {
    status: 'OK',
    results: [
      {
        formatted_address: 'Times Square, New York, NY 10036, USA',
        geometry: {
          location: {
            lat: 40.7128,
            lng: -74.0060,
          },
        },
        place_id: 'ChIJmQJIxlVYwokRLgeuocVOGVU',
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
    mockedAxios.get.mockResolvedValue({ data: mockGeocodingResponse });
  });

  describe('Input Validation', () => {
    it('should reject empty coordinates string', async () => {
      const result = await performCoordinatesSearch('', mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Coordinates are required');
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only coordinates string', async () => {
      const result = await performCoordinatesSearch('   ', mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Coordinates are required');
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should reject invalid coordinate format', async () => {
      const invalidFormats = [
        'not coordinates',
        '40.7128',
        'lat,lng',
        '40.7128, not-a-number',
        'abc, 123',
        '40.7128, -74.0060, 123',
      ];

      for (const format of invalidFormats) {
        const result = await performCoordinatesSearch(format, mockConfig);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid coordinates format');
        expect(mockedAxios.get).not.toHaveBeenCalled();
      }
    });

    it('should reject coordinates out of range', async () => {
      const outOfRangeCoords = [
        '91.0, 0.0', // latitude too high
        '-91.0, 0.0', // latitude too low
        '0.0, 181.0', // longitude too high
        '0.0, -181.0', // longitude too low
        '91.0, 181.0', // both out of range
      ];

      for (const coords of outOfRangeCoords) {
        const result = await performCoordinatesSearch(coords, mockConfig);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Coordinates out of range');
        expect(mockedAxios.get).not.toHaveBeenCalled();
      }
    });

    it('should accept valid coordinate formats', async () => {
      const validFormats = [
        '40.7128, -74.0060',
        '40.7128,-74.0060',
        '40.7128 -74.0060',
        '-40.7128, -74.0060',
        '0, 0',
        '90, 180',
        '-90, -180',
      ];

      for (const format of validFormats) {
        const result = await performCoordinatesSearch(format, mockConfig);

        expect(result.success).toBe(true);
        expect(result.result).toBeDefined();
      }
    });
  });

  describe('Coordinate Parsing', () => {
    it('should parse coordinates with various decimal places', async () => {
      const testCases = [
        { input: '40.7128, -74.0060', expectedLat: 40.7128, expectedLng: -74.0060 },
        { input: '40.71280123456789, -74.00600987654321', expectedLat: 40.71280123456789, expectedLng: -74.00600987654321 },
        { input: '40, -74', expectedLat: 40, expectedLng: -74 },
        { input: '40.0, -74.0', expectedLat: 40.0, expectedLng: -74.0 },
      ];

      for (const testCase of testCases) {
        const result = await performCoordinatesSearch(testCase.input, mockConfig);

        expect(result.success).toBe(true);
        expect(result.result?.latitude).toBe(testCase.expectedLat);
        expect(result.result?.longitude).toBe(testCase.expectedLng);
      }
    });

    it('should handle negative coordinates correctly', async () => {
      const result = await performCoordinatesSearch('-40.7128, -74.0060', mockConfig);

      expect(result.success).toBe(true);
      expect(result.result?.latitude).toBe(-40.7128);
      expect(result.result?.longitude).toBe(-74.0060);
    });

    it('should handle boundary coordinate values', async () => {
      const boundaryTests = [
        { input: '90, 180', expectedLat: 90, expectedLng: 180 },
        { input: '-90, -180', expectedLat: -90, expectedLng: -180 },
        { input: '0, 0', expectedLat: 0, expectedLng: 0 },
      ];

      for (const test of boundaryTests) {
        const result = await performCoordinatesSearch(test.input, mockConfig);

        expect(result.success).toBe(true);
        expect(result.result?.latitude).toBe(test.expectedLat);
        expect(result.result?.longitude).toBe(test.expectedLng);
      }
    });
  });

  describe('API Configuration', () => {
    it('should handle missing API key gracefully', async () => {
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

      const result = await performCoordinatesSearch('40.7128, -74.0060', configWithoutKey);

      expect(result.success).toBe(true);
      expect(result.result?.latitude).toBe(40.7128);
      expect(result.result?.longitude).toBe(-74.0060);
      expect(result.result?.address).toBeUndefined();
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should handle null config gracefully', async () => {
      const result = await performCoordinatesSearch('40.7128, -74.0060', null);

      expect(result.success).toBe(true);
      expect(result.result?.latitude).toBe(40.7128);
      expect(result.result?.longitude).toBe(-74.0060);
      expect(result.result?.address).toBeUndefined();
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should use correct API endpoint and parameters', async () => {
      await performCoordinatesSearch('40.7128, -74.006', mockConfig);

      expect(mockedAxios.get).toHaveBeenCalledWith('https://maps.googleapis.com/maps/api/geocode/json?latlng=40.7128,-74.006&key=test-api-key');
    });
  });

  describe('Reverse Geocoding Results', () => {
    it('should handle successful reverse geocoding', async () => {
      const result = await performCoordinatesSearch('40.7128, -74.0060', mockConfig);

      expect(result.success).toBe(true);
      expect(result.result?.latitude).toBe(40.7128);
      expect(result.result?.longitude).toBe(-74.0060);
      expect(result.result?.address).toBe('Times Square, New York, NY 10036, USA');
    });

    it('should handle no results from reverse geocoding API', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { status: 'ZERO_RESULTS', results: [] },
      });

      const result = await performCoordinatesSearch('40.7128, -74.0060', mockConfig);

      expect(result.success).toBe(true);
      expect(result.result?.latitude).toBe(40.7128);
      expect(result.result?.longitude).toBe(-74.0060);
      expect(result.result?.address).toBeUndefined();
    });

    it('should handle invalid status from reverse geocoding API', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { status: 'INVALID_REQUEST', results: [] },
      });

      const result = await performCoordinatesSearch('40.7128, -74.0060', mockConfig);

      expect(result.success).toBe(true);
      expect(result.result?.latitude).toBe(40.7128);
      expect(result.result?.longitude).toBe(-74.0060);
      expect(result.result?.address).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network Error'));

      const result = await performCoordinatesSearch('40.7128, -74.0060', mockConfig);

      expect(result.success).toBe(true);
      expect(result.result?.latitude).toBe(40.7128);
      expect(result.result?.longitude).toBe(-74.0060);
      expect(result.result?.address).toBeUndefined();
    });

    it('should handle API timeout errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('timeout'));

      const result = await performCoordinatesSearch('40.7128, -74.0060', mockConfig);

      expect(result.success).toBe(true);
      expect(result.result?.latitude).toBe(40.7128);
      expect(result.result?.longitude).toBe(-74.0060);
      expect(result.result?.address).toBeUndefined();
    });

    it('should handle API rate limit errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Rate limit exceeded'));

      const result = await performCoordinatesSearch('40.7128, -74.0060', mockConfig);

      expect(result.success).toBe(true);
      expect(result.result?.latitude).toBe(40.7128);
      expect(result.result?.longitude).toBe(-74.0060);
      expect(result.result?.address).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle coordinates with extreme precision', async () => {
      const veryPreciseCoords = '40.71280123456789123456789, -74.00600987654321987654321';
      const result = await performCoordinatesSearch(veryPreciseCoords, mockConfig);

      expect(result.success).toBe(true);
      expect(result.result?.latitude).toBeCloseTo(40.71280123456789, 10);
      expect(result.result?.longitude).toBeCloseTo(-74.00600987654321, 10);
    });

    it('should handle coordinates with no decimal places', async () => {
      const result = await performCoordinatesSearch('40, -74', mockConfig);

      expect(result.success).toBe(true);
      expect(result.result?.latitude).toBe(40);
      expect(result.result?.longitude).toBe(-74);
    });

    it('should handle coordinates with mixed spacing', async () => {
      const spacingVariations = [
        '40.7128, -74.0060',
        '40.7128,-74.0060',
        '40.7128 , -74.0060',
        '40.7128   ,   -74.0060',
      ];

      for (const variation of spacingVariations) {
        const result = await performCoordinatesSearch(variation, mockConfig);

        expect(result.success).toBe(true);
        expect(result.result?.latitude).toBe(40.7128);
        expect(result.result?.longitude).toBe(-74.0060);
      }
    });
  });
}); 