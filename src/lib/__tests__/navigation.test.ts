import { Platform, Linking } from 'react-native';
import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { openMapsWithDirections, openMapsWithAddress } from '../navigation';

// Mock React Native modules
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  Linking: {
    canOpenURL: jest.fn(),
    openURL: jest.fn(),
  },
}));

// Mock expo-router - pulling in the real module drags @react-navigation into the
// module graph, which needs far more of the RN API surface than the mock above has
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

// Mock the logger
jest.mock('../logging', () => ({
  logger: {
    error: jest.fn(),
  },
}));

// Get the mocked Linking module
const MockedLinking = Linking as jest.Mocked<typeof Linking>;

describe('Navigation Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockedLinking.canOpenURL.mockResolvedValue(true);
    MockedLinking.openURL.mockResolvedValue(true);
  });

  afterEach(() => {
    // Reset Platform.OS to default
    (Platform as any).OS = 'ios';
  });

  describe('openMapsWithDirections', () => {
    describe('iOS Platform', () => {
      beforeEach(() => {
        (Platform as any).OS = 'ios';
      });

      it('should open Apple Maps with current location as origin', async () => {
        const result = await openMapsWithDirections(40.7128, -74.006, 'New York');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('maps://maps.apple.com/?daddr=40.7128,-74.006&dirflg=d');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('maps://maps.apple.com/?daddr=40.7128,-74.006&dirflg=d');
        expect(result).toBe(true);
      });

      it('should open Apple Maps with specific origin', async () => {
        const result = await openMapsWithDirections(40.7128, -74.006, 'New York', 40.7589, -73.9851);

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('maps://maps.apple.com/?saddr=40.7589,-73.9851&daddr=40.7128,-74.006&dirflg=d');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('maps://maps.apple.com/?saddr=40.7589,-73.9851&daddr=40.7128,-74.006&dirflg=d');
        expect(result).toBe(true);
      });

      it('should handle string coordinates', async () => {
        const result = await openMapsWithDirections('40.7128', '-74.006', 'New York');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('maps://maps.apple.com/?daddr=40.7128,-74.006&dirflg=d');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('maps://maps.apple.com/?daddr=40.7128,-74.006&dirflg=d');
        expect(result).toBe(true);
      });
    });

    describe('Android Platform', () => {
      beforeEach(() => {
        (Platform as any).OS = 'android';
      });

      it('should open Google Maps with current location as origin', async () => {
        const result = await openMapsWithDirections(40.7128, -74.006, 'New York');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('google.navigation:q=40.7128,-74.006');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('google.navigation:q=40.7128,-74.006');
        expect(result).toBe(true);
      });

      it('should open Google Maps with specific origin', async () => {
        const result = await openMapsWithDirections(40.7128, -74.006, 'New York', 40.7589, -73.9851);

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('google.navigation:q=40.7128,-74.006&origin=40.7589,-73.9851');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('google.navigation:q=40.7128,-74.006&origin=40.7589,-73.9851');
        expect(result).toBe(true);
      });
    });

    describe('Web Platform', () => {
      beforeEach(() => {
        (Platform as any).OS = 'web';
      });

      it('should open Google Maps web with current location as origin', async () => {
        const result = await openMapsWithDirections(40.7128, -74.006, 'New York');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=40.7128,-74.006&travelmode=driving');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=40.7128,-74.006&travelmode=driving');
        expect(result).toBe(true);
      });

      it('should open Google Maps web with specific origin', async () => {
        const result = await openMapsWithDirections(40.7128, -74.006, 'New York', 40.7589, -73.9851);

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&origin=40.7589,-73.9851&destination=40.7128,-74.006&travelmode=driving');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&origin=40.7589,-73.9851&destination=40.7128,-74.006&travelmode=driving');
        expect(result).toBe(true);
      });
    });

    describe('Windows Platform', () => {
      beforeEach(() => {
        (Platform as any).OS = 'windows';
      });

      it('should open Google Maps web for Windows', async () => {
        const result = await openMapsWithDirections(40.7128, -74.006, 'New York');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=40.7128,-74.006&travelmode=driving');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=40.7128,-74.006&travelmode=driving');
        expect(result).toBe(true);
      });
    });

    describe('macOS Platform', () => {
      beforeEach(() => {
        (Platform as any).OS = 'macos';
      });

      it('should open Google Maps web for macOS', async () => {
        const result = await openMapsWithDirections(40.7128, -74.006, 'New York');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=40.7128,-74.006&travelmode=driving');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=40.7128,-74.006&travelmode=driving');
        expect(result).toBe(true);
      });
    });

    describe('Fallback Behavior', () => {
      beforeEach(() => {
        (Platform as any).OS = 'ios';
      });

      it('should use web fallback when canOpenURL returns false', async () => {
        MockedLinking.canOpenURL.mockResolvedValue(false);

        const result = await openMapsWithDirections(40.7128, -74.006, 'New York');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('maps://maps.apple.com/?daddr=40.7128,-74.006&dirflg=d');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=40.7128,-74.006&travelmode=driving');
        expect(result).toBe(true);
      });

      it('should handle unknown platform', async () => {
        (Platform as any).OS = 'unknown';

        const result = await openMapsWithDirections(40.7128, -74.006, 'New York');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=40.7128,-74.006&travelmode=driving');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=40.7128,-74.006&travelmode=driving');
        expect(result).toBe(true);
      });
    });

    describe('Error Handling', () => {
      beforeEach(() => {
        (Platform as any).OS = 'ios';
      });

      it('should handle Linking.openURL errors', async () => {
        const mockError = new Error('Unable to open URL');
        MockedLinking.openURL.mockRejectedValue(mockError);

        const result = await openMapsWithDirections(40.7128, -74.006, 'New York');

        expect(result).toBe(false);
      });

      it('should handle Linking.canOpenURL errors', async () => {
        const mockError = new Error('Unable to check URL');
        MockedLinking.canOpenURL.mockRejectedValue(mockError);

        const result = await openMapsWithDirections(40.7128, -74.006, 'New York');

        expect(result).toBe(false);
      });
    });

    describe('Parameter Validation', () => {
      it('should handle undefined destination name', async () => {
        const result = await openMapsWithDirections(40.7128, -74.006);

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('maps://maps.apple.com/?daddr=40.7128,-74.006&dirflg=d');
        expect(result).toBe(true);
      });

      it('should handle zero coordinates', async () => {
        const result = await openMapsWithDirections(0, 0, 'Equator');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('maps://maps.apple.com/?daddr=0,0&dirflg=d');
        expect(result).toBe(true);
      });

      it('should handle negative coordinates', async () => {
        const result = await openMapsWithDirections(-40.7128, -74.006, 'South America');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('maps://maps.apple.com/?daddr=-40.7128,-74.006&dirflg=d');
        expect(result).toBe(true);
      });
    });
  });

  describe('openMapsWithAddress', () => {
    describe('iOS Platform', () => {
      beforeEach(() => {
        (Platform as any).OS = 'ios';
      });

      it('should open Apple Maps with address', async () => {
        const result = await openMapsWithAddress('123 Main Street, New York, NY');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('maps://maps.apple.com/?daddr=123%20Main%20Street%2C%20New%20York%2C%20NY&dirflg=d');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('maps://maps.apple.com/?daddr=123%20Main%20Street%2C%20New%20York%2C%20NY&dirflg=d');
        expect(result).toBe(true);
      });

      it('should handle special characters in address', async () => {
        const result = await openMapsWithAddress('123 Main St. & 1st Ave, New York, NY');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('maps://maps.apple.com/?daddr=123%20Main%20St.%20%26%201st%20Ave%2C%20New%20York%2C%20NY&dirflg=d');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('maps://maps.apple.com/?daddr=123%20Main%20St.%20%26%201st%20Ave%2C%20New%20York%2C%20NY&dirflg=d');
        expect(result).toBe(true);
      });
    });

    describe('Android Platform', () => {
      beforeEach(() => {
        (Platform as any).OS = 'android';
      });

      it('should open Google Maps with address', async () => {
        const result = await openMapsWithAddress('123 Main Street, New York, NY');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('google.navigation:q=123%20Main%20Street%2C%20New%20York%2C%20NY');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('google.navigation:q=123%20Main%20Street%2C%20New%20York%2C%20NY');
        expect(result).toBe(true);
      });

      it('should handle special characters in address', async () => {
        const result = await openMapsWithAddress('123 Main St. & 1st Ave, New York, NY');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('google.navigation:q=123%20Main%20St.%20%26%201st%20Ave%2C%20New%20York%2C%20NY');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('google.navigation:q=123%20Main%20St.%20%26%201st%20Ave%2C%20New%20York%2C%20NY');
        expect(result).toBe(true);
      });
    });

    describe('Web Platform', () => {
      beforeEach(() => {
        (Platform as any).OS = 'web';
      });

      it('should open Google Maps web with address', async () => {
        const result = await openMapsWithAddress('123 Main Street, New York, NY');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=123%20Main%20Street%2C%20New%20York%2C%20NY&travelmode=driving');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=123%20Main%20Street%2C%20New%20York%2C%20NY&travelmode=driving');
        expect(result).toBe(true);
      });

      it('should handle special characters in address', async () => {
        const result = await openMapsWithAddress('123 Main St. & 1st Ave, New York, NY');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=123%20Main%20St.%20%26%201st%20Ave%2C%20New%20York%2C%20NY&travelmode=driving');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=123%20Main%20St.%20%26%201st%20Ave%2C%20New%20York%2C%20NY&travelmode=driving');
        expect(result).toBe(true);
      });
    });

    describe('Windows Platform', () => {
      beforeEach(() => {
        (Platform as any).OS = 'windows';
      });

      it('should open Google Maps web for Windows', async () => {
        const result = await openMapsWithAddress('123 Main Street, New York, NY');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=123%20Main%20Street%2C%20New%20York%2C%20NY&travelmode=driving');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=123%20Main%20Street%2C%20New%20York%2C%20NY&travelmode=driving');
        expect(result).toBe(true);
      });
    });

    describe('macOS Platform', () => {
      beforeEach(() => {
        (Platform as any).OS = 'macos';
      });

      it('should open Google Maps web for macOS', async () => {
        const result = await openMapsWithAddress('123 Main Street, New York, NY');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=123%20Main%20Street%2C%20New%20York%2C%20NY&travelmode=driving');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=123%20Main%20Street%2C%20New%20York%2C%20NY&travelmode=driving');
        expect(result).toBe(true);
      });
    });

    describe('Fallback Behavior', () => {
      beforeEach(() => {
        (Platform as any).OS = 'ios';
      });

      it('should use web fallback when canOpenURL returns false', async () => {
        MockedLinking.canOpenURL.mockResolvedValue(false);

        const result = await openMapsWithAddress('123 Main Street, New York, NY');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('maps://maps.apple.com/?daddr=123%20Main%20Street%2C%20New%20York%2C%20NY&dirflg=d');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=123%20Main%20Street%2C%20New%20York%2C%20NY&travelmode=driving');
        expect(result).toBe(true);
      });

      it('should handle unknown platform', async () => {
        (Platform as any).OS = 'unknown';

        const result = await openMapsWithAddress('123 Main Street, New York, NY');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=123%20Main%20Street%2C%20New%20York%2C%20NY&travelmode=driving');
        expect(MockedLinking.openURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=123%20Main%20Street%2C%20New%20York%2C%20NY&travelmode=driving');
        expect(result).toBe(true);
      });
    });

    describe('Error Handling', () => {
      beforeEach(() => {
        (Platform as any).OS = 'ios';
      });

      it('should handle Linking.openURL errors', async () => {
        const mockError = new Error('Unable to open URL');
        MockedLinking.openURL.mockRejectedValue(mockError);

        const result = await openMapsWithAddress('123 Main Street, New York, NY');

        expect(result).toBe(false);
      });

      it('should handle Linking.canOpenURL errors', async () => {
        const mockError = new Error('Unable to check URL');
        MockedLinking.canOpenURL.mockRejectedValue(mockError);

        const result = await openMapsWithAddress('123 Main Street, New York, NY');

        expect(result).toBe(false);
      });
    });

    describe('Parameter Validation', () => {
      it('should handle empty address', async () => {
        const result = await openMapsWithAddress('');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('maps://maps.apple.com/?daddr=&dirflg=d');
        expect(result).toBe(true);
      });

      it('should handle address with only spaces', async () => {
        const result = await openMapsWithAddress('   ');

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith('maps://maps.apple.com/?daddr=%20%20%20&dirflg=d');
        expect(result).toBe(true);
      });

      it('should handle very long address', async () => {
        const longAddress = 'A'.repeat(1000);
        const result = await openMapsWithAddress(longAddress);

        expect(MockedLinking.canOpenURL).toHaveBeenCalledWith(`maps://maps.apple.com/?daddr=${encodeURIComponent(longAddress)}&dirflg=d`);
        expect(result).toBe(true);
      });
    });
  });
});
