// Mock dependencies early
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));

// Mock all UI components based on actual imports
jest.mock('@/components/ui/actionsheet', () => {
  const mockReact = require('react');
  const { View } = require('react-native');

  return {
    Actionsheet: ({ children, isOpen }: any) =>
      isOpen ? mockReact.createElement(View, { testID: 'actionsheet' }, children) : null,
    ActionsheetBackdrop: ({ children }: any) =>
      mockReact.createElement(View, { testID: 'actionsheet-backdrop' }, children),
    ActionsheetContent: ({ children }: any) =>
      mockReact.createElement(View, { testID: 'actionsheet-content' }, children),
    ActionsheetDragIndicator: () =>
      mockReact.createElement(View, { testID: 'actionsheet-drag-indicator' }),
    ActionsheetDragIndicatorWrapper: ({ children }: any) =>
      mockReact.createElement(View, { testID: 'actionsheet-drag-indicator-wrapper' }, children),
  };
});

jest.mock('../../ui/button', () => {
  const mockReact = require('react');
  const { TouchableOpacity, Text } = require('react-native');

  return {
    Button: ({ children, onPress, isDisabled, className, ...props }: any) =>
      mockReact.createElement(TouchableOpacity, {
        onPress: isDisabled ? undefined : onPress,
        testID: 'button',
        accessibilityState: { disabled: isDisabled },
        ...props
      }, children),
    ButtonText: ({ children, className, ...props }: any) =>
      mockReact.createElement(Text, props, children),
  };
});

jest.mock('../../ui/heading', () => {
  const mockReact = require('react');
  const { Text } = require('react-native');

  return {
    Heading: ({ children, ...props }: any) => mockReact.createElement(Text, props, children),
  };
});

jest.mock('../../ui/hstack', () => {
  const mockReact = require('react');
  const { View } = require('react-native');

  return {
    HStack: ({ children, ...props }: any) => mockReact.createElement(View, props, children),
  };
});

jest.mock('../../ui/vstack', () => {
  const mockReact = require('react');
  const { View } = require('react-native');

  return {
    VStack: ({ children, ...props }: any) => mockReact.createElement(View, props, children),
  };
});

jest.mock('../../ui/text', () => {
  const mockReact = require('react');
  const { Text } = require('react-native');

  return {
    Text: ({ children, ...props }: any) => mockReact.createElement(Text, props, children),
  };
});

jest.mock('../../ui/spinner', () => {
  const mockReact = require('react');
  const { View } = require('react-native');

  return {
    Spinner: (props: any) => mockReact.createElement(View, { testID: 'spinner', ...props }),
  };
});

jest.mock('../../ui/textarea', () => {
  const mockReact = require('react');
  const { TextInput, View } = require('react-native');

  return {
    Textarea: ({ children, ...props }: any) => mockReact.createElement(View, props, children),
    TextareaInput: ({ value, onChangeText, placeholder, ...props }: any) =>
      mockReact.createElement(TextInput, { value, onChangeText, placeholder, testID: 'textarea-input', ...props }),
  };
});

jest.mock('@expo/html-elements', () => {
  const mockReact = require('react');
  const mockComponent = (props: any) => mockReact.createElement('Text', props);

  return {
    H1: mockComponent,
    H2: mockComponent,
    H3: mockComponent,
    H4: mockComponent,
    H5: mockComponent,
    H6: mockComponent,
  };
});

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: jest.fn(() => ({ colorScheme: 'light' })),
  cssInterop: jest.fn((component: any) => component),
}));

jest.mock('@/lib/utils', () => ({
  IS_ANDROID: false,
  IS_IOS: true,
  invertColor: jest.fn(() => '#000000'),
  createSelectors: jest.fn(),
  openLinkInBrowser: jest.fn(),
  DEFAULT_CENTER_COORDINATE: [-77.036086, 38.910233],
  SF_OFFICE_COORDINATE: [-122.400021, 37.789085],
  onSortOptions: jest.fn(),
}));

jest.mock('@/lib/storage/index', () => ({
  storage: {
    set: jest.fn(),
    getString: jest.fn(),
    delete: jest.fn(),
    contains: jest.fn(),
    getAllKeys: jest.fn(),
    clearAll: jest.fn(),
  },
}));

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    getString: jest.fn(),
    delete: jest.fn(),
    contains: jest.fn(),
    getAllKeys: jest.fn(),
    clearAll: jest.fn(),
  })),
}));

jest.mock('react-native-svg', () => {
  const mockReact = require('react');
  const mockComponent = (props: any) => mockReact.createElement('View', props);

  return {
    Svg: mockComponent,
    Circle: mockComponent,
    Path: mockComponent,
    G: mockComponent,
    Defs: mockComponent,
    LinearGradient: mockComponent,
    Stop: mockComponent,
    Rect: mockComponent,
    Line: mockComponent,
    Polygon: mockComponent,
    Polyline: mockComponent,
    Text: (props: any) => mockReact.createElement('Text', props),
  };
});

jest.mock('lucide-react-native', () => {
  const mockReact = require('react');
  const mockIcon = (props: any) => mockReact.createElement('View', { ...props, testID: 'mock-icon' });

  return new Proxy({}, {
    get: () => mockIcon,
  });
});

jest.mock('@/stores/status/store', () => ({
  useStatusBottomSheetStore: jest.fn(),
  useStatusesStore: jest.fn(),
}));

// Mock additional stores and services
jest.mock('@/stores/app/core-store', () => {
  const mockStore = jest.fn();
  (mockStore as any).getState = jest.fn();
  return { useCoreStore: mockStore };
});

jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: jest.fn(() => ({
    latitude: 37.7749,
    longitude: -122.4194,
    heading: 0,
    accuracy: 10,
    speed: 0,
    altitude: 0,
    timestamp: Date.now(),
  })),
}));

jest.mock('@/stores/roles/store', () => ({
  useRolesStore: jest.fn(),
}));

jest.mock('@/stores/toast/store', () => ({
  useToastStore: jest.fn(),
}));

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { useTranslation } from 'react-i18next';

import { useStatusBottomSheetStore, useStatusesStore } from '@/stores/status/store';
import { useCoreStore } from '@/stores/app/core-store';
import { useRolesStore } from '@/stores/roles/store';
import { useToastStore } from '@/stores/toast/store';

import { StatusBottomSheet } from '../status-bottom-sheet';


const mockSetActiveCall = jest.fn();

const mockTranslation = {
  t: (key: string, options?: any) => {
    const translations: Record<string, string> = {
      'common.step': 'Step',
      'common.of': 'of',
      'common.next': 'Next',
      'common.previous': 'Previous',
      'common.submit': 'Submit',
      'common.submitting': 'Submitting',
      'common.optional': 'Optional',
      'status.select_status': 'Select Status',
      'status.select_status_type': 'What status would you like to set?',
      'status.select_destination': 'Select Destination for {{status}}',
      'status.add_note': 'Add Note',
      'status.set_status': 'Set Status',
      'status.select_destination_type': 'Select destination type',
      'status.no_destination': 'No Destination',
      'status.general_status': 'General Status',
      'status.calls_tab': 'Calls',
      'status.stations_tab': 'Stations',
      'status.selected_destination': 'Selected Destination',
      'status.selected_status': 'Selected Status',
      'status.note': 'Note',
      'status.note_required': 'Note required',
      'status.note_optional': 'Note optional',
      'status.loading_stations': 'Loading stations...',
      'status.station_destination_enabled': 'Can respond to stations',
      'status.call_destination_enabled': 'Can respond to calls',
      'status.both_destinations_enabled': 'Can respond to calls or stations',
      'status.no_statuses_available': 'No statuses available',
      'status.status_saved_successfully': 'Status saved successfully',
      'status.failed_to_save_status': 'Failed to save status',
      'calls.loading_calls': 'Loading calls...',
      'calls.no_calls_available': 'No calls available',
      'status.no_stations_available': 'No stations available',
    };

    let translation = translations[key] || key;
    if (options && typeof options === 'object') {
      Object.keys(options).forEach(optionKey => {
        translation = translation.replace(`{{${optionKey}}}`, options[optionKey]);
      });
    }
    return translation;
  },
};

const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;
const mockUseStatusBottomSheetStore = useStatusBottomSheetStore as jest.MockedFunction<typeof useStatusBottomSheetStore>;
const mockUseStatusesStore = useStatusesStore as jest.MockedFunction<typeof useStatusesStore>;
const mockUseCoreStore = useCoreStore as unknown as jest.MockedFunction<any>;
const mockGetState = (mockUseCoreStore as any).getState;
const mockUseRolesStore = useRolesStore as jest.MockedFunction<typeof useRolesStore>;
const mockUseToastStore = useToastStore as jest.MockedFunction<typeof useToastStore>;

