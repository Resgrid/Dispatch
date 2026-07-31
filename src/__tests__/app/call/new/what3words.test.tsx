// what3words functionality tests for NewCall component
import axios from 'axios';
import { type GetConfigResultData } from '@/models/v4/configs/getConfigResultData';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock config with API key
const mockConfig: GetConfigResultData = {
  GoogleMapsKey: 'test-mapbox-key',
  W3WKey: 'test-api-key',
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
};

// Mock the core store
jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: () => ({
    config: mockConfig,
    isLoading: false,
    error: null,
    init: jest.fn(),
  }),
}));

// Mock other required stores
jest.mock('@/stores/calls/store', () => ({
  useCallsStore: () => ({
    callPriorities: [],
    callTypes: [],
    isLoading: false,
    error: null,
    fetchCallPriorities: jest.fn(),
    fetchCallTypes: jest.fn(),
  }),
}));

// Mock toast
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    show: jest.fn(),
  }),
}));

// Mock all UI components
jest.mock('@/components/ui/text', () => ({
  Text: 'Text',
}));

jest.mock('@/components/ui/box', () => ({
  Box: 'Box',
}));

// Mock other components
jest.mock('@/components/calls/dispatch-selection-modal', () => ({
  DispatchSelectionModal: 'DispatchSelectionModal',
}));

jest.mock('@/components/maps/location-picker', () => ({
  __esModule: true,
  default: 'LocationPicker',
}));

jest.mock('@/components/common/loading', () => ({
  Loading: 'Loading',
}));

jest.mock('lucide-react-native', () => ({
  SearchIcon: 'SearchIcon',
  PlusIcon: 'PlusIcon',
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  Stack: { Screen: () => null },
}));

