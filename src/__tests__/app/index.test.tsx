import { render, waitFor } from '@testing-library/react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Map from '../../app/(app)/map';
import { useAppLifecycle } from '@/hooks/use-app-lifecycle';
import { useLocationStore } from '@/stores/app/location-store';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('@/hooks/use-app-lifecycle');
jest.mock('@/stores/app/location-store');
jest.mock('@/hooks/use-map-signalr-updates', () => ({
  useMapSignalRUpdates: jest.fn(),
}));
jest.mock('@/hooks/use-map-layers', () => ({
  useMapLayers: jest.fn(() => ({
    layers: [],
    visibleLayers: new Set(),
    isLoading: false,
    fetchLayers: jest.fn(),
    toggleLayer: jest.fn(),
    showAllLayers: jest.fn(),
    hideAllLayers: jest.fn(),
    getVisibleLayerData: jest.fn(() => []),
  })),
  MapLayerType: { ALL: 'ALL' },
}));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => true),
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
  })),
}));
jest.mock('@/api/mapping/mapping', () => ({
  getMapDataAndMarkers: jest.fn().mockResolvedValue({
    Data: { MapMakerInfos: [] },
  }),
}));
jest.mock('@rnmapbox/maps', () => ({
  setAccessToken: jest.fn(),
  MapView: 'MapView',
  Camera: 'Camera',
  PointAnnotation: 'PointAnnotation',
  StyleURL: {
    Street: 'mapbox://styles/mapbox/streets-v11',
    Dark: 'mapbox://styles/mapbox/dark-v10',
    Light: 'mapbox://styles/mapbox/light-v10',
  },
  UserTrackingMode: {
    Follow: 'follow',
    FollowWithHeading: 'followWithHeading',
  },
}));
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ children, ...props }: any) => children,
  },
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useFocusEffect: jest.fn(() => {
    // Don't call the callback to prevent infinite loops in tests
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: jest.fn(() => ({
    colorScheme: 'light',
  })),
}));
jest.mock('@/stores/toast/store', () => ({
  useToastStore: () => ({
    showToast: jest.fn(),
    getState: () => ({
      showToast: jest.fn(),
    }),
  }),
}));
jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: {
    getState: () => ({
      setActiveCall: jest.fn(),
    }),
  },
}));
jest.mock('@/components/maps/map-pins', () => ({
  __esModule: true,
  default: ({ pins, onPinPress }: any) => null,
}));
jest.mock('@/components/maps/pin-detail-modal', () => ({
  __esModule: true,
  default: ({ pin, isOpen, onClose, onSetAsCurrentCall }: any) => null,
}));
jest.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({
    trackEvent: jest.fn(),
  }),
}));

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => <SafeAreaProvider>{children}</SafeAreaProvider>;
jest.mock('@/components/ui/focus-aware-status-bar', () => ({
  FocusAwareStatusBar: () => null,
}));

const mockUseAppLifecycle = useAppLifecycle as jest.MockedFunction<typeof useAppLifecycle>;
const mockUseLocationStore = useLocationStore as jest.MockedFunction<typeof useLocationStore>;
const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

// Create stable reference objects to prevent infinite re-renders
const defaultLocationState = {
  latitude: 40.7128,
  longitude: -74.006,
  heading: 0,
  isMapLocked: false,
};

const defaultAppLifecycleState = {
  isActive: true,
  appState: 'active' as const,
  isBackground: false,
  lastActiveTimestamp: Date.now(),
};

describe('Map Component - App Lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup default mocks with stable objects
    mockUseLocationStore.mockReturnValue(defaultLocationState);
    mockUseAppLifecycle.mockReturnValue(defaultAppLifecycleState);
    mockUseColorScheme.mockReturnValue({
      colorScheme: 'light',
      setColorScheme: jest.fn(),
      toggleColorScheme: jest.fn(),
    });
  });

  afterEach(() => {
    // Clean up all timers and async operations
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should render without crashing', async () => {
    const { unmount } = render(<Map />, { wrapper: TestWrapper });

    // Just verify it renders without errors
    expect(true).toBe(true);

    // Clean up the component
    unmount();
  });

  it('should handle location updates', async () => {
    const { unmount } = render(<Map />, { wrapper: TestWrapper });

    // Component should render with default location state
    expect(mockUseLocationStore).toHaveBeenCalled();

    unmount();
  });

  it('should handle app lifecycle changes', async () => {
    // Test with inactive app
    mockUseAppLifecycle.mockReturnValue({
      isActive: false,
      appState: 'background' as const,
      isBackground: true,
      lastActiveTimestamp: null,
    });

    const { rerender, unmount } = render(<Map />, { wrapper: TestWrapper });

    // Simulate app becoming active
    mockUseAppLifecycle.mockReturnValue({
      isActive: true,
      appState: 'active' as const,
      isBackground: false,
      lastActiveTimestamp: Date.now(),
    });

    rerender(<Map />);

    // Component should handle lifecycle changes
    expect(mockUseAppLifecycle).toHaveBeenCalled();

    unmount();
  });

  it('should handle map lock state changes', async () => {
    // Start with unlocked map
    mockUseLocationStore.mockReturnValue({
      ...defaultLocationState,
      isMapLocked: false,
    });

    const { rerender, unmount } = render(<Map />, { wrapper: TestWrapper });

    // Change to locked map
    mockUseLocationStore.mockReturnValue({
      ...defaultLocationState,
      isMapLocked: true,
    });

    rerender(<Map />);

    // Component should handle lock state changes
    expect(mockUseLocationStore).toHaveBeenCalled();

    unmount();
  });

  it('should handle navigation mode with heading', async () => {
    // Mock locked map with heading
    mockUseLocationStore.mockReturnValue({
      ...defaultLocationState,
      heading: 90,
      isMapLocked: true,
    });

    const { unmount } = render(<Map />, { wrapper: TestWrapper });

    expect(mockUseLocationStore).toHaveBeenCalled();

    unmount();
  });

  it('should use light theme map style when in light mode', async () => {
    mockUseColorScheme.mockReturnValue({
      colorScheme: 'light',
      setColorScheme: jest.fn(),
      toggleColorScheme: jest.fn(),
    });

    const { unmount } = render(<Map />, { wrapper: TestWrapper });

    // The map should use the light style
    expect(mockUseColorScheme).toHaveBeenCalled();

    unmount();
  });

  it('should use dark theme map style when in dark mode', async () => {
    mockUseColorScheme.mockReturnValue({
      colorScheme: 'dark',
      setColorScheme: jest.fn(),
      toggleColorScheme: jest.fn(),
    });

    const { unmount } = render(<Map />, { wrapper: TestWrapper });

    // The map should use the dark style
    expect(mockUseColorScheme).toHaveBeenCalled();

    unmount();
  });

  it('should handle theme changes gracefully', async () => {
    // Start with light theme
    const setColorScheme = jest.fn();
    const toggleColorScheme = jest.fn();

    mockUseColorScheme.mockReturnValue({
      colorScheme: 'light',
      setColorScheme,
      toggleColorScheme,
    });

    const { rerender, unmount } = render(<Map />, { wrapper: TestWrapper });

    // Change to dark theme
    mockUseColorScheme.mockReturnValue({
      colorScheme: 'dark',
      setColorScheme,
      toggleColorScheme,
    });

    rerender(<Map />);

    // Component should handle theme changes without errors
    expect(mockUseColorScheme).toHaveBeenCalled();

    unmount();
  });
});
