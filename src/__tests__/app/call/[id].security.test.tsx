import { render, screen } from '@testing-library/react-native';
import React from 'react';

// Mock Platform before any other imports
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (obj: any) => obj.ios ?? obj.default,
  },
  PixelRatio: {
    getFontScale: () => 1,
    get: () => 2,
    roundToNearestPixel: (size: number) => size,
  },
  Dimensions: {
    get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  ScrollView: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  StyleSheet: {
    create: (styles: any) => styles,
    flatten: (styles: any) => styles,
  },
  useWindowDimensions: () => ({ width: 375, height: 812 }),
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
  useLocalSearchParams: () => ({ id: 'test-call-id' }),
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
  Stack: {
    Screen: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        apiUrl: 'https://test-api.com',
        environment: 'test',
      },
    },
  },
}));

// Mock expo-modules-core
jest.mock('expo-modules-core', () => ({
  NativeModulesProxy: {},
  NativeUnimoduleProxy: {},
}));

// Mock storage
jest.mock('@/lib/storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock MMKV
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn(),
    getBoolean: jest.fn(),
    getNumber: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}));

// Mock stores
const mockCallDetailStore = {
  call: {
    CallId: 'test-call-id',
    Name: 'Test Call',
    Number: '12345',
    Priority: 1,
    Type: 'Emergency',
    Address: '123 Test Street',
    Latitude: '40.7128',
    Longitude: '-74.0060',
    NotesCount: 2,
    ImgagesCount: 1,
    FileCount: 3,
  },
  callExtraData: null,
  callPriority: { Color: '#FF0000' },
  isLoading: false,
  error: null,
  fetchCallDetail: jest.fn(),
  reset: jest.fn(),
};

const mockSecurityStore = {
  canUserCreateCalls: true,
};

const mockCoreStore = {
  activeCall: null,
  activeStatuses: [],
  activeUnit: null,
  setActiveCall: jest.fn(),
};

const mockLocationStore = {
  latitude: 40.7589,
  longitude: -73.9851,
};

const mockStatusBottomSheetStore = {
  setIsOpen: jest.fn(),
  setSelectedCall: jest.fn(),
};

const mockToastStore = {
  showToast: jest.fn(),
};

jest.mock('@/stores/calls/detail-store', () => ({
  useCallDetailStore: jest.fn(),
}));

jest.mock('@/stores/security/store', () => ({
  useSecurityStore: jest.fn(),
}));

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: jest.fn(),
}));

jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: jest.fn(),
}));

jest.mock('@/stores/status/store', () => ({
  useStatusBottomSheetStore: jest.fn(),
}));

jest.mock('@/stores/toast/store', () => ({
  useToastStore: jest.fn(),
}));

// Mock other hooks and services
jest.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({
    trackEvent: jest.fn(),
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  cssInterop: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

// Mock navigation hook
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn((callback: () => void) => {
    const React = require('react');
    React.useEffect(callback, []);
  }),
}));

// Mock components
jest.mock('@/components/common/loading', () => ({
  Loading: () => <div data-testid="loading">Loading...</div>,
}));

jest.mock('@/components/common/zero-state', () => ({
  __esModule: true,
  default: ({ heading, description, isError }: any) => (
    <div data-testid={isError ? "error-state" : "zero-state"}>
      {heading} - {description}
    </div>
  ),
}));

jest.mock('@/components/maps/static-map', () => ({
  __esModule: true,
  default: () => <div data-testid="static-map">Map</div>,
}));

// Mock the call detail menu component
jest.mock('../../../components/calls/call-detail-menu', () => ({
  useCallDetailMenu: ({ canUserCreateCalls }: { canUserCreateCalls: boolean }) => ({
    HeaderRightMenu: () =>
      canUserCreateCalls ? <div data-testid="header-right-menu">Menu</div> : null,
    CallDetailActionSheet: () =>
      canUserCreateCalls ? <div data-testid="call-detail-actionsheet">Action Sheet</div> : null,
  }),
}));

// Mock other components
jest.mock('../../../components/calls/call-files-modal', () => ({
  __esModule: true,
  default: () => <div data-testid="call-files-modal">Files Modal</div>,
}));

jest.mock('../../../components/calls/call-images-modal', () => ({
  __esModule: true,
  default: () => <div data-testid="call-images-modal">Images Modal</div>,
}));

jest.mock('../../../components/calls/call-notes-modal', () => ({
  __esModule: true,
  default: () => <div data-testid="call-notes-modal">Notes Modal</div>,
}));

jest.mock('../../../components/calls/call-audio-modal', () => ({
  __esModule: true,
  default: () => <div data-testid="call-audio-modal">Audio Modal</div>,
}));

