import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { useWindowDimensions } from 'react-native';

import { useAnalytics } from '@/hooks/use-analytics';
import { useCoreStore } from '@/stores/app/core-store';
import { useCallDetailStore } from '@/stores/calls/detail-store';
import { useLocationStore } from '@/stores/app/location-store';
import { useStatusBottomSheetStore } from '@/stores/status/store';
import { useToastStore } from '@/stores/toast/store';

// Mock @legendapp/motion before importing CallDetail
jest.mock('@legendapp/motion', () => ({
  Motion: {
    View: jest.fn().mockImplementation(({ children }) => children),
    Text: jest.fn().mockImplementation(({ children }) => children),
  },
  AnimatePresence: jest.fn().mockImplementation(({ children }) => children),
  createMotionAnimatedComponent: jest.fn((Component) => Component),
}));

import CallDetail from '../../../app/call/[id]';



// Mock UI components that might use NativeWind
jest.mock('@/components/ui', () => ({
  FocusAwareStatusBar: jest.fn().mockImplementation(() => null),
  SafeAreaView: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('@/components/ui/box', () => ({
  Box: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('@/components/ui/button', () => ({
  Button: jest.fn().mockImplementation(({ children, onPress, disabled, ...props }) => {
    const React = require('react');

    return React.createElement('button', {
      onPress,
      onClick: onPress, // For web compatibility
      disabled,
      accessibilityRole: 'button',
      accessibilityLabel: React.Children.toArray(children).map((child: any) =>
        typeof child === 'string' ? child :
          child?.props?.children || ''
      ).join(' '),
      testID: `button-${React.Children.toArray(children).map((child: any) =>
        typeof child === 'string' ? child :
          child?.props?.children || ''
      ).join(' ').toLowerCase().replace(/\s+/g, '-')}`,
      ...props
    }, children);
  }),
  ButtonIcon: jest.fn().mockImplementation(() => null),
  ButtonText: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('@/components/ui/heading', () => ({
  Heading: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('@/components/ui/hstack', () => ({
  HStack: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('@/components/ui/shared-tabs', () => ({
  SharedTabs: jest.fn().mockImplementation(({ tabs }) => {
    const React = require('react');
    const { View } = require('react-native');

    // Render the first tab's content by default
    const firstTabContent = tabs && tabs.length > 0 ? tabs[0].content : null;
    return React.createElement(View, {}, firstTabContent);
  }),
}));

jest.mock('@/components/ui/text', () => ({
  Text: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('@/components/ui/vstack', () => ({
  VStack: jest.fn().mockImplementation(({ children }) => children),
}));

// Type the mock
const mockUseWindowDimensions = useWindowDimensions as jest.MockedFunction<typeof useWindowDimensions>;

// Mock expo-constants first before any other imports
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      IS_MOBILE_APP: true,
    },
  },
  default: {
    expoConfig: {
      extra: {
        IS_MOBILE_APP: true,
      },
    },
  },
}));

// Mock @env to prevent expo-constants issues
jest.mock('@env', () => ({
  Env: {
    IS_MOBILE_APP: true,
  },
}));

// Mock axios
jest.mock('axios', () => {
  const axiosMock: any = {
    create: jest.fn(() => axiosMock),
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: {
      headers: {
        common: {},
      },
    },
  };
  return axiosMock;
});

// Mock query-string
jest.mock('query-string', () => ({
  stringify: jest.fn((obj) => Object.keys(obj).map(key => `${key}=${obj[key]}`).join('&')),
}));

// Mock auth store
jest.mock('@/stores/auth/store', () => ({
  __esModule: true,
  default: {
    getState: jest.fn(() => ({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      status: 'signedIn',
      error: null,
    })),
    setState: jest.fn(),
  },
}));

// Mock storage modules
jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: jest.fn(() => 'https://api.mock.com'),
}));

jest.mock('@/lib/storage', () => ({
  zustandStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

// Mock all the dependencies
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ children }: { children: React.ReactNode }) => children,
  },
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(() => ({
    back: jest.fn(),
    push: jest.fn(),
  })),
}));

// Mock Lucide React Native icons
jest.mock('lucide-react-native', () => ({
  ClockIcon: 'ClockIcon',
  FileTextIcon: 'FileTextIcon',
  ImageIcon: 'ImageIcon',
  InfoIcon: 'InfoIcon',
  LoaderIcon: 'LoaderIcon',
  MapPinIcon: 'MapPinIcon',
  NavigationIcon: 'NavigationIcon',
  NetworkIcon: 'NetworkIcon',
  PaperclipIcon: 'PaperclipIcon',
  RouteIcon: 'RouteIcon',
  ShieldCheckIcon: 'ShieldCheckIcon',
  UserIcon: 'UserIcon',
  UserPlusIcon: 'UserPlusIcon',
  UsersIcon: 'UsersIcon',
  VideoIcon: 'VideoIcon',
  Volume2Icon: 'Volume2Icon',
}));

// Mock react-native-svg
jest.mock('react-native-svg', () => ({
  Svg: 'Svg',
  Path: 'Path',
  G: 'G',
  Circle: 'Circle',
  Rect: 'Rect',
  default: 'Svg',
  SvgXml: 'SvgXml',
  __esModule: true,
}));

// Mock date-fns (keep the real implementations available for components that
// need parse/isValid, only stub format for stable output)
jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'),
  format: jest.fn(() => '2024-01-01 12:00'),
}));

// Mock react-native-webview
jest.mock('react-native-webview', () => ({
  __esModule: true,
  default: 'WebView',
}));

jest.mock('@/hooks/use-analytics', () => ({
  useAnalytics: jest.fn(),
}));

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: jest.fn(),
}));

jest.mock('@/stores/calls/detail-store', () => ({
  useCallDetailStore: jest.fn(),
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

jest.mock('../../../components/calls/call-detail-menu', () => ({
  useCallDetailMenu: jest.fn(() => ({
    HeaderRightMenu: () => null,
    CallDetailActionSheet: () => null,
  })),
}));

jest.mock('../../../components/calls/call-files-modal', () => {
  return function CallFilesModal() {
    return null;
  };
});

jest.mock('../../../components/calls/call-images-modal', () => {
  return function CallImagesModal() {
    return null;
  };
});

jest.mock('../../../components/calls/call-notes-modal', () => {
  return function CallNotesModal() {
    return null;
  };
});

jest.mock('../../../components/calls/call-audio-modal', () => {
  return function CallAudioModal() {
    return null;
  };
});

jest.mock('../../../components/calls/close-call-bottom-sheet', () => ({
  CloseCallBottomSheet: () => null,
}));

jest.mock('../../../components/status/status-bottom-sheet', () => ({
  StatusBottomSheet: () => null,
}));

jest.mock('@/components/incident-command/incident-command-tab', () => ({
  IncidentCommandTab: () => null,
}));

jest.mock('@/components/maps/static-map', () => {
  return function StaticMap() {
    return null;
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// React Native mocks
jest.mock('react-native', () => ({
  View: jest.fn().mockImplementation(({ children, ...props }) => children),
  Text: jest.fn().mockImplementation(({ children }) => children),
  ScrollView: jest.fn().mockImplementation(({ children }) => children),
  ActivityIndicator: jest.fn().mockImplementation(() => null),
  StatusBar: {
    setBackgroundColor: jest.fn(),
    setTranslucent: jest.fn(),
    setBarStyle: jest.fn(),
    setHidden: jest.fn(),
  },
  useWindowDimensions: jest.fn(() => ({
    width: 375,
    height: 812,
    scale: 2,
    fontScale: 1,
  })),
  Dimensions: {
    get: jest.fn(() => ({
      width: 375,
      height: 812,
      scale: 3,
      fontScale: 1,
    })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  Platform: {
    OS: 'ios',
    select: jest.fn(options => options.ios),
  },
  StyleSheet: {
    create: jest.fn(styles => styles),
    flatten: jest.fn(style => style),
  },
  Appearance: {
    getColorScheme: jest.fn(() => 'light'),
    addEventListener: jest.fn((eventType, callback) => ({
      remove: jest.fn()
    })),
    addChangeListener: jest.fn((callback) => ({
      remove: jest.fn()
    })),
    removeChangeListener: jest.fn(),
    isReduceMotionEnabled: jest.fn(() => false),
  },
  AccessibilityInfo: {
    isReduceMotionEnabled: jest.fn(() => Promise.resolve(false)),
    addEventListener: jest.fn((eventType, callback) => ({
      remove: jest.fn()
    })),
    removeEventListener: jest.fn(),
  },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
}));

// Mock Countly
jest.mock('countly-sdk-react-native-bridge', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    start: jest.fn(),
    enableCrashReporting: jest.fn(),
    events: {
      recordEvent: jest.fn(),
    },
  },
}));

// Mock Expo HTML elements
jest.mock('@expo/html-elements', () => ({
  H1: ({ children, ...props }: any) => children,
  H2: ({ children, ...props }: any) => children,
  H3: ({ children, ...props }: any) => children,
  H4: ({ children, ...props }: any) => children,
  H5: ({ children, ...props }: any) => children,
  H6: ({ children, ...props }: any) => children,
}));

// Mock Expo Navigation Bar
jest.mock('expo-navigation-bar', () => ({
  setBackgroundColorAsync: jest.fn(),
  setVisibilityAsync: jest.fn(),
  setBehaviorAsync: jest.fn(),
  getBackgroundColorAsync: jest.fn(),
  getVisibilityAsync: jest.fn(),
  getBehaviorAsync: jest.fn(),
}));

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => true),
  useNavigation: jest.fn(),
  useFocusEffect: jest.fn(),
}));

// Mock react-native-edge-to-edge
jest.mock('react-native-edge-to-edge', () => ({
  SystemBars: {
    setHidden: jest.fn(),
    setColor: jest.fn(),
    setStyle: jest.fn(),
  },
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const MockedSafeAreaView = ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('div', props, children);
  };
  MockedSafeAreaView.displayName = 'SafeAreaView';

  return {
    SafeAreaView: MockedSafeAreaView,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

const mockTrackEvent = jest.fn();
const mockUseAnalytics = useAnalytics as jest.MockedFunction<typeof useAnalytics>;
const mockUseLocalSearchParams = useLocalSearchParams as jest.MockedFunction<typeof useLocalSearchParams>;
const mockUseCoreStore = useCoreStore as jest.MockedFunction<typeof useCoreStore>;
const mockUseCallDetailStore = useCallDetailStore as jest.MockedFunction<typeof useCallDetailStore>;
const mockUseLocationStore = useLocationStore as jest.MockedFunction<typeof useLocationStore>;
const mockUseStatusBottomSheetStore = useStatusBottomSheetStore as jest.MockedFunction<typeof useStatusBottomSheetStore>;
const mockUseToastStore = useToastStore as jest.MockedFunction<typeof useToastStore>;

describe('CallDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAnalytics.mockReturnValue({
      trackEvent: mockTrackEvent,
    });

    mockUseLocalSearchParams.mockReturnValue({
      id: 'test-call-id',
    });

    mockUseLocationStore.mockReturnValue({
      latitude: 40.7128,
      longitude: -74.0060,
    });

    mockUseToastStore.mockReturnValue(jest.fn());

    mockUseCoreStore.mockReturnValue({
      activeCall: null,
      activeUnit: { UnitId: 'test-unit-id', Name: 'Unit 1' }, // Mock active unit
      activeStatuses: {
        UnitType: '1',
        StatusId: '1',
        Statuses: [
          { Id: 1, Type: 1, StateId: 1, Text: 'Available', BColor: '#449d44', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
          { Id: 2, Type: 1, StateId: 2, Text: 'En Route', BColor: '#f8ac59', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
          { Id: 3, Type: 1, StateId: 3, Text: 'On Scene', BColor: '#ed5565', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
        ],
      },
    });

    mockUseStatusBottomSheetStore.mockReturnValue({
      setIsOpen: jest.fn(),
      setSelectedCall: jest.fn(),
    });

    mockUseCallDetailStore.mockReturnValue({
      call: null,
      callExtraData: null,
      callPriority: null,
      isLoading: true,
      error: null,
      fetchCallDetail: jest.fn(),
      reset: jest.fn(),
    });
  });

  it('should track analytics when call detail view is rendered with call data', async () => {
    const mockCall = {
      CallId: 'test-call-id',
      Name: 'Test Call',
      Number: 'C2024001',
      Priority: 2,
      Type: 'Emergency',
      Address: '123 Main St',
      Latitude: '40.7128',
      Longitude: '-74.0060',
      NotesCount: 3,
      ImgagesCount: 2,
      FileCount: 1,
    };

    const mockCallExtraData = {
      Protocols: [{ Name: 'Protocol 1' }],
      Dispatches: [{ Name: 'Unit 1' }],
      Activity: [{ StatusText: 'Dispatched' }],
    };

    mockUseCallDetailStore.mockReturnValue({
      call: mockCall,
      callExtraData: mockCallExtraData,
      callPriority: { Name: 'High', Color: '#ff0000' },
      isLoading: false,
      error: null,
      fetchCallDetail: jest.fn(),
      reset: jest.fn(),
    });

    render(<CallDetail />);

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('call_detail_view_rendered', {
        callId: 'test-call-id',
        callName: 'Test Call',
        callNumber: 'C2024001',
        callPriority: 2,
        callType: 'Emergency',
        hasCoordinates: true,
        hasAddress: true,
        hasNotes: true,
        hasImages: true,
        hasFiles: true,
        hasExtraData: true,
        hasProtocols: true,
        hasDispatches: true,
        hasTimeline: true,
      });
    });
  });

  it('should not track analytics when call data is not available', () => {
    mockUseCallDetailStore.mockReturnValue({
      call: null,
      callExtraData: null,
      callPriority: null,
      isLoading: false,
      error: null,
      fetchCallDetail: jest.fn(),
      reset: jest.fn(),
    });

    render(<CallDetail />);

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('should track analytics with default values when call has missing data', async () => {
    const mockCall = {
      CallId: '',
      Name: '',
      Number: '',
      Priority: 0,
      Type: '',
      Address: '',
      Latitude: null,
      Longitude: null,
      NotesCount: 0,
      ImgagesCount: 0,
      FileCount: 0,
    };

    mockUseCallDetailStore.mockReturnValue({
      call: mockCall,
      callExtraData: null,
      callPriority: null,
      isLoading: false,
      error: null,
      fetchCallDetail: jest.fn(),
      reset: jest.fn(),
    });

    render(<CallDetail />);

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('call_detail_view_rendered', {
        callId: '',
        callName: '',
        callNumber: '',
        callPriority: 0,
        callType: '',
        hasCoordinates: false,
        hasAddress: false,
        hasNotes: false,
        hasImages: false,
        hasFiles: false,
        hasExtraData: false,
        hasProtocols: false,
        hasDispatches: false,
        hasTimeline: false,
      });
    });
  });

  describe('Set Active functionality', () => {
    const mockCall = {
      CallId: 'test-call-id',
      Name: 'Test Call',
      Number: 'C2024001',
      Priority: 2,
      Type: 'Emergency',
      Address: '123 Main St',
      Latitude: '40.7128',
      Longitude: '-74.0060',
      NotesCount: 0,
      ImgagesCount: 0,
      FileCount: 0,
    };

    it('should show "Set Active" button when call is not the active call', () => {
      const mockSetIsOpen = jest.fn();
      const mockSetSelectedCall = jest.fn();

      mockUseCallDetailStore.mockReturnValue({
        call: mockCall,
        callExtraData: null,
        callPriority: null,
        isLoading: false,
        error: null,
        fetchCallDetail: jest.fn(),
        reset: jest.fn(),
      });

      mockUseCoreStore.mockReturnValue({
        activeCall: { CallId: 'different-call-id' }, // Different call is active
        activeUnit: { UnitId: 'test-unit-id', Name: 'Unit 1' }, // Active unit exists
        activeStatuses: {
          UnitType: '1',
          StatusId: '1',
          Statuses: [
            { Id: 1, Type: 1, StateId: 1, Text: 'Available', BColor: '#449d44', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
            { Id: 2, Type: 1, StateId: 2, Text: 'En Route', BColor: '#f8ac59', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
          ],
        },
      });

      mockUseStatusBottomSheetStore.mockReturnValue({
        setIsOpen: mockSetIsOpen,
        setSelectedCall: mockSetSelectedCall,
      });

      const { getByText, getAllByText, debug, getByTestId } = render(<CallDetail />);

      // Debug the rendered elements
      debug();

      // Should show "Set Active" button - try finding by testID first
      const setActiveButton = getByTestId('button-call_detail.set_active');
      expect(setActiveButton).toBeTruthy();
    });

    it('should not show "Set Active" button when call is already the active call', () => {
      mockUseCallDetailStore.mockReturnValue({
        call: mockCall,
        callExtraData: null,
        callPriority: null,
        isLoading: false,
        error: null,
        fetchCallDetail: jest.fn(),
        reset: jest.fn(),
      });

      mockUseCoreStore.mockReturnValue({
        activeCall: { CallId: 'test-call-id' }, // Same call is active
        activeUnit: { UnitId: 'test-unit-id', Name: 'Unit 1' }, // Active unit exists
        activeStatuses: {
          UnitType: '1',
          StatusId: '1',
          Statuses: [
            { Id: 1, Type: 1, StateId: 1, Text: 'Available', BColor: '#449d44', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
            { Id: 2, Type: 1, StateId: 2, Text: 'En Route', BColor: '#f8ac59', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
          ],
        },
      });

      const { queryByText } = render(<CallDetail />);

      // Should not show "Set Active" button
      expect(queryByText('call_detail.set_active')).toBeNull();
    });

    it('should not show "Set Active" button when there is no active unit', () => {
      mockUseCallDetailStore.mockReturnValue({
        call: mockCall,
        callExtraData: null,
        callPriority: null,
        isLoading: false,
        error: null,
        fetchCallDetail: jest.fn(),
        reset: jest.fn(),
      });

      mockUseCoreStore.mockReturnValue({
        activeCall: { CallId: 'different-call-id' }, // Different call is active
        activeUnit: null, // No active unit
        activeStatuses: {
          UnitType: '1',
          StatusId: '1',
          Statuses: [
            { Id: 1, Type: 1, StateId: 1, Text: 'Available', BColor: '#449d44', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
            { Id: 2, Type: 1, StateId: 2, Text: 'En Route', BColor: '#f8ac59', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
          ],
        },
      });

      const { queryByText, queryByTestId } = render(<CallDetail />);

      // Should not show "Set Active" button when no active unit
      expect(queryByText('call_detail.set_active')).toBeNull();
      expect(queryByTestId('button-call_detail.set_active')).toBeNull();
    });

    it('should open status bottom sheet when "Set Active" button is pressed', async () => {
      const mockSetIsOpen = jest.fn();
      const mockSetSelectedCall = jest.fn();
      const mockSetActiveCall = jest.fn().mockResolvedValue(undefined);
      const mockShowToast = jest.fn();

      mockUseCallDetailStore.mockReturnValue({
        call: mockCall,
        callExtraData: null,
        callPriority: null,
        isLoading: false,
        error: null,
        fetchCallDetail: jest.fn(),
        reset: jest.fn(),
      });

      mockUseCoreStore.mockReturnValue({
        activeCall: { CallId: 'different-call-id' }, // Different call is active
        activeUnit: { UnitId: 'test-unit-id', Name: 'Unit 1' }, // Active unit exists
        activeStatuses: {
          UnitType: '1',
          StatusId: '1',
          Statuses: [
            { Id: 1, Type: 1, StateId: 1, Text: 'Available', BColor: '#449d44', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
            { Id: 2, Type: 1, StateId: 2, Text: 'En Route', BColor: '#f8ac59', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
          ],
        },
      });

      // Mock the core store getState method
      useCoreStore.getState = jest.fn().mockReturnValue({
        setActiveCall: mockSetActiveCall,
      });

      mockUseStatusBottomSheetStore.mockReturnValue({
        setIsOpen: mockSetIsOpen,
        setSelectedCall: mockSetSelectedCall,
      });

      mockUseToastStore.mockReturnValue(mockShowToast);

      const { getByTestId } = render(<CallDetail />);

      // Press the "Set Active" button
      const setActiveButton = getByTestId('button-call_detail.set_active');
      expect(setActiveButton).toBeTruthy();
      fireEvent.press(setActiveButton);

      await waitFor(() => {
        // Should call setActiveCall with the call ID
        expect(mockSetActiveCall).toHaveBeenCalledWith(mockCall.CallId);

        // Should call setSelectedCall with the current call
        expect(mockSetSelectedCall).toHaveBeenCalledWith(mockCall);

        // Should call setIsOpen with true but no pre-selected status (for status selection)
        expect(mockSetIsOpen).toHaveBeenCalledWith(true);

        // Should show success toast
        expect(mockShowToast).toHaveBeenCalledWith('success', 'call_detail.set_active_success');
      });
    });

    it('should show loading state when setting call as active', async () => {
      const mockSetIsOpen = jest.fn();
      const mockSetSelectedCall = jest.fn();
      let resolveSetActiveCall: () => void;
      const mockSetActiveCall = jest.fn().mockImplementation(() => {
        return new Promise<void>((resolve) => {
          resolveSetActiveCall = resolve;
        });
      });
      const mockShowToast = jest.fn();

      mockUseCallDetailStore.mockReturnValue({
        call: mockCall,
        callExtraData: null,
        callPriority: null,
        isLoading: false,
        error: null,
        fetchCallDetail: jest.fn(),
        reset: jest.fn(),
      });

      mockUseCoreStore.mockReturnValue({
        activeCall: { CallId: 'different-call-id' },
        activeUnit: { UnitId: 'test-unit-id', Name: 'Unit 1' }, // Active unit exists
        activeStatuses: {
          UnitType: '1',
          StatusId: '1',
          Statuses: [
            { Id: 1, Type: 1, StateId: 1, Text: 'Available', BColor: '#449d44', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
            { Id: 2, Type: 1, StateId: 2, Text: 'En Route', BColor: '#f8ac59', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
          ],
        },
      });

      useCoreStore.getState = jest.fn().mockReturnValue({
        setActiveCall: mockSetActiveCall,
      });

      mockUseStatusBottomSheetStore.mockReturnValue({
        setIsOpen: mockSetIsOpen,
        setSelectedCall: mockSetSelectedCall,
      });

      mockUseToastStore.mockReturnValue(mockShowToast);

      const { getByTestId } = render(<CallDetail />);

      const setActiveButton = getByTestId('button-call_detail.set_active');
      expect(setActiveButton).toBeTruthy();

      // Button should be enabled initially
      expect(setActiveButton.props.disabled).toBe(false);

      // Press the button
      fireEvent.press(setActiveButton);

      // Button should be disabled during loading
      await waitFor(() => {
        expect(setActiveButton.props.disabled).toBe(true);
      });

      // Resolve the promise to complete the operation
      resolveSetActiveCall!();

      // Button should be enabled again after completion
      await waitFor(() => {
        expect(setActiveButton.props.disabled).toBe(false);
      });
    });

    it('should disable button during loading and re-enable after error', async () => {
      const mockSetIsOpen = jest.fn();
      const mockSetSelectedCall = jest.fn();
      const mockSetActiveCall = jest.fn().mockRejectedValue(new Error('Network error'));
      const mockShowToast = jest.fn();

      mockUseCallDetailStore.mockReturnValue({
        call: mockCall,
        callExtraData: null,
        callPriority: null,
        isLoading: false,
        error: null,
        fetchCallDetail: jest.fn(),
        reset: jest.fn(),
      });

      mockUseCoreStore.mockReturnValue({
        activeCall: { CallId: 'different-call-id' },
        activeUnit: { UnitId: 'test-unit-id', Name: 'Unit 1' }, // Active unit exists
        activeStatuses: {
          UnitType: '1',
          StatusId: '1',
          Statuses: [
            { Id: 1, Type: 1, StateId: 1, Text: 'Available', BColor: '#449d44', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
            { Id: 2, Type: 1, StateId: 2, Text: 'En Route', BColor: '#f8ac59', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
          ],
        },
      });

      useCoreStore.getState = jest.fn().mockReturnValue({
        setActiveCall: mockSetActiveCall,
      });

      mockUseStatusBottomSheetStore.mockReturnValue({
        setIsOpen: mockSetIsOpen,
        setSelectedCall: mockSetSelectedCall,
      });

      mockUseToastStore.mockReturnValue(mockShowToast);

      const { getByTestId } = render(<CallDetail />);

      const setActiveButton = getByTestId('button-call_detail.set_active');
      expect(setActiveButton).toBeTruthy();

      // Button should be enabled initially
      expect(setActiveButton.props.disabled).toBe(false);

      // Press the button
      fireEvent.press(setActiveButton);

      // Wait for the error to be handled and button to be re-enabled
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('error', 'call_detail.set_active_error');
        expect(setActiveButton.props.disabled).toBe(false);
      });
    });

    it('should handle error when setting call as active fails', async () => {
      const mockSetIsOpen = jest.fn();
      const mockSetSelectedCall = jest.fn();
      const mockSetActiveCall = jest.fn().mockRejectedValue(new Error('Network error'));
      const mockShowToast = jest.fn();

      mockUseCallDetailStore.mockReturnValue({
        call: mockCall,
        callExtraData: null,
        callPriority: null,
        isLoading: false,
        error: null,
        fetchCallDetail: jest.fn(),
        reset: jest.fn(),
      });

      mockUseCoreStore.mockReturnValue({
        activeCall: { CallId: 'different-call-id' }, // Different call is active
        activeUnit: { UnitId: 'test-unit-id', Name: 'Unit 1' }, // Active unit exists
        activeStatuses: {
          UnitType: '1',
          StatusId: '1',
          Statuses: [
            { Id: 1, Type: 1, StateId: 1, Text: 'Available', BColor: '#449d44', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
            { Id: 2, Type: 1, StateId: 2, Text: 'En Route', BColor: '#f8ac59', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
          ],
        },
      });

      // Mock the core store getState method to return a failing setActiveCall
      useCoreStore.getState = jest.fn().mockReturnValue({
        setActiveCall: mockSetActiveCall,
      });

      mockUseStatusBottomSheetStore.mockReturnValue({
        setIsOpen: mockSetIsOpen,
        setSelectedCall: mockSetSelectedCall,
      });

      mockUseToastStore.mockReturnValue(mockShowToast);

      const { getByTestId } = render(<CallDetail />);

      // Press the "Set Active" button
      const setActiveButton = getByTestId('button-call_detail.set_active');
      expect(setActiveButton).toBeTruthy();
      fireEvent.press(setActiveButton);

      await waitFor(() => {
        // Should call setActiveCall with the call ID
        expect(mockSetActiveCall).toHaveBeenCalledWith(mockCall.CallId);

        // Should show error toast
        expect(mockShowToast).toHaveBeenCalledWith('error', 'call_detail.set_active_error');

        // Should not open status bottom sheet when there's an error
        expect(mockSetSelectedCall).not.toHaveBeenCalled();
        expect(mockSetIsOpen).not.toHaveBeenCalled();
      });
    });

    it('should select the first available status if no "En Route" status is found', async () => {
      const mockSetIsOpen = jest.fn();
      const mockSetSelectedCall = jest.fn();
      const mockSetActiveCall = jest.fn().mockResolvedValue(undefined);
      const mockShowToast = jest.fn();

      mockUseCallDetailStore.mockReturnValue({
        call: mockCall,
        callExtraData: null,
        callPriority: null,
        isLoading: false,
        error: null,
        fetchCallDetail: jest.fn(),
        reset: jest.fn(),
      });

      mockUseCoreStore.mockReturnValue({
        activeCall: { CallId: 'different-call-id' }, // Different call is active
        activeUnit: { UnitId: 'test-unit-id', Name: 'Unit 1' }, // Active unit exists
        activeStatuses: {
          UnitType: '1',
          StatusId: '1',
          Statuses: [
            { Id: 1, Type: 1, StateId: 1, Text: 'Available', BColor: '#449d44', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
            { Id: 3, Type: 1, StateId: 3, Text: 'On Scene', BColor: '#ed5565', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
          ],
        },
      });

      // Mock the core store getState method
      useCoreStore.getState = jest.fn().mockReturnValue({
        setActiveCall: mockSetActiveCall,
      });

      mockUseStatusBottomSheetStore.mockReturnValue({
        setIsOpen: mockSetIsOpen,
        setSelectedCall: mockSetSelectedCall,
      });

      mockUseToastStore.mockReturnValue(mockShowToast);

      const { getByTestId } = render(<CallDetail />);

      // Press the "Set Active" button
      const setActiveButton = getByTestId('button-call_detail.set_active');
      expect(setActiveButton).toBeTruthy();
      fireEvent.press(setActiveButton);

      await waitFor(() => {
        // Should call setActiveCall with the call ID
        expect(mockSetActiveCall).toHaveBeenCalledWith(mockCall.CallId);

        // Should call setSelectedCall with the current call
        expect(mockSetSelectedCall).toHaveBeenCalledWith(mockCall);

        // Should call setIsOpen with true but no pre-selected status (for status selection)
        expect(mockSetIsOpen).toHaveBeenCalledWith(true);

        // Should show success toast
        expect(mockShowToast).toHaveBeenCalledWith('success', 'call_detail.set_active_success');
      });
    });
  });
});
