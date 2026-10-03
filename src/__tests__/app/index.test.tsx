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
  useMapSignalRUpdates: jest.fn(() => ({ requestRefresh: jest.fn() })),
}));
jest.mock('@/hooks/use-map-live-locations', () => ({
  useMapLiveLocations: jest.fn(() => ({ applyToFetchedPins: (pins: unknown[]) => pins })),
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
    visibleLayerData: [],
    getVisibleLayerData: jest.fn(() => []),
  })),
  MapLayerType: { ALL: 'ALL' },
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
  useIsFocused: jest.fn(() => true),
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
  })),
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
// The department map style is read through useCoreStore(selector); getState serves setActiveCall.
const mockCoreState: { config: { MapDayStyleUrl: string; MapNightStyleUrl: string } | null } = { config: null };
jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: Object.assign((selector: (state: unknown) => unknown) => selector(mockCoreState), {
    getState: () => ({
      ...mockCoreState,
      setActiveCall: jest.fn(),
    }),
  }),
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

const DEPARTMENT_DAY_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12';
const DEPARTMENT_NIGHT_STYLE = 'mapbox://styles/mapbox/navigation-night-v1';

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
    mockCoreState.config = { MapDayStyleUrl: DEPARTMENT_DAY_STYLE, MapNightStyleUrl: DEPARTMENT_NIGHT_STYLE };
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

  it("should use the department's day style when in light mode", async () => {
    mockUseColorScheme.mockReturnValue({
      colorScheme: 'light',
      setColorScheme: jest.fn(),
      toggleColorScheme: jest.fn(),
    });

    const { getByTestId, unmount } = render(<Map />, { wrapper: TestWrapper });

    expect(getByTestId('map-view').props.styleURL).toBe(DEPARTMENT_DAY_STYLE);

    unmount();
  });

  it("should use the department's night style when in dark mode", async () => {
    mockUseColorScheme.mockReturnValue({
      colorScheme: 'dark',
      setColorScheme: jest.fn(),
      toggleColorScheme: jest.fn(),
    });

    const { getByTestId, unmount } = render(<Map />, { wrapper: TestWrapper });

    expect(getByTestId('map-view').props.styleURL).toBe(DEPARTMENT_NIGHT_STYLE);

    unmount();
  });

  it('should fall back to Streets before config loads', async () => {
    mockCoreState.config = null;

    const { getByTestId, unmount } = render(<Map />, { wrapper: TestWrapper });

    expect(getByTestId('map-view').props.styleURL).toBe('mapbox://styles/mapbox/streets-v12');

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

    const { getByTestId, rerender, unmount } = render(<Map />, { wrapper: TestWrapper });
    expect(getByTestId('map-view').props.styleURL).toBe(DEPARTMENT_DAY_STYLE);

    // Change to dark theme
    mockUseColorScheme.mockReturnValue({
      colorScheme: 'dark',
      setColorScheme,
      toggleColorScheme,
    });

    rerender(<Map />);

    // The base map follows the theme to the department's night style
    expect(getByTestId('map-view').props.styleURL).toBe(DEPARTMENT_NIGHT_STYLE);

    unmount();
  });
});