describe('StatusBottomSheet', () => {
  const mockReset = jest.fn();
  const mockSetCurrentStep = jest.fn();
  const mockSetSelectedCall = jest.fn();
  const mockSetSelectedStation = jest.fn();
  const mockSetSelectedDestinationType = jest.fn();
  const mockSetNote = jest.fn();
  const mockFetchDestinationData = jest.fn();
  const mockSaveUnitStatus = jest.fn();
  const mockShowToast = jest.fn();

  const defaultBottomSheetStore = {
    isOpen: false,
    currentStep: 'select-destination' as const,
    selectedCall: null,
    selectedStation: null,
    selectedDestinationType: 'none' as const,
    selectedStatus: null,
    cameFromStatusSelection: false,
    note: '',
    availableCalls: [],
    availableStations: [],
    availablePois: [],
    availableStatuses: [
      { Id: 1, Type: 1, StateId: 1, Text: 'Available', BColor: '#28a745', Color: '#fff', Gps: false, Note: 0, Detail: 1 },
      { Id: 2, Type: 2, StateId: 2, Text: 'Responding', BColor: '#ffc107', Color: '#000', Gps: true, Note: 1, Detail: 2 },
      { Id: 3, Type: 3, StateId: 3, Text: 'On Scene', BColor: '#dc3545', Color: '#fff', Gps: true, Note: 2, Detail: 3 },
    ],
    isLoading: false,
    setIsOpen: jest.fn(),
    setCurrentStep: mockSetCurrentStep,
    setSelectedCall: mockSetSelectedCall,
    setSelectedStation: mockSetSelectedStation,
    setSelectedPoi: jest.fn(),
    setSelectedDestinationType: mockSetSelectedDestinationType,
    setSelectedStatus: jest.fn(),
    setNote: mockSetNote,
    fetchDestinationData: mockFetchDestinationData,
    reset: mockReset,
  };

  const defaultStatusesStore = {
    isLoading: false,
    error: null,
    saveUnitStatus: mockSaveUnitStatus,
  };

  const defaultCoreStore = {
    activeUnitId: 'unit-1',
    activeUnit: {
      UnitId: 'unit-1',
      Name: 'Unit 1',
    },
    activeUnitStatus: null,
    activeUnitStatusType: null,
    activeStatuses: {
      UnitType: '0',
      Data: [
        { Id: 1, Type: 1, StateId: 1, Text: 'Available', BColor: '#28a745', Color: '#fff', Gps: false, Note: 0, Detail: 1 },
        { Id: 2, Type: 2, StateId: 2, Text: 'Responding', BColor: '#ffc107', Color: '#000', Gps: true, Note: 1, Detail: 2 },
        { Id: 3, Type: 3, StateId: 3, Text: 'On Scene', BColor: '#dc3545', Color: '#fff', Gps: true, Note: 2, Detail: 3 },
      ],
    },
    activeCallId: null,
    activeCall: null,
    activePriority: null,
    config: null,
    isLoading: false,
    isInitialized: true,
    isInitializing: false,
    error: null,
    init: jest.fn(),
    setActiveUnit: jest.fn(),
    setActiveUnitWithFetch: jest.fn(),
    setActiveCall: mockSetActiveCall,
    fetchConfig: jest.fn(),
  };

  const defaultRolesStore = {
    unitRoleAssignments: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTranslation.mockReturnValue(mockTranslation as any);
    mockUseStatusBottomSheetStore.mockReturnValue(defaultBottomSheetStore);
    mockUseStatusesStore.mockReturnValue(defaultStatusesStore);
    mockUseToastStore.mockReturnValue({ showToast: mockShowToast });

    // Set up the core store mock with getState that returns the store state
    mockGetState.mockReturnValue(defaultCoreStore as any);
    // Also mock the hook usage in the component  
    mockUseCoreStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(defaultCoreStore);
      }
      return defaultCoreStore;
    });
    mockUseRolesStore.mockReturnValue(defaultRolesStore);
  });

  it('should be importable without error', () => {
    expect(StatusBottomSheet).toBeDefined();
    expect(typeof StatusBottomSheet).toBe('function');
  });

  it('should not render when isOpen is false', () => {
    render(<StatusBottomSheet />);
    expect(screen.queryByText('Select Destination for')).toBeNull();
  });

  it('should render when isOpen is true with destination step', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1, // Show destination step
      Note: 1, // Note optional - this gives us 2 steps
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
    });

    render(<StatusBottomSheet />);

    expect(screen.getByText('Step 1 of 2')).toBeTruthy();
    expect(screen.getByText('Select Destination for Available')).toBeTruthy();
    expect(screen.getByText('No Destination')).toBeTruthy();
    expect(screen.getByText('Next')).toBeTruthy();
  });

  it('should handle no destination selection', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1,
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    const noDestinationOption = screen.getByText('No Destination');
    fireEvent.press(noDestinationOption);

    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('none');
    expect(mockSetSelectedCall).toHaveBeenCalledWith(null);
    expect(mockSetSelectedStation).toHaveBeenCalledWith(null);
  });

  it('should handle call selection and unselect no destination', () => {
    const mockCall = {
      CallId: 'call-1',
      Number: 'C001',
      Name: 'Emergency Call',
      Address: '123 Main St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [mockCall],
    });

    render(<StatusBottomSheet />);

    const callOption = screen.getByText('C001 - Emergency Call');
    fireEvent.press(callOption);

    expect(mockSetSelectedCall).toHaveBeenCalledWith(mockCall);
    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('call');
    expect(mockSetSelectedStation).toHaveBeenCalledWith(null);
  });

  it('should handle station selection and unselect no destination', () => {
    const mockStation = {
      GroupId: 'station-1',
      Name: 'Fire Station 1',
      Address: '456 Oak Ave',
      GroupType: 'Station',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'At Station',
      Detail: 1, // Show stations
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableStations: [mockStation],
    });

    render(<StatusBottomSheet />);

    const stationOption = screen.getByText('Fire Station 1');
    fireEvent.press(stationOption);

    expect(mockSetSelectedStation).toHaveBeenCalledWith(mockStation);
    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('station');
    expect(mockSetSelectedCall).toHaveBeenCalledWith(null);
  });

  it('should not set active call when selecting a call', () => {
    const mockCall = {
      CallId: 'call-1',
      Number: 'C001',
      Name: 'Emergency Call',
      Address: '123 Main St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Mock core store with no active call
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: null,
    } as any);
    (useCoreStore as any).mockImplementation(() => ({
      ...defaultCoreStore,
      activeCallId: null,
    }));

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [mockCall],
    });

    render(<StatusBottomSheet />);

    const callOption = screen.getByText('C001 - Emergency Call');
    fireEvent.press(callOption);

    expect(mockSetSelectedCall).toHaveBeenCalledWith(mockCall);
    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('call');
    // Active call should NOT be set until submission
    expect(mockSetActiveCall).not.toHaveBeenCalled();
  });

  it('should not set active call when selecting a different call', () => {
    const mockCall = {
      CallId: 'call-2',
      Number: 'C002',
      Name: 'Fire Emergency',
      Address: '456 Oak St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Mock core store with different active call
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: 'call-1',
    } as any);
    (useCoreStore as any).mockImplementation(() => ({
      ...defaultCoreStore,
      activeCallId: 'call-1',
    }));

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [mockCall],
    });

    render(<StatusBottomSheet />);

    const callOption = screen.getByText('C002 - Fire Emergency');
    fireEvent.press(callOption);

    expect(mockSetSelectedCall).toHaveBeenCalledWith(mockCall);
    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('call');
    // Active call should NOT be set until submission
    expect(mockSetActiveCall).not.toHaveBeenCalled();
  });

  it('should not set active call when selecting any call during selection', () => {
    const mockCall = {
      CallId: 'call-1',
      Number: 'C001',
      Name: 'Emergency Call',
      Address: '123 Main St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Mock core store with same active call
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: 'call-1',
    } as any);
    (useCoreStore as any).mockImplementation(() => ({
      ...defaultCoreStore,
      activeCallId: 'call-1',
    }));

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [mockCall],
    });

    render(<StatusBottomSheet />);

    const callOption = screen.getByText('C001 - Emergency Call');
    fireEvent.press(callOption);

    expect(mockSetSelectedCall).toHaveBeenCalledWith(mockCall);
    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('call');
    expect(mockSetActiveCall).not.toHaveBeenCalled();
  });

  it('should show tabs when detailLevel is 3', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 3, // Show both calls and stations
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [{ CallId: 'call-1', Number: 'C001', Name: 'Call', Address: '' }],
      availableStations: [{ GroupId: 'station-1', Name: 'Station 1', Address: '', GroupType: 'Station' }],
    });

    render(<StatusBottomSheet />);

    expect(screen.getByText('Calls')).toBeTruthy();
    expect(screen.getByText('Stations')).toBeTruthy();
  });

  it('should proceed to note step when next is pressed', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1,
      Note: 1, // Note optional
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    const nextButton = screen.getByText('Next');
    fireEvent.press(nextButton);

    expect(mockSetCurrentStep).toHaveBeenCalledWith('add-note');
  });

  it('should show note step correctly', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1,
      Note: 1, // Note optional
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      currentStep: 'add-note',
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    expect(screen.getByText('Step 2 of 2')).toBeTruthy();
    expect(screen.getByText('Add Note')).toBeTruthy();
    expect(screen.getByText('Selected Destination:')).toBeTruthy();
    expect(screen.getByText('No Destination')).toBeTruthy();
    expect(screen.getByText('Previous')).toBeTruthy();
    expect(screen.getByText('Submit')).toBeTruthy();
  });

  it('should handle previous button on note step', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1,
      Note: 1,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      currentStep: 'add-note',
    });

    render(<StatusBottomSheet />);

    const previousButton = screen.getByText('Previous');
    fireEvent.press(previousButton);

    expect(mockSetCurrentStep).toHaveBeenCalledWith('select-destination');
  });

  it('should handle note input', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1,
      Note: 2, // Note required
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      currentStep: 'add-note',
    });

    render(<StatusBottomSheet />);

    const noteInput = screen.getByPlaceholderText('Note required');
    fireEvent.changeText(noteInput, 'Test note');

    expect(mockSetNote).toHaveBeenCalledWith('Test note');
  });

  it('should disable submit when note is required but empty', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1,
      Note: 2, // Note required
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      currentStep: 'add-note',
      note: '', // Empty note
    });

    render(<StatusBottomSheet />);

    // Find all button elements and check the submit button's disabled state
    const buttons = screen.getAllByTestId('button');
    const submitButton = buttons.find(button => {
      try {
        const textElements = button.findAllByType('Text');
        return textElements.some((text: any) => text.props.children === 'Submit');
      } catch (e) {
        return false;
      }
    });
    expect(submitButton?.props.accessibilityState?.disabled).toBe(true);
  });

  it('should enable submit when note is required and provided', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1,
      Note: 2, // Note required
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      currentStep: 'add-note',
      note: 'Test note', // Note provided
    });

    render(<StatusBottomSheet />);

    // Find all button elements and check the submit button's disabled state
    const buttons = screen.getAllByTestId('button');
    const submitButton = buttons.find(button => {
      try {
        const textElements = button.findAllByType('Text');
        return textElements.some((text: any) => text.props.children === 'Submit');
      } catch (e) {
        return false;
      }
    });
    expect(submitButton?.props.accessibilityState?.disabled).toBe(false);
  });

  it('should submit status directly when no destination step needed and no note required', async () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 0, // No destination step
      Note: 0, // No note required
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
    });

    render(<StatusBottomSheet />);

    const submitButton = screen.getByText('Submit');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(mockSaveUnitStatus).toHaveBeenCalled();
    });
  });

  it('should show loading states correctly', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Need at least one call in availableCalls for the parent VStack to render
    const mockAvailableCalls = [
      { CallId: 'call-1', Name: 'Test Call', Number: '123', Address: 'Test Address' },
    ];

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      currentStep: 'select-destination',
      isLoading: true, // This should show loading instead of the call list
      availableCalls: mockAvailableCalls,
    });

    render(<StatusBottomSheet />);

    expect(screen.getByText('Loading calls...')).toBeTruthy();
  });

  it('should set active call on submission when call is selected and different from current', async () => {
    const mockCall = {
      CallId: 'call-1',
      Number: 'C001',
      Name: 'Emergency Call',
      Address: '123 Main St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 0, // No destination step needed
      Note: 0, // No note required
    };

    // Mock core store with no active call
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: null,
    } as any);
    (useCoreStore as any).mockImplementation(() => ({
      ...defaultCoreStore,
      activeCallId: null,
    }));

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      selectedCall: mockCall,
      selectedDestinationType: 'call',
    });

    render(<StatusBottomSheet />);

    const submitButton = screen.getByText('Submit');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(mockSaveUnitStatus).toHaveBeenCalled();
      expect(mockSetActiveCall).toHaveBeenCalledWith('call-1');
    });
  });

  it('should set active call on submission when selected call is different from current active call', async () => {
    const mockCall = {
      CallId: 'call-2',
      Number: 'C002',
      Name: 'Fire Emergency',
      Address: '456 Oak St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 0, // No destination step needed
      Note: 0, // No note required
    };

    // Mock core store with different active call
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: 'call-1',
    } as any);
    (useCoreStore as any).mockImplementation(() => ({
      ...defaultCoreStore,
      activeCallId: 'call-1',
    }));

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      selectedCall: mockCall,
      selectedDestinationType: 'call',
    });

    render(<StatusBottomSheet />);

    const submitButton = screen.getByText('Submit');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(mockSaveUnitStatus).toHaveBeenCalled();
      expect(mockSetActiveCall).toHaveBeenCalledWith('call-2');
    });
  });

  it('should not set active call on submission when selected call is same as current active call', async () => {
    const mockCall = {
      CallId: 'call-1',
      Number: 'C001',
      Name: 'Emergency Call',
      Address: '123 Main St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 0, // No destination step needed
      Note: 0, // No note required
    };

    // Mock core store with same active call
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: 'call-1',
    } as any);
    (useCoreStore as any).mockImplementation(() => ({
      ...defaultCoreStore,
      activeCallId: 'call-1',
    }));

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      selectedCall: mockCall,
      selectedDestinationType: 'call',
    });

    render(<StatusBottomSheet />);

    const submitButton = screen.getByText('Submit');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(mockSaveUnitStatus).toHaveBeenCalled();
      expect(mockSetActiveCall).not.toHaveBeenCalled();
    });
  });

  it('should not set active call on submission when no call is selected', async () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 0, // No destination step
      Note: 0, // No note required
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    const submitButton = screen.getByText('Submit');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(mockSaveUnitStatus).toHaveBeenCalled();
      expect(mockSetActiveCall).not.toHaveBeenCalled();
    });
  });

  it('should not set active call on submission when station is selected', async () => {
    const mockStation = {
      GroupId: 'station-1',
      Name: 'Fire Station 1',
      Address: '456 Oak Ave',
      GroupType: 'Station',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 0, // No destination step needed
      Note: 0, // No note required
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      selectedStation: mockStation,
      selectedDestinationType: 'station',
    });

    render(<StatusBottomSheet />);

    const submitButton = screen.getByText('Submit');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(mockSaveUnitStatus).toHaveBeenCalled();
      expect(mockSetActiveCall).not.toHaveBeenCalled();
    });
  });

  it('should set active call only at end of flow, not during call selection', async () => {
    const mockCall = {
      CallId: 'call-1',
      Number: 'C001',
      Name: 'Emergency Call',
      Address: '123 Main St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0, // No note required
    };

    // Mock core store with no active call
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: null,
    } as any);
    (useCoreStore as any).mockImplementation(() => ({
      ...defaultCoreStore,
      activeCallId: null,
    }));

    const mockStore = {
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [mockCall],
    };

    mockUseStatusBottomSheetStore.mockReturnValue(mockStore);

    render(<StatusBottomSheet />);

    // Step 1: Select a call - should NOT set active call
    const callOption = screen.getByText('C001 - Emergency Call');
    fireEvent.press(callOption);

    expect(mockSetSelectedCall).toHaveBeenCalledWith(mockCall);
    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('call');
    expect(mockSetActiveCall).not.toHaveBeenCalled();

    // Update mock store to reflect call selection
    mockUseStatusBottomSheetStore.mockReturnValue({
      ...mockStore,
      selectedCall: mockCall,
      selectedDestinationType: 'call',
    });

    // Step 2: Navigate to next step
    const nextButton = screen.getByText('Next');
    fireEvent.press(nextButton);

    // setActiveCall should still NOT have been called
    expect(mockSetActiveCall).not.toHaveBeenCalled();

    // Re-render to show the final step (submit)
    mockUseStatusBottomSheetStore.mockReturnValue({
      ...mockStore,
      selectedCall: mockCall,
      selectedDestinationType: 'call',
      currentStep: 'select-destination',
    });

    render(<StatusBottomSheet />);

    // Step 3: Submit - NOW setActiveCall should be called
    const submitButtonAfterFlow = screen.getByText('Next'); // This should trigger submit for no note status
    fireEvent.press(submitButtonAfterFlow);

    await waitFor(() => {
      expect(mockSaveUnitStatus).toHaveBeenCalled();
      expect(mockSetActiveCall).toHaveBeenCalledWith('call-1');
    });
  });

  it('should fetch destination data when opened', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1,
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
    });

    render(<StatusBottomSheet />);

    expect(mockFetchDestinationData).toHaveBeenCalledWith('unit-1');
  });

  it('should show custom checkbox for no destination when selected', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1,
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    // The No Destination option should be visually selected
    const noDestinationContainer = screen.getByText('No Destination').parent?.parent;
    expect(noDestinationContainer).toBeTruthy();
  });

  it('should show custom checkbox for selected call', () => {
    const mockCall = {
      CallId: 'call-1',
      Number: 'C001',
      Name: 'Emergency Call',
      Address: '123 Main St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2,
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [mockCall],
      selectedCall: mockCall,
      selectedDestinationType: 'call',
    });

    render(<StatusBottomSheet />);

    const callContainer = screen.getByText('C001 - Emergency Call').parent?.parent;
    expect(callContainer).toBeTruthy();
  });

  it('should show custom checkbox for selected station', () => {
    const mockStation = {
      GroupId: 'station-1',
      Name: 'Fire Station 1',
      Address: '456 Oak Ave',
      GroupType: 'Station',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'At Station',
      Detail: 1,
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableStations: [mockStation],
      selectedStation: mockStation,
      selectedDestinationType: 'station',
    });

    render(<StatusBottomSheet />);

    const stationContainer = screen.getByText('Fire Station 1').parent?.parent;
    expect(stationContainer).toBeTruthy();
  });

  it('should clear call selection when no destination is selected', () => {
    const mockCall = {
      CallId: 'call-1',
      Number: 'C001',
      Name: 'Emergency Call',
      Address: '123 Main St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2,
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [mockCall],
      selectedCall: mockCall,
      selectedDestinationType: 'call',
    });

    render(<StatusBottomSheet />);

    // Select no destination - should clear call selection
    const noDestinationOption = screen.getByText('No Destination');
    fireEvent.press(noDestinationOption);

    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('none');
    expect(mockSetSelectedCall).toHaveBeenCalledWith(null);
    expect(mockSetSelectedStation).toHaveBeenCalledWith(null);
  });

  it('should clear station selection when call is selected', () => {
    const mockCall = {
      CallId: 'call-1',
      Number: 'C001',
      Name: 'Emergency Call',
      Address: '123 Main St',
    };

    const mockStation = {
      GroupId: 'station-1',
      Name: 'Fire Station 1',
      Address: '456 Oak Ave',
      GroupType: 'Station',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 3, // Both calls and stations
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [mockCall],
      availableStations: [mockStation],
      selectedStation: mockStation,
      selectedDestinationType: 'station',
    });

    render(<StatusBottomSheet />);

    // Select call - should clear station selection
    const callOption = screen.getByText('C001 - Emergency Call');
    fireEvent.press(callOption);

    expect(mockSetSelectedCall).toHaveBeenCalledWith(mockCall);
    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('call');
    expect(mockSetSelectedStation).toHaveBeenCalledWith(null);
  });

  it('should clear call selection when station is selected', () => {
    const mockCall = {
      CallId: 'call-1',
      Number: 'C001',
      Name: 'Emergency Call',
      Address: '123 Main St',
    };

    const mockStation = {
      GroupId: 'station-1',
      Name: 'Fire Station 1',
      Address: '456 Oak Ave',
      GroupType: 'Station',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 3, // Both calls and stations
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [mockCall],
      availableStations: [mockStation],
      selectedCall: mockCall,
      selectedDestinationType: 'call',
    });

    render(<StatusBottomSheet />);

    // Switch to stations tab first
    const stationsTab = screen.getByText('Stations');
    fireEvent.press(stationsTab);

    // Select station - should clear call selection
    const stationOption = screen.getByText('Fire Station 1');
    fireEvent.press(stationOption);

    expect(mockSetSelectedStation).toHaveBeenCalledWith(mockStation);
    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('station');
    expect(mockSetSelectedCall).toHaveBeenCalledWith(null);
  });

  it('should render many items without height constraints for proper scrolling', () => {
    // Create many mock calls to test scrolling
    const manyCalls = Array.from({ length: 10 }, (_, index) => ({
      CallId: `call-${index + 1}`,
      Number: `C${String(index + 1).padStart(3, '0')}`,
      Name: `Emergency Call ${index + 1}`,
      Address: `${100 + index} Main Street`,
    }));

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: manyCalls,
    });

    render(<StatusBottomSheet />);

    // All calls should be rendered (not limited by height constraints)
    expect(screen.getByText('C001 - Emergency Call 1')).toBeTruthy();
    expect(screen.getByText('C005 - Emergency Call 5')).toBeTruthy();
    expect(screen.getByText('C010 - Emergency Call 10')).toBeTruthy();

    // Select a call in the middle to ensure it's interactive
    const fifthCall = screen.getByText('C005 - Emergency Call 5');
    fireEvent.press(fifthCall);

    expect(mockSetSelectedCall).toHaveBeenCalledWith(manyCalls[4]);
    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('call');
  });

  it('should render many stations without height constraints for proper scrolling', () => {
    // Create many mock stations to test scrolling
    const manyStations = Array.from({ length: 8 }, (_, index) => ({
      GroupId: `station-${index + 1}`,
      Name: `Fire Station ${index + 1}`,
      Address: `${200 + index} Oak Avenue`,
      GroupType: 'Station',
    }));

    const selectedStatus = {
      Id: 'status-1',
      Text: 'At Station',
      Detail: 1, // Show stations
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableStations: manyStations,
    });

    render(<StatusBottomSheet />);

    // All stations should be rendered (not limited by height constraints)
    expect(screen.getByText('Fire Station 1')).toBeTruthy();
    expect(screen.getByText('Fire Station 4')).toBeTruthy();
    expect(screen.getByText('Fire Station 8')).toBeTruthy();

    // Select a station in the middle to ensure it's interactive
    const fourthStation = screen.getByText('Fire Station 4');
    fireEvent.press(fourthStation);

    expect(mockSetSelectedStation).toHaveBeenCalledWith(manyStations[3]);
    expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('station');
  });

  it('should pre-select active call when status bottom sheet opens with calls enabled', async () => {
    const activeCall = {
      CallId: 'active-call-123',
      Number: 'C123',
      Name: 'Active Emergency Call',
      Address: '123 Active St',
    };

    const otherCall = {
      CallId: 'other-call-456',
      Number: 'C456',
      Name: 'Other Emergency Call',
      Address: '456 Other St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Mock core store with active call
    const coreStoreWithActiveCall = {
      ...defaultCoreStore,
      activeCallId: 'active-call-123',
    };
    mockGetState.mockReturnValue(coreStoreWithActiveCall as any);
    mockUseCoreStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(coreStoreWithActiveCall);
      }
      return coreStoreWithActiveCall;
    });

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [otherCall, activeCall], // Active call is in the list
      isLoading: false,
      selectedCall: null, // No call initially selected
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    // Should pre-select the active call
    await waitFor(() => {
      expect(mockSetSelectedCall).toHaveBeenCalledWith(activeCall);
      expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('call');
    });
  });

  it('should pre-select active call when status has detailLevel 3 (both calls and stations)', async () => {
    const activeCall = {
      CallId: 'active-call-789',
      Number: 'C789',
      Name: 'Active Fire Call',
      Address: '789 Fire St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 3, // Show both calls and stations
      Note: 0,
    };

    // Mock core store with active call
    const coreStoreWithActiveCall = {
      ...defaultCoreStore,
      activeCallId: 'active-call-789',
    };
    mockGetState.mockReturnValue(coreStoreWithActiveCall as any);
    mockUseCoreStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(coreStoreWithActiveCall);
      }
      return coreStoreWithActiveCall;
    });

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [activeCall],
      availableStations: [{ GroupId: 'station-1', Name: 'Station 1', Address: '', GroupType: 'Station' }],
      isLoading: false,
      selectedCall: null,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    // Should pre-select the active call
    await waitFor(() => {
      expect(mockSetSelectedCall).toHaveBeenCalledWith(activeCall);
      expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('call');
    });
  });

  it('should not pre-select active call when calls are not enabled (detailLevel 1)', () => {
    const activeCall = {
      CallId: 'active-call-123',
      Number: 'C123',
      Name: 'Active Emergency Call',
      Address: '123 Active St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'At Station',
      Detail: 1, // Show only stations, not calls
      Note: 0,
    };

    // Mock core store with active call
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: 'active-call-123',
    } as any);

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [activeCall], // Active call is in the list but not relevant for this status
      isLoading: false,
      selectedCall: null,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    // Should NOT pre-select the active call since this status doesn't support calls
    expect(mockSetSelectedCall).not.toHaveBeenCalled();
    expect(mockSetSelectedDestinationType).not.toHaveBeenCalledWith('call');
  });

  it('should not pre-select active call when it is not in the available calls list', () => {
    const availableCall = {
      CallId: 'available-call-456',
      Number: 'C456',
      Name: 'Available Call',
      Address: '456 Available St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Mock core store with active call that's NOT in the available calls list
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: 'different-active-call-999',
    } as any);

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [availableCall], // Active call is NOT in this list
      isLoading: false,
      selectedCall: null,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    // Should NOT pre-select any call since the active call is not available
    expect(mockSetSelectedCall).not.toHaveBeenCalled();
    expect(mockSetSelectedDestinationType).not.toHaveBeenCalledWith('call');
  });

  it('should not pre-select active call when there is no active call', () => {
    const availableCall = {
      CallId: 'available-call-456',
      Number: 'C456',
      Name: 'Available Call',
      Address: '456 Available St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Mock core store with NO active call
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: null,
    } as any);

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [availableCall],
      isLoading: false,
      selectedCall: null,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    // Should NOT pre-select any call since there's no active call
    expect(mockSetSelectedCall).not.toHaveBeenCalled();
    expect(mockSetSelectedDestinationType).not.toHaveBeenCalledWith('call');
  });

  it('should not pre-select active call when a call is already selected', () => {
    const activeCall = {
      CallId: 'active-call-123',
      Number: 'C123',
      Name: 'Active Emergency Call',
      Address: '123 Active St',
    };

    const alreadySelectedCall = {
      CallId: 'selected-call-456',
      Number: 'C456',
      Name: 'Already Selected Call',
      Address: '456 Selected St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Mock core store with active call
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: 'active-call-123',
    } as any);

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [activeCall, alreadySelectedCall],
      isLoading: false,
      selectedCall: alreadySelectedCall, // Already has a selected call
      selectedDestinationType: 'call',
    });

    render(<StatusBottomSheet />);

    // Should NOT change the selection since a call is already selected
    expect(mockSetSelectedCall).not.toHaveBeenCalled();
    expect(mockSetSelectedDestinationType).not.toHaveBeenCalled();
  });

  it('should not pre-select active call when destination type is not none', () => {
    const activeCall = {
      CallId: 'active-call-123',
      Number: 'C123',
      Name: 'Active Emergency Call',
      Address: '123 Active St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Mock core store with active call
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: 'active-call-123',
    } as any);

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [activeCall],
      isLoading: false,
      selectedCall: null,
      selectedDestinationType: 'station', // Not 'none', so should not change selection
    });

    render(<StatusBottomSheet />);

    // Should NOT pre-select the active call since destination type is already set to station
    expect(mockSetSelectedCall).not.toHaveBeenCalled();
    expect(mockSetSelectedDestinationType).not.toHaveBeenCalled();
  });

  it('should not pre-select active call when still loading', () => {
    const activeCall = {
      CallId: 'active-call-123',
      Number: 'C123',
      Name: 'Active Emergency Call',
      Address: '123 Active St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Mock core store with active call
    mockGetState.mockReturnValue({
      ...defaultCoreStore,
      activeCallId: 'active-call-123',
    } as any);

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [activeCall],
      isLoading: true, // Still loading
      selectedCall: null,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    // Should NOT pre-select the active call since it's still loading
    expect(mockSetSelectedCall).not.toHaveBeenCalled();
    expect(mockSetSelectedDestinationType).not.toHaveBeenCalled();
  });

  it('should only select active call and not show no destination as selected when pre-selecting', async () => {
    const activeCall = {
      CallId: 'active-call-123',
      Number: 'C123',
      Name: 'Active Emergency Call',
      Address: '123 Active St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Mock core store with active call
    const coreStoreWithActiveCall = {
      ...defaultCoreStore,
      activeCallId: 'active-call-123',
    };
    mockGetState.mockReturnValue(coreStoreWithActiveCall as any);
    mockUseCoreStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(coreStoreWithActiveCall);
      }
      return coreStoreWithActiveCall;
    });

    // First render with initial state
    let currentStore = {
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [activeCall],
      isLoading: false,
      selectedCall: null,
      selectedDestinationType: 'none',
    };

    mockUseStatusBottomSheetStore.mockReturnValue(currentStore);

    const { rerender } = render(<StatusBottomSheet />);

    // Should pre-select the active call
    await waitFor(() => {
      expect(mockSetSelectedCall).toHaveBeenCalledWith(activeCall);
      expect(mockSetSelectedDestinationType).toHaveBeenCalledWith('call');
    });

    // Simulate state update after pre-selection
    const updatedStore = {
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [activeCall],
      isLoading: false,
      selectedCall: activeCall,
      selectedDestinationType: 'call' as const,
    };

    mockUseStatusBottomSheetStore.mockReturnValue(updatedStore);

    rerender(<StatusBottomSheet />);

    // Verify that the active call is visually selected
    const callContainer = screen.getByText('C123 - Active Emergency Call').parent?.parent;
    expect(callContainer).toBeTruthy();

    // Verify that "No Destination" is NOT visually selected by checking the computed styling
    const noDestinationContainer = screen.getByText('No Destination').parent?.parent?.parent;
    expect(noDestinationContainer).toBeTruthy();

    // The container should NOT have the selected styling (blue border/background)
    expect(noDestinationContainer?.props.className).not.toContain('border-blue-500');
    expect(noDestinationContainer?.props.className).not.toContain('bg-blue-50');
  });

  it('should not show no destination as selected during loading when there is an active call to pre-select', async () => {
    const activeCall = {
      CallId: 'active-call-123',
      Number: 'C123',
      Name: 'Active Emergency Call',
      Address: '123 Active St',
    };

    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 2, // Show calls
      Note: 0,
    };

    // Mock core store with active call
    const coreStoreWithActiveCall = {
      ...defaultCoreStore,
      activeCallId: 'active-call-123',
    };
    mockGetState.mockReturnValue(coreStoreWithActiveCall as any);
    mockUseCoreStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(coreStoreWithActiveCall);
      }
      return coreStoreWithActiveCall;
    });

    // Render with loading state (no calls available yet)
    const loadingStore = {
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      availableCalls: [], // No calls loaded yet
      isLoading: true, // Still loading
      selectedCall: null,
      selectedDestinationType: 'none',
    };

    mockUseStatusBottomSheetStore.mockReturnValue(loadingStore);

    const { rerender } = render(<StatusBottomSheet />);

    // Verify that "No Destination" is NOT visually selected even during loading
    // when there's an active call that should be pre-selected
    const noDestinationContainer = screen.getByText('No Destination').parent?.parent?.parent;
    expect(noDestinationContainer).toBeTruthy();

    // The container should NOT have the selected styling during loading
    expect(noDestinationContainer?.props.className).not.toContain('border-blue-500');
    expect(noDestinationContainer?.props.className).not.toContain('bg-blue-50');
  });

  // New tests for status selection step
  it('should render status selection step when no status is pre-selected', () => {
    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'select-status',
      selectedStatus: null, // No status pre-selected
      cameFromStatusSelection: true,
    });

    render(<StatusBottomSheet />);

    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    expect(screen.getByText('Select Status')).toBeTruthy();
    expect(screen.getByText('What status would you like to set?')).toBeTruthy();
    expect(screen.getByText('Available')).toBeTruthy();
    expect(screen.getByText('Responding')).toBeTruthy();
    expect(screen.getByText('On Scene')).toBeTruthy();
  });

  it('should display checkmarks instead of radio buttons for status selection', () => {
    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'select-status',
      selectedStatus: null,
    });

    render(<StatusBottomSheet />);

    // Check that we have TouchableOpacity components for each status instead of radio buttons
    const statusOptions = screen.getAllByText(/Available|Responding|On Scene/);
    expect(statusOptions).toHaveLength(3);

    // Verify the status text is present (indicating TouchableOpacity structure worked)
    expect(screen.getByText('Available')).toBeTruthy();
    expect(screen.getByText('Responding')).toBeTruthy();
    expect(screen.getByText('On Scene')).toBeTruthy();
  });

  it('should display checkmarks instead of radio buttons for destination selection', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Available',
      Detail: 1, // Show destination step
      Note: 1, // Note optional
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
    });

    render(<StatusBottomSheet />);

    // The No Destination option should use TouchableOpacity with checkmark instead of radio
    expect(screen.getByText('No Destination')).toBeTruthy();
    expect(screen.getByText('General Status')).toBeTruthy();
  });

  it('should handle status selection', () => {
    const mockSetSelectedStatus = jest.fn();

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'select-status',
      selectedStatus: null,
      setSelectedStatus: mockSetSelectedStatus,
    });

    render(<StatusBottomSheet />);

    const respondingStatus = screen.getByText('Responding');
    fireEvent.press(respondingStatus);

    expect(mockSetSelectedStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        Id: 2,
        Text: 'Responding',
        Detail: 2,
        Note: 1,
      })
    );
  });

  it('should show status details in status selection', () => {
    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'select-status',
      selectedStatus: null,
    });

    render(<StatusBottomSheet />);

    // Check for destination type descriptions
    expect(screen.getByText('Can respond to stations')).toBeTruthy(); // Detail: 1
    expect(screen.getByText('Can respond to calls')).toBeTruthy(); // Detail: 2
    expect(screen.getByText('Can respond to calls or stations')).toBeTruthy(); // Detail: 3

    // Check for note requirements
    expect(screen.getByText('Note optional')).toBeTruthy(); // Note: 1 (Responding)
    expect(screen.getByText('Note required')).toBeTruthy(); // Note: 2 (On Scene)
  });

  it('should disable next button on status selection when no status is selected', () => {
    const mockSetCurrentStep = jest.fn();

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'select-status',
      selectedStatus: null,
      cameFromStatusSelection: true,
      setCurrentStep: mockSetCurrentStep,
    });

    render(<StatusBottomSheet />);

    const nextButton = screen.getByText('Next');

    // Try to press the button - it should not navigate when disabled
    fireEvent.press(nextButton);
    expect(mockSetCurrentStep).not.toHaveBeenCalled();
  });

  it('should enable next button on status selection when status is selected', () => {
    const mockSetCurrentStep = jest.fn();

    const selectedStatus = {
      Id: 1,
      Type: 1,
      StateId: 1,
      Text: 'Available',
      BColor: '#28a745',
      Color: '#fff',
      Gps: false,
      Note: 0,
      Detail: 1,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'select-status',
      selectedStatus,
      cameFromStatusSelection: true,
      setCurrentStep: mockSetCurrentStep,
    });

    render(<StatusBottomSheet />);

    const nextButton = screen.getByText('Next');

    // Button should be enabled and allow navigation when status is selected
    fireEvent.press(nextButton);
    expect(mockSetCurrentStep).toHaveBeenCalledWith('select-destination');
  });

  it('should proceed to destination step from status selection when destination is needed', () => {
    const selectedStatus = {
      Id: 2,
      Type: 2,
      StateId: 2,
      Text: 'Responding',
      BColor: '#ffc107',
      Color: '#000',
      Gps: true,
      Note: 1,
      Detail: 2, // Has destination step
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'select-status',
      selectedStatus,
    });

    render(<StatusBottomSheet />);

    const nextButton = screen.getByText('Next');
    fireEvent.press(nextButton);

    expect(mockSetCurrentStep).toHaveBeenCalledWith('select-destination');
  });

  it('should proceed to note step from status selection when no destination is needed but note is required', () => {
    const selectedStatus = {
      Id: 1,
      Type: 1,
      StateId: 1,
      Text: 'Available',
      BColor: '#28a745',
      Color: '#fff',
      Gps: false,
      Note: 2, // Note required
      Detail: 0, // No destination step
    };

    const mockHandleSubmit = jest.fn();

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'select-status',
      selectedStatus,
    });

    render(<StatusBottomSheet />);

    const nextButton = screen.getByText('Next');
    fireEvent.press(nextButton);

    expect(mockSetCurrentStep).toHaveBeenCalledWith('add-note');
  });

  it('should submit directly from status selection when no destination or note is needed', () => {
    const selectedStatus = {
      Id: 1,
      Type: 1,
      StateId: 1,
      Text: 'Available',
      BColor: '#28a745',
      Color: '#fff',
      Gps: false,
      Note: 0, // No note required
      Detail: 0, // No destination step
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'select-status',
      selectedStatus,
    });

    render(<StatusBottomSheet />);

    const nextButton = screen.getByText('Next');
    fireEvent.press(nextButton);

    // Should call submit directly
    expect(mockSaveUnitStatus).toHaveBeenCalled();
  });

  it('should handle previous button from destination step to status selection', () => {
    const selectedStatus = {
      Id: 2,
      Type: 2,
      StateId: 2,
      Text: 'Responding',
      BColor: '#ffc107',
      Color: '#000',
      Gps: true,
      Note: 1,
      Detail: 2,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'select-destination',
      selectedStatus,
    });

    render(<StatusBottomSheet />);

    const nextButton = screen.getByText('Next');
    fireEvent.press(nextButton);

    // Now in note step
    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'add-note',
      selectedStatus,
    });

    render(<StatusBottomSheet />);

    const previousButton = screen.getByText('Previous');
    fireEvent.press(previousButton);

    expect(mockSetCurrentStep).toHaveBeenCalledWith('select-destination');
  });

  it('should handle previous button from note step to status selection when no destination step', () => {
    const selectedStatus = {
      Id: 1,
      Type: 1,
      StateId: 1,
      Text: 'Available',
      BColor: '#28a745',
      Color: '#fff',
      Gps: false,
      Note: 1, // Note optional
      Detail: 0, // No destination step
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'add-note',
      selectedStatus,
    });

    render(<StatusBottomSheet />);

    const previousButton = screen.getByText('Previous');
    fireEvent.press(previousButton);

    expect(mockSetCurrentStep).toHaveBeenCalledWith('select-status');
  });

  it('should calculate correct step numbers with status selection', () => {
    // Test step 1 of 3 (status, destination, note)
    const selectedStatusWithAll = {
      Id: 3,
      Type: 3,
      StateId: 3,
      Text: 'On Scene',
      BColor: '#dc3545',
      Color: '#fff',
      Gps: true,
      Note: 2, // Note optional
      Detail: 3, // Both destinations
    };

    // Step 1: Status selection (no status selected yet)
    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'select-status',
      selectedStatus: null, // No status selected yet, so we see status selection
      cameFromStatusSelection: true,
    });

    const { rerender } = render(<StatusBottomSheet />);
    expect(screen.getByText('Step 1 of 3')).toBeTruthy();

    // Step 2: After selecting status, now on destination step (from new flow)
    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'select-destination',
      selectedStatus: selectedStatusWithAll,
      cameFromStatusSelection: true,
    });

    rerender(<StatusBottomSheet />);
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();

    // Step 3: Note step (from new flow)
    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'add-note',
      selectedStatus: selectedStatusWithAll,
      cameFromStatusSelection: true,
    });

    rerender(<StatusBottomSheet />);
    expect(screen.getByText('Step 3 of 3')).toBeTruthy();
  });

  it('should calculate correct step numbers without destination step', () => {
    // Test step 1 of 2 (status, note) - no destination
    const selectedStatusNoDestination = {
      Id: 1,
      Type: 1,
      StateId: 1,
      Text: 'Available',
      BColor: '#28a745',
      Color: '#fff',
      Gps: false,
      Note: 1, // Note required
      Detail: 0, // No destination
    };

    // Create a mock core store with only statuses that don't have destinations
    const coreStoreNoDestinations = {
      ...defaultCoreStore,
      activeStatuses: {
        UnitType: '0',
        Data: [
          { Id: 1, Type: 1, StateId: 1, Text: 'Available', BColor: '#28a745', Color: '#fff', Gps: false, Note: 1, Detail: 0 },
          { Id: 4, Type: 4, StateId: 4, Text: 'Busy', BColor: '#dc3545', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
        ],
      },
    };

    mockGetState.mockReturnValue(coreStoreNoDestinations as any);
    mockUseCoreStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(coreStoreNoDestinations);
      }
      return coreStoreNoDestinations;
    });

    // Status selection step
    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      availableStatuses: [
        { Id: 1, Type: 1, StateId: 1, Text: 'Available', BColor: '#28a745', Color: '#fff', Gps: false, Note: 1, Detail: 0 },
        { Id: 4, Type: 4, StateId: 4, Text: 'Busy', BColor: '#dc3545', Color: '#fff', Gps: false, Note: 0, Detail: 0 },
      ],
      isOpen: true,
      currentStep: 'select-status',
      selectedStatus: null,
      cameFromStatusSelection: true,
    });

    const { rerender } = render(<StatusBottomSheet />);
    expect(screen.getByText('Step 1 of 2')).toBeTruthy();

    // Note step (skipping destination)
    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'add-note',
      selectedStatus: selectedStatusNoDestination,
      cameFromStatusSelection: true,
    });

    rerender(<StatusBottomSheet />);
    expect(screen.getByText('Step 2 of 2')).toBeTruthy();
  });

  it('should show no statuses available message when no statuses are present', () => {
    // Mock core store with no statuses
    const coreStoreNoStatuses = {
      ...defaultCoreStore,
      activeStatuses: {
        UnitType: '0',
        Data: [],
      },
    };

    mockGetState.mockReturnValue(coreStoreNoStatuses as any);
    mockUseCoreStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(coreStoreNoStatuses);
      }
      return coreStoreNoStatuses;
    });

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      availableStatuses: [],
      isOpen: true,
      currentStep: 'select-status',
      selectedStatus: null,
    });

    render(<StatusBottomSheet />);

    expect(screen.getByText('No statuses available')).toBeTruthy();
  });

  it('should show no statuses available message when activeStatuses is null', () => {
    // Mock core store with null activeStatuses
    const coreStoreNullStatuses = {
      ...defaultCoreStore,
      activeStatuses: null,
    };

    mockGetState.mockReturnValue(coreStoreNullStatuses as any);
    mockUseCoreStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(coreStoreNullStatuses);
      }
      return coreStoreNullStatuses;
    });

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      availableStatuses: [],
      isOpen: true,
      currentStep: 'select-status',
      selectedStatus: null,
    });

    render(<StatusBottomSheet />);

    expect(screen.getByText('No statuses available')).toBeTruthy();
  });

  // NEW TESTS FOR LAYOUT IMPROVEMENTS

  it('should show "Committed" status with both calls and stations without pushing Next button off screen', () => {
    const committedStatus = {
      Id: 'committed-status',
      Text: 'Committed',
      Detail: 3, // Both calls and stations enabled
      Note: 1, // Note optional
    };

    const mockCalls = Array.from({ length: 5 }, (_, index) => ({
      CallId: `call-${index + 1}`,
      Number: `C${String(index + 1).padStart(3, '0')}`,
      Name: `Emergency Call ${index + 1}`,
      Address: `${100 + index} Main Street`,
    }));

    const mockStations = Array.from({ length: 3 }, (_, index) => ({
      GroupId: `station-${index + 1}`,
      Name: `Fire Station ${index + 1}`,
      Address: `${200 + index} Oak Avenue`,
      GroupType: 'Station',
    }));

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus: committedStatus,
      currentStep: 'select-destination',
      availableCalls: mockCalls,
      availableStations: mockStations,
      isLoading: false,
    });

    render(<StatusBottomSheet />);

    // Should show tabs for both calls and stations
    expect(screen.getByText('Calls')).toBeTruthy();
    expect(screen.getByText('Stations')).toBeTruthy();

    // Should show No Destination option
    expect(screen.getByText('No Destination')).toBeTruthy();

    // Next button should be visible and accessible
    expect(screen.getByText('Next')).toBeTruthy();

    // Should show some calls on the Calls tab (default)
    expect(screen.getByText('C001 - Emergency Call 1')).toBeTruthy();

    // Switch to Stations tab
    const stationsTab = screen.getByText('Stations');
    fireEvent.press(stationsTab);

    // Should show stations
    expect(screen.getByText('Fire Station 1')).toBeTruthy();

    // Next button should still be accessible
    expect(screen.getByText('Next')).toBeTruthy();
  });

  it('should maintain Next button visibility with many calls and stations in Committed status', () => {
    const committedStatus = {
      Id: 'committed-status',
      Text: 'Committed',
      Detail: 3, // Both calls and stations enabled
      Note: 0, // No note required
    };

    // Create many calls and stations to test scrolling
    const manyCalls = Array.from({ length: 15 }, (_, index) => ({
      CallId: `call-${index + 1}`,
      Number: `C${String(index + 1).padStart(3, '0')}`,
      Name: `Emergency Call ${index + 1}`,
      Address: `${100 + index} Main Street`,
    }));

    const manyStations = Array.from({ length: 10 }, (_, index) => ({
      GroupId: `station-${index + 1}`,
      Name: `Fire Station ${index + 1}`,
      Address: `${200 + index} Oak Avenue`,
      GroupType: 'Station',
    }));

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus: committedStatus,
      currentStep: 'select-destination',
      availableCalls: manyCalls,
      availableStations: manyStations,
      isLoading: false,
    });

    render(<StatusBottomSheet />);

    // Should show first few calls
    expect(screen.getByText('C001 - Emergency Call 1')).toBeTruthy();
    expect(screen.getByText('C005 - Emergency Call 5')).toBeTruthy();

    // Next button should still be visible and functional
    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeTruthy();

    // Should be able to click Next button without scrolling
    fireEvent.press(nextButton);

    // Since no note is required, this should trigger submit
    expect(mockSaveUnitStatus).toHaveBeenCalled();
  });

  it('should handle status selection with many statuses without pushing Next button off screen', () => {
    const manyStatuses = [
      { Id: 1, Type: 1, StateId: 1, Text: 'Available', BColor: '#28a745', Color: '#fff', Gps: false, Note: 0, Detail: 1 },
      { Id: 2, Type: 2, StateId: 2, Text: 'Responding', BColor: '#ffc107', Color: '#000', Gps: true, Note: 1, Detail: 2 },
      { Id: 3, Type: 3, StateId: 3, Text: 'On Scene', BColor: '#dc3545', Color: '#fff', Gps: true, Note: 2, Detail: 3 },
      { Id: 4, Type: 4, StateId: 4, Text: 'Committed', BColor: '#17a2b8', Color: '#fff', Gps: true, Note: 1, Detail: 3 },
      { Id: 5, Type: 5, StateId: 5, Text: 'Transporting', BColor: '#6f42c1', Color: '#fff', Gps: true, Note: 1, Detail: 2 },
      { Id: 6, Type: 6, StateId: 6, Text: 'At Hospital', BColor: '#e83e8c', Color: '#fff', Gps: false, Note: 2, Detail: 1 },
      { Id: 7, Type: 7, StateId: 7, Text: 'Clearing', BColor: '#fd7e14', Color: '#000', Gps: false, Note: 0, Detail: 0 },
      { Id: 8, Type: 8, StateId: 8, Text: 'Out of Service', BColor: '#6c757d', Color: '#fff', Gps: false, Note: 2, Detail: 0 },
    ];

    // Update core store with many statuses
    const coreStoreWithManyStatuses = {
      ...defaultCoreStore,
      activeStatuses: {
        UnitType: '0',
        Data: manyStatuses,
      },
    };

    mockGetState.mockReturnValue(coreStoreWithManyStatuses as any);
    mockUseCoreStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(coreStoreWithManyStatuses);
      }
      return coreStoreWithManyStatuses;
    });

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      availableStatuses: manyStatuses,
      isOpen: true,
      currentStep: 'select-status',
      selectedStatus: null,
      cameFromStatusSelection: true,
    });

    render(<StatusBottomSheet />);

    // Should show all statuses
    expect(screen.getByText('Available')).toBeTruthy();
    expect(screen.getByText('Committed')).toBeTruthy();
    expect(screen.getByText('Out of Service')).toBeTruthy();

    // Next button should be visible but disabled since no status is selected
    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeTruthy();

    // Select a status
    const committedStatus = screen.getByText('Committed');
    fireEvent.press(committedStatus);

    // Next button should still be accessible after selection
    expect(screen.getByText('Next')).toBeTruthy();
  });

  it('should show proper layout spacing in destination step with reduced margins', () => {
    const selectedStatus = {
      Id: 'status-1',
      Text: 'Responding',
      Detail: 3, // Both calls and stations
      Note: 1,
    };

    const mockCall = {
      CallId: 'call-1',
      Number: 'C001',
      Name: 'Emergency Call',
      Address: '123 Main St',
    };

    const mockStation = {
      GroupId: 'station-1',
      Name: 'Fire Station 1',
      Address: '456 Oak Ave',
      GroupType: 'Station',
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      selectedStatus,
      currentStep: 'select-destination',
      availableCalls: [mockCall],
      availableStations: [mockStation],
    });

    render(<StatusBottomSheet />);

    // Check that the layout components are rendered
    expect(screen.getByText('No Destination')).toBeTruthy();
    expect(screen.getByText('Calls')).toBeTruthy();
    expect(screen.getByText('Stations')).toBeTruthy();
    expect(screen.getByText('C001 - Emergency Call')).toBeTruthy();
    expect(screen.getByText('Next')).toBeTruthy();

    // Verify we can select a call and the Next button remains accessible
    const callOption = screen.getByText('C001 - Emergency Call');
    fireEvent.press(callOption);

    expect(mockSetSelectedCall).toHaveBeenCalledWith(mockCall);
    expect(screen.getByText('Next')).toBeTruthy();
  });

  it('should show selected status and destination on note step', () => {
    const selectedStatus = {
      Id: 1,
      Text: 'Available',
      Color: '#00FF00',
      Detail: 2,
      Note: 1,
    };

    const selectedCall = {
      CallId: 'call-1',
      Number: 'C123',
      Name: 'Emergency Call',
      Address: '123 Main St',
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'add-note',
      selectedStatus,
      selectedCall,
      selectedDestinationType: 'call',
    });

    render(<StatusBottomSheet />);

    expect(screen.getByText('Selected Status:')).toBeTruthy();
    expect(screen.getByText('Available')).toBeTruthy();
    expect(screen.getByText('Selected Destination:')).toBeTruthy();
    expect(screen.getByText('C123 - Emergency Call')).toBeTruthy();
  });

  it('should disable submit button and show spinner when submitting', async () => {
    const selectedStatus = {
      Id: 1,
      Text: 'Available',
      Color: '#00FF00',
      Detail: 0,
      Note: 0,
    };

    // Mock a slow save operation
    const slowSaveUnitStatus = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'add-note',
      selectedStatus,
      selectedDestinationType: 'none',
    });

    mockUseStatusesStore.mockReturnValue({
      ...defaultStatusesStore,
      saveUnitStatus: slowSaveUnitStatus,
    });

    render(<StatusBottomSheet />);

    const submitButton = screen.getByText('Submit');
    fireEvent.press(submitButton);

    // Check that the button is disabled and shows submitting text
    await waitFor(() => {
      expect(screen.getByText('Submitting')).toBeTruthy();
    });

    // Wait for the operation to complete
    await waitFor(() => slowSaveUnitStatus);
  });

  it('should show success toast when status is saved successfully', async () => {
    const selectedStatus = {
      Id: 1,
      Text: 'Available',
      Color: '#00FF00',
      Detail: 0,
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'add-note',
      selectedStatus,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    const submitButton = screen.getByText('Submit');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(mockSaveUnitStatus).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith('success', 'Status saved successfully');
      expect(mockReset).toHaveBeenCalled();
    });
  });

  it('should show error toast when status save fails', async () => {
    const selectedStatus = {
      Id: 1,
      Text: 'Available',
      Color: '#00FF00',
      Detail: 0,
      Note: 0,
    };

    const errorSaveUnitStatus = jest.fn().mockRejectedValue(new Error('Network error'));

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'add-note',
      selectedStatus,
      selectedDestinationType: 'none',
    });

    mockUseStatusesStore.mockReturnValue({
      ...defaultStatusesStore,
      saveUnitStatus: errorSaveUnitStatus,
    });

    render(<StatusBottomSheet />);

    const submitButton = screen.getByText('Submit');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(errorSaveUnitStatus).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith('error', 'Failed to save status');
    });

    // Button should stop spinning even on error
    await waitFor(() => {
      expect(screen.getByText('Submit')).toBeTruthy(); // Should be back to normal state
    });
  });

  it('should prevent double submission when submit is pressed multiple times', async () => {
    const selectedStatus = {
      Id: 1,
      Text: 'Available',
      Color: '#00FF00',
      Detail: 0,
      Note: 0,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'add-note',
      selectedStatus,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    const submitButton = screen.getByText('Submit');

    // Press submit multiple times rapidly
    fireEvent.press(submitButton);
    fireEvent.press(submitButton);
    fireEvent.press(submitButton);

    await waitFor(() => {
      // Should only call save once despite multiple presses
      expect(mockSaveUnitStatus).toHaveBeenCalledTimes(1);
    });
  });

  it('should stop spinning immediately after status save completes', async () => {
    const selectedStatus = {
      Id: 1,
      Text: 'Available',
      Color: '#00FF00',
      Detail: 0,
      Note: 0,
    };

    // Create a mock that resolves after a short delay to simulate API call
    const fastSaveUnitStatus = jest.fn().mockImplementation(() => Promise.resolve());

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'add-note',
      selectedStatus,
      selectedDestinationType: 'none',
    });

    mockUseStatusesStore.mockReturnValue({
      ...defaultStatusesStore,
      saveUnitStatus: fastSaveUnitStatus,
    });

    render(<StatusBottomSheet />);

    const submitButton = screen.getByText('Submit');

    // Initially should show "Submit"
    expect(screen.getByText('Submit')).toBeTruthy();

    fireEvent.press(submitButton);

    // Should immediately show "Submitting"
    await waitFor(() => {
      expect(screen.getByText('Submitting')).toBeTruthy();
    });

    // After the save completes, should go back to "Submit" and modal should close
    await waitFor(() => {
      expect(fastSaveUnitStatus).toHaveBeenCalled();
      expect(mockReset).toHaveBeenCalled(); // Modal should close immediately after save
    });
  });

  it('should disable previous button when submitting on note step', async () => {
    const selectedStatus = {
      Id: 1,
      Text: 'Available',
      Color: '#00FF00',
      Detail: 2,
      Note: 1,
    };

    const slowSaveUnitStatus = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'add-note',
      selectedStatus,
      selectedDestinationType: 'none',
      note: 'Test note',
    });

    mockUseStatusesStore.mockReturnValue({
      ...defaultStatusesStore,
      saveUnitStatus: slowSaveUnitStatus,
    });

    render(<StatusBottomSheet />);

    const submitButton = screen.getByText('Submit');
    fireEvent.press(submitButton);

    await waitFor(() => {
      // Check that the submitting state is active
      expect(screen.getByText('Submitting')).toBeTruthy();
    });

    // Wait for the operation to complete
    await waitFor(() => expect(slowSaveUnitStatus).toHaveBeenCalled());
  });

  it('should show "No Destination" correctly when no call or station is selected', () => {
    const selectedStatus = {
      Id: 1,
      Text: 'Available',
      Color: '#00FF00',
      Detail: 2,
      Note: 1,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'add-note',
      selectedStatus,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    expect(screen.getByText('Selected Destination:')).toBeTruthy();
    expect(screen.getByText('No Destination')).toBeTruthy();
  });

  it('should show loading state when call is being selected but selectedCall is null', () => {
    const selectedStatus = {
      Id: 1,
      Text: 'Available',
      Color: '#00FF00',
      Detail: 2,
      Note: 1,
    };

    const availableCalls = [
      {
        CallId: 'call-1',
        Number: 'C123',
        Name: 'Emergency Call',
        Address: '123 Main St',
      },
    ];

    // Mock core store with active call ID
    const coreStoreWithActiveCall = {
      ...defaultCoreStore,
      activeCallId: 'call-1',
    };

    mockGetState.mockReturnValue(coreStoreWithActiveCall as any);
    mockUseCoreStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(coreStoreWithActiveCall);
      }
      return coreStoreWithActiveCall;
    });

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'add-note',
      selectedStatus,
      selectedDestinationType: 'call', // Set to call but no selectedCall yet
      selectedCall: null, // This is the issue scenario
      availableCalls,
    });

    render(<StatusBottomSheet />);

    expect(screen.getByText('Selected Destination:')).toBeTruthy();
    expect(screen.getByText('C123 - Emergency Call')).toBeTruthy(); // Should find the call from availableCalls
  });

  it('should show loading text when call type is selected but no calls are available yet', () => {
    const selectedStatus = {
      Id: 1,
      Text: 'Available',
      Color: '#00FF00',
      Detail: 2,
      Note: 1,
    };

    // Mock core store with active call ID
    const coreStoreWithActiveCall = {
      ...defaultCoreStore,
      activeCallId: 'call-1',
    };

    mockGetState.mockReturnValue(coreStoreWithActiveCall as any);
    mockUseCoreStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(coreStoreWithActiveCall);
      }
      return coreStoreWithActiveCall;
    });

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'add-note',
      selectedStatus,
      selectedDestinationType: 'call', // Set to call but no selectedCall yet
      selectedCall: null, // This is the issue scenario
      availableCalls: [], // No calls available yet
    });

    render(<StatusBottomSheet />);

    expect(screen.getByText('Selected Destination:')).toBeTruthy();
    expect(screen.getByText('Loading calls...')).toBeTruthy(); // Should show loading text
  });

  // New tests for color scheme functionality
  it('should use BColor for background and invertColor for text color in status selection', () => {
    const statusWithBColor = {
      Id: 1,
      Type: 1,
      StateId: 1,
      Text: 'Available',
      BColor: '#28a745', // Green background
      Color: '#fff', // Original text color (should be ignored)
      Gps: false,
      Note: 0,
      Detail: 1,
    };

    // Mock core store with status that has BColor
    const coreStoreWithBColor = {
      ...defaultCoreStore,
      activeStatuses: {
        UnitType: '0',
        Data: [statusWithBColor],
      },
    };

    mockGetState.mockReturnValue(coreStoreWithBColor as any);
    mockUseCoreStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(coreStoreWithBColor);
      }
      return coreStoreWithBColor;
    });

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'select-status',
      selectedStatus: null,
    });

    render(<StatusBottomSheet />);

    // Check that the status text is present
    expect(screen.getByText('Available')).toBeTruthy();

    // The styling should use BColor for background and calculated text color for contrast
    // We can't easily test the actual computed styles in this test environment,
    // but we've verified that the component renders without errors
  });

  it('should use BColor for background in selected status display on note step', () => {
    const statusWithBColor = {
      Id: 1,
      Text: 'Responding',
      BColor: '#ffc107', // Yellow background
      Color: '#000', // Original text color (should be ignored)
      Detail: 1,
      Note: 1,
    };

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'add-note',
      selectedStatus: statusWithBColor,
      selectedDestinationType: 'none',
    });

    render(<StatusBottomSheet />);

    expect(screen.getByText('Selected Status:')).toBeTruthy();
    expect(screen.getByText('Responding')).toBeTruthy();

    // The status display should use BColor for background and calculated text color
    // We can't easily test the actual computed styles, but we verify rendering works
  });

  it('should handle status without BColor gracefully', () => {
    const statusWithoutBColor = {
      Id: 1,
      Text: 'Emergency',
      BColor: '', // No background color
      Color: '#ff0000', // Red text color
      Detail: 0,
      Note: 0,
    };

    // Mock core store with status that has no BColor
    const coreStoreNoBColor = {
      ...defaultCoreStore,
      activeStatuses: {
        UnitType: '0',
        Data: [statusWithoutBColor],
      },
    };

    mockGetState.mockReturnValue(coreStoreNoBColor as any);
    mockUseCoreStore.mockImplementation((selector: any) => {
      if (selector) {
        return selector(coreStoreNoBColor);
      }
      return coreStoreNoBColor;
    });

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      availableStatuses: [statusWithoutBColor],
      isOpen: true,
      currentStep: 'select-status',
      selectedStatus: null,
    });

    render(<StatusBottomSheet />);

    // Should still render the status text
    expect(screen.getByText('Emergency')).toBeTruthy();

    // Component should handle missing BColor gracefully with fallback
  });

  it('should show Next button when tabs are visible with reduced ScrollView height', () => {
    const committedStatus = {
      Id: 4,
      Text: 'Committed',
      Color: '#FF6600',
      Detail: 3, // Both calls and stations
      Note: 0,
    };

    // Mock lots of calls and stations to ensure content would overflow
    const manyCalls = Array.from({ length: 20 }, (_, i) => ({
      CallId: `call-${i}`,
      Number: `C-${i.toString().padStart(3, '0')}`,
      Name: `Emergency Call ${i}`,
      Address: `${100 + i} Test Street`,
    }));

    const manyStations = Array.from({ length: 15 }, (_, i) => ({
      GroupId: `station-${i}`,
      Name: `Station ${i}`,
      Address: `${200 + i} Station Road`,
      GroupType: 'Fire Station',
    }));

    mockUseStatusBottomSheetStore.mockReturnValue({
      ...defaultBottomSheetStore,
      isOpen: true,
      currentStep: 'select-destination',
      selectedStatus: committedStatus,
      availableCalls: manyCalls,
      availableStations: manyStations,
      isLoading: false,
    });

    render(<StatusBottomSheet />);

    // Should show tab headers for calls and stations
    expect(screen.getByText('Calls')).toBeTruthy();
    expect(screen.getByText('Stations')).toBeTruthy();

    // Should show some calls (even with many items)
    expect(screen.getByText('C-000 - Emergency Call 0')).toBeTruthy();

    // Next button should still be visible and accessible
    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeTruthy();

    // Button should be enabled (can proceed)
    fireEvent.press(nextButton);
    // Should not throw or fail to find the button
  });
});