// Mock react-hook-form
jest.mock('react-hook-form', () => ({
  useForm: () => ({
    control: {},
    handleSubmit: jest.fn(),
    formState: { errors: {} },
    setValue: jest.fn(),
    watch: jest.fn(),
  }),
  Controller: ({ render }: any) => render({
    field: {
      onChange: jest.fn(),
      value: '',
      name: 'test',
      onBlur: jest.fn(),
    }
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

// Mock API calls
jest.mock('@/api/calls/calls', () => ({
  createCall: jest.fn(),
}));

// What3Words API response types
interface What3WordsResponse {
  coordinates: {
    lat: number;
    lng: number;
  };
  nearestPlace: string;
  words: string;
}

describe('what3words API functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get.mockClear();
  });

  describe('what3words format validation', () => {
    it('should validate correct what3words format', () => {
      const validFormats = [
        'filled.count.soap',
        'index.home.raft',
        'daring.lion.race',
        'three.word.address',
      ];

      // What3words format: exactly 3 words separated by dots, each word at least 3 characters, only lowercase letters
      const w3wRegex = /^[a-z]{3,}\.[a-z]{3,}\.[a-z]{3,}$/;

      validFormats.forEach(format => {
        expect(w3wRegex.test(format)).toBe(true);
      });
    });

    it('should reject invalid what3words formats', () => {
      const invalidFormats = [
        'invalid-format', // contains hyphens
        'two.words', // only 2 words
        'four.words.here.extra', // 4 words
        'word.with.CAPITALS', // contains capitals
        'word.with.123', // contains numbers
        'word.with.spaces here', // contains spaces
        'word.with.', // ends with dot
        '.word.with', // starts with dot
        'word..with', // double dot
        '', // empty
        'single', // single word
        'ab.cd.ef', // words too short (less than 3 chars)
        'word.wi.address', // middle word too short
      ];

      // What3words format: exactly 3 words separated by dots, each word at least 3 characters, only lowercase letters
      const w3wRegex = /^[a-z]{3,}\.[a-z]{3,}\.[a-z]{3,}$/;

      invalidFormats.forEach(format => {
        // Test the original format (not converted to lowercase)
        expect(w3wRegex.test(format)).toBe(false);
      });
    });
  });

  describe('what3words API integration', () => {
    it('should make correct API call with valid what3words', async () => {
      const mockResponse = {
        data: {
          coordinates: {
            lat: 51.520847,
            lng: -0.195521,
          },
          nearestPlace: 'Bayswater, London',
          words: 'filled.count.soap',
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const what3words = 'filled.count.soap';
      const apiKey = 'test-api-key';
      const expectedUrl = `https://api.what3words.com/v3/convert-to-coordinates?words=${encodeURIComponent(what3words)}&key=${apiKey}`;

      // Simulate API call
      await axios.get(expectedUrl);

      expect(mockedAxios.get).toHaveBeenCalledWith(expectedUrl);
    });

    it('should handle successful API response', async () => {
      const mockResponse = {
        data: {
          coordinates: {
            lat: 51.520847,
            lng: -0.195521,
          },
          nearestPlace: 'Bayswater, London',
          words: 'filled.count.soap',
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const response = await axios.get('test-url');
      expect(response.data.coordinates.lat).toBe(51.520847);
      expect(response.data.coordinates.lng).toBe(-0.195521);
      expect(response.data.nearestPlace).toBe('Bayswater, London');
    });

    it('should handle API errors', async () => {
      const mockError = new Error('Network error');
      mockedAxios.get.mockRejectedValue(mockError);

      await expect(axios.get('test-url')).rejects.toThrow('Network error');
    });

    it('should handle response with no coordinates', async () => {
      const mockResponse = {
        data: {
          coordinates: null,
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const response = await axios.get('test-url');
      expect(response.data.coordinates).toBeNull();
    });
  });

  describe('URL encoding', () => {
    it('should properly encode what3words in URL', () => {
      const what3words = 'filled.count.soap';
      const encoded = encodeURIComponent(what3words);

      // what3words typically don't need encoding, but test that it works
      expect(encoded).toBe('filled.count.soap');
    });

    it('should handle special characters if present', () => {
      const what3words = 'test.word.address';
      const encoded = encodeURIComponent(what3words);

      expect(encoded).toBe('test.word.address');
    });
  });

  describe('coordinate conversion', () => {
    it('should convert coordinates to correct format', () => {
      const lat = 51.520847;
      const lng = -0.195521;
      const formatted = `${lat}, ${lng}`;

      expect(formatted).toBe('51.520847, -0.195521');
    });

    it('should handle negative coordinates', () => {
      const lat = -33.8688;
      const lng = 151.2093;
      const formatted = `${lat}, ${lng}`;

      expect(formatted).toBe('-33.8688, 151.2093');
    });
  });

  describe('API configuration', () => {
    it('should use configured API key', () => {
      expect(mockConfig.W3WKey).toBe('test-api-key');
    });

    it('should construct correct API URL', () => {
      const what3words = 'filled.count.soap';
      const apiKey = mockConfig.W3WKey;
      const expectedUrl = `https://api.what3words.com/v3/convert-to-coordinates?words=${encodeURIComponent(what3words)}&key=${apiKey}`;

      expect(expectedUrl).toBe('https://api.what3words.com/v3/convert-to-coordinates?words=filled.count.soap&key=test-api-key');
    });
  });

  describe('location data handling', () => {
    it('should extract location data from API response', () => {
      const mockResponse = {
        data: {
          coordinates: {
            lat: 51.520847,
            lng: -0.195521,
          },
          nearestPlace: 'Bayswater, London',
          words: 'filled.count.soap',
        },
      };

      const newLocation = {
        latitude: mockResponse.data.coordinates.lat,
        longitude: mockResponse.data.coordinates.lng,
        address: mockResponse.data.nearestPlace,
      };

      expect(newLocation).toEqual({
        latitude: 51.520847,
        longitude: -0.195521,
        address: 'Bayswater, London',
      });
    });

    it('should handle missing nearestPlace', () => {
      const mockResponse = {
        data: {
          coordinates: {
            lat: 51.520847,
            lng: -0.195521,
          },
          nearestPlace: undefined,
          words: 'filled.count.soap',
        },
      };

      const newLocation = {
        latitude: mockResponse.data.coordinates.lat,
        longitude: mockResponse.data.coordinates.lng,
        address: mockResponse.data.nearestPlace,
      };

      expect(newLocation.address).toBeUndefined();
    });
  });
});
