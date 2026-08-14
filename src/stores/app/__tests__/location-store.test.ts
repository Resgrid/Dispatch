// Mock Platform first before any imports
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((specifics: any) => specifics.ios || specifics.default),
    Version: 17,
  },
}));

// Mock MMKV storage
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    getString: jest.fn(),
    delete: jest.fn(),
  })),
  useMMKVBoolean: jest.fn(() => [false, jest.fn()]),
}));

import { renderHook, act } from '@testing-library/react-native';

import { useLocationStore } from '../location-store';

describe('useLocationStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useLocationStore.setState({
      latitude: null,
      longitude: null,
      heading: null,
      accuracy: null,
      speed: null,
      altitude: null,
      timestamp: null,
      isBackgroundEnabled: false,
      isMapLocked: false,
    });
  });

  it('should have initial state', () => {
    const { result } = renderHook(() => useLocationStore());

    expect(result.current.latitude).toBeNull();
    expect(result.current.longitude).toBeNull();
    expect(result.current.heading).toBeNull();
    expect(result.current.accuracy).toBeNull();
    expect(result.current.speed).toBeNull();
    expect(result.current.altitude).toBeNull();
    expect(result.current.timestamp).toBeNull();
    expect(result.current.isBackgroundEnabled).toBe(false);
    expect(result.current.isMapLocked).toBe(false);
  });

  it('should update location data', () => {
    const { result } = renderHook(() => useLocationStore());

    const mockLocation = {
      coords: {
        latitude: 40.7128,
        longitude: -74.006,
        heading: 180,
        accuracy: 5,
        speed: 0,
        altitude: 10,
        altitudeAccuracy: 5,
      },
      timestamp: 1640995200000,
    };

    act(() => {
      result.current.setLocation(mockLocation);
    });

    expect(result.current.latitude).toBe(40.7128);
    expect(result.current.longitude).toBe(-74.006);
    expect(result.current.heading).toBe(180);
    expect(result.current.accuracy).toBe(5);
    expect(result.current.speed).toBe(0);
    expect(result.current.altitude).toBe(10);
    expect(result.current.timestamp).toBe(1640995200000);
  });

  it('should set background enabled', () => {
    const { result } = renderHook(() => useLocationStore());

    act(() => {
      result.current.setBackgroundEnabled(true);
    });

    expect(result.current.isBackgroundEnabled).toBe(true);

    act(() => {
      result.current.setBackgroundEnabled(false);
    });

    expect(result.current.isBackgroundEnabled).toBe(false);
  });

  describe('Map Lock Functionality', () => {
    it('should set map locked state', () => {
      const { result } = renderHook(() => useLocationStore());

      // Initially unlocked
      expect(result.current.isMapLocked).toBe(false);

      // Lock the map
      act(() => {
        result.current.setMapLocked(true);
      });

      expect(result.current.isMapLocked).toBe(true);

      // Unlock the map
      act(() => {
        result.current.setMapLocked(false);
      });

      expect(result.current.isMapLocked).toBe(false);
    });

    it('should toggle map lock state', () => {
      const { result } = renderHook(() => useLocationStore());

      // Start unlocked
      expect(result.current.isMapLocked).toBe(false);

      // Toggle to locked
      act(() => {
        result.current.setMapLocked(!result.current.isMapLocked);
      });

      expect(result.current.isMapLocked).toBe(true);

      // Toggle back to unlocked
      act(() => {
        result.current.setMapLocked(!result.current.isMapLocked);
      });

      expect(result.current.isMapLocked).toBe(false);
    });

    it('should persist map lock state', () => {
      const { result } = renderHook(() => useLocationStore());

      // Set map locked
      act(() => {
        result.current.setMapLocked(true);
      });

      expect(result.current.isMapLocked).toBe(true);

      // Create a new hook instance (simulating app restart)
      const { result: newResult } = renderHook(() => useLocationStore());

      // Map lock state should be persisted
      expect(newResult.current.isMapLocked).toBe(true);
    });
  });

  it('should have all required methods', () => {
    const { result } = renderHook(() => useLocationStore());

    expect(typeof result.current.setLocation).toBe('function');
    expect(typeof result.current.setBackgroundEnabled).toBe('function');
    expect(typeof result.current.setMapLocked).toBe('function');
  });

  // iOS ignores watchPositionAsync's timeInterval, so a stationary device delivers the same
  // fix many times a second. Notifying subscribers on each one drove React into "Maximum
  // update depth exceeded".
  describe('repeat fixes', () => {
    const buildLocation = (overrides: { latitude?: number; timestamp?: number } = {}) => ({
      coords: {
        latitude: overrides.latitude ?? 40.7128,
        longitude: -74.006,
        heading: 180,
        accuracy: 5,
        speed: 0,
        altitude: 10,
        altitudeAccuracy: 3,
      },
      timestamp: overrides.timestamp ?? 1_700_000_000_000,
    });

    it('does not notify subscribers when the fix carries nothing new', () => {
      const listener = jest.fn();
      useLocationStore.getState().setLocation(buildLocation());

      const unsubscribe = useLocationStore.subscribe(listener);
      useLocationStore.getState().setLocation(buildLocation({ timestamp: 1_700_000_005_000 }));
      unsubscribe();

      expect(listener).not.toHaveBeenCalled();
      expect(useLocationStore.getState().latitude).toBe(40.7128);
    });

    it('still notifies subscribers when the device actually moves', () => {
      const listener = jest.fn();
      useLocationStore.getState().setLocation(buildLocation());

      const unsubscribe = useLocationStore.subscribe(listener);
      useLocationStore.getState().setLocation(buildLocation({ latitude: 40.72 }));
      unsubscribe();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(useLocationStore.getState().latitude).toBe(40.72);
    });
  });
});