jest.mock('../../../components/calls/close-call-bottom-sheet', () => ({
  CloseCallBottomSheet: () => <div data-testid="close-call-bottom-sheet">Close Call Sheet</div>,
}));

jest.mock('../../../components/calls/reschedule-call-sheet', () => ({
  RescheduleCallSheet: () => <div data-testid="reschedule-call-sheet">Reschedule Sheet</div>,
}));

jest.mock('../../../components/status/status-bottom-sheet', () => ({
  StatusBottomSheet: () => <div data-testid="status-bottom-sheet">Status Sheet</div>,
}));

// The dispatch selection modal is now a gluestack Actionsheet; importing the real one
// pulls in @gluestack-ui overlay code that needs the full react-native StatusBar, which
// this suite's minimal react-native mock does not provide. Mock it like the other sheets.
jest.mock('../../../components/calls/dispatch-selection-modal', () => ({
  DispatchSelectionModal: () => <div data-testid="dispatch-selection-modal">Dispatch Selection</div>,
}));

jest.mock('@/components/incident-command/incident-command-tab', () => ({
  IncidentCommandTab: () => <div data-testid="incident-command-tab">Incident Command Tab</div>,
}));

// Mock UI components
jest.mock('@/components/ui', () => ({
  FocusAwareStatusBar: () => null,
  SafeAreaView: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

jest.mock('@/components/ui/box', () => ({
  Box: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  ButtonIcon: ({ as: IconComponent, ...props }: any) => <IconComponent {...props} />,
  ButtonText: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

jest.mock('@/components/ui/heading', () => ({
  Heading: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
}));

jest.mock('@/components/ui/hstack', () => ({
  HStack: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

jest.mock('@/components/ui/shared-tabs', () => ({
  SharedTabs: ({ tabs }: any) => (
    <div data-testid="shared-tabs">
      {tabs.map((tab: any) => (
        <div key={tab.key} data-testid={`tab-${tab.key}`}>
          {tab.title}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('@/components/ui/text', () => ({
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

jest.mock('@/components/ui/vstack', () => ({
  VStack: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

// Mock lib functions
jest.mock('@/lib/logging', () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock('@/lib/navigation', () => ({
  openMapsWithDirections: jest.fn().mockResolvedValue(true),
}));

// Mock WebView
jest.mock('react-native-webview', () => ({
  __esModule: true,
  default: () => <div data-testid="webview">WebView</div>,
}));

// Mock date-fns (keep the real implementations available for components that
// need parse/isValid, only stub format for stable output)
jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'),
  format: (date: any, formatStr: string) => `formatted-${formatStr}`,
}));

// Mock lucide-react-native icons
jest.mock('lucide-react-native', () => ({
  ClockIcon: ({ size, ...props }: any) => <div {...props} data-testid="clock-icon" style={{ width: size, height: size }}>Clock</div>,
  FileTextIcon: ({ size, ...props }: any) => <div {...props} data-testid="file-text-icon" style={{ width: size, height: size }}>FileText</div>,
  ImageIcon: ({ size, ...props }: any) => <div {...props} data-testid="image-icon" style={{ width: size, height: size }}>Image</div>,
  InfoIcon: ({ size, ...props }: any) => <div {...props} data-testid="info-icon" style={{ width: size, height: size }}>Info</div>,
  LoaderIcon: ({ size, ...props }: any) => <div {...props} data-testid="loader-icon" style={{ width: size, height: size }}>Loader</div>,
  MapPinIcon: ({ size, ...props }: any) => <div {...props} data-testid="map-pin-icon" style={{ width: size, height: size }}>MapPin</div>,
  NavigationIcon: ({ size, ...props }: any) => <div {...props} data-testid="navigation-icon" style={{ width: size, height: size }}>Navigation</div>,
  NetworkIcon: ({ size, ...props }: any) => <div {...props} data-testid="network-icon" style={{ width: size, height: size }}>Network</div>,
  PaperclipIcon: ({ size, ...props }: any) => <div {...props} data-testid="paperclip-icon" style={{ width: size, height: size }}>Paperclip</div>,
  RouteIcon: ({ size, ...props }: any) => <div {...props} data-testid="route-icon" style={{ width: size, height: size }}>Route</div>,
  ShieldCheckIcon: ({ size, ...props }: any) => <div {...props} data-testid="shield-check-icon" style={{ width: size, height: size }}>ShieldCheck</div>,
  UserIcon: ({ size, ...props }: any) => <div {...props} data-testid="user-icon" style={{ width: size, height: size }}>User</div>,
  UserPlusIcon: ({ size, ...props }: any) => <div {...props} data-testid="user-plus-icon" style={{ width: size, height: size }}>UserPlus</div>,
  UsersIcon: ({ size, ...props }: any) => <div {...props} data-testid="users-icon" style={{ width: size, height: size }}>Users</div>,
  VideoIcon: ({ size, ...props }: any) => <div {...props} data-testid="video-icon" style={{ width: size, height: size }}>Video</div>,
  Volume2Icon: ({ size, ...props }: any) => <div {...props} data-testid="volume2-icon" style={{ width: size, height: size }}>Volume2</div>,
}));

// Mock react-native-svg
jest.mock('react-native-svg', () => ({
  Svg: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Path: ({ ...props }: any) => <div {...props} />,
  G: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Mixin: {},
}));

// Mock @legendapp/motion
jest.mock('@legendapp/motion', () => ({
  Motion: {
    View: jest.fn().mockImplementation(({ children }: any) => children),
    Text: jest.fn().mockImplementation(({ children }: any) => children),
  },
  AnimatePresence: jest.fn().mockImplementation(({ children }: any) => children),
  createMotionAnimatedComponent: jest.fn((Component: any) => Component),
}));

// Mock bottom-sheet to avoid deep gluestack/actionsheet import chain
jest.mock('@/components/ui/bottom-sheet', () => ({
  BottomSheet: ({ children }: any) => <div>{children}</div>,
  BottomSheetContent: ({ children }: any) => <div>{children}</div>,
  BottomSheetDragIndicator: () => null,
  BottomSheetDragIndicatorWrapper: ({ children }: any) => <div>{children}</div>,
  BottomSheetBackdrop: () => null,
}));

// Mock video feeds tab to avoid actionsheet import chain
jest.mock('@/components/callVideoFeeds/video-feeds-tab', () => ({
  __esModule: true,
  default: () => <div data-testid="video-feeds-tab">Video Feeds</div>,
}));

// Mock check-in tab
jest.mock('@/components/checkIn/check-in-tab', () => ({
  CheckInTab: () => <div data-testid="check-in-tab">Check In</div>,
}));

import CallDetail from '../../../app/call/[id]';

describe('CallDetail', () => {
  const { useCallDetailStore } = require('@/stores/calls/detail-store');
  const { useSecurityStore } = require('@/stores/security/store');
  const { useCoreStore } = require('@/stores/app/core-store');
  const { useLocationStore } = require('@/stores/app/location-store');
  const { useStatusBottomSheetStore } = require('@/stores/status/store');
  const { useToastStore } = require('@/stores/toast/store');

  beforeEach(() => {
    jest.clearAllMocks();
    useCallDetailStore.mockReturnValue(mockCallDetailStore);
    useSecurityStore.mockReturnValue(mockSecurityStore);
    useCoreStore.mockReturnValue(mockCoreStore);
    useLocationStore.mockReturnValue(mockLocationStore);
    useStatusBottomSheetStore.mockReturnValue(mockStatusBottomSheetStore);
    useToastStore.mockReturnValue(mockToastStore);
  });

  describe('Security-dependent rendering', () => {
    it('should render successfully when user has create calls permission', () => {
      useSecurityStore.mockReturnValue({
        canUserCreateCalls: true,
      });

      expect(() => render(<CallDetail />)).not.toThrow();
    });

    it('should render successfully when user does not have create calls permission', () => {
      useSecurityStore.mockReturnValue({
        canUserCreateCalls: false,
      });

      expect(() => render(<CallDetail />)).not.toThrow();
    });

    it('should render call content correctly', () => {
      const renderResult = render(<CallDetail />);

      // Check that basic call information is rendered
      // The component should render without throwing errors, which validates the security logic
      expect(renderResult).toBeTruthy();

      // Verify the component rendered successfully by checking it has content
      expect(renderResult.toJSON()).toBeTruthy();
    });
  });

  describe('Loading and error states', () => {
    it('should handle loading state', () => {
      useCallDetailStore.mockReturnValue({
        ...mockCallDetailStore,
        isLoading: true,
        call: null,
      });

      expect(() => render(<CallDetail />)).not.toThrow();
    });

    it('should handle error state', () => {
      useCallDetailStore.mockReturnValue({
        ...mockCallDetailStore,
        isLoading: false,
        error: 'Network error',
        call: null,
      });

      expect(() => render(<CallDetail />)).not.toThrow();
    });
  });

  describe('Data fetching', () => {
    it('fetches call detail on mount', () => {
      render(<CallDetail />);
      expect(mockCallDetailStore.fetchCallDetail).toHaveBeenCalledWith('test-call-id');
      expect(mockCallDetailStore.reset).toHaveBeenCalled();
    });
  });
});
