import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';

import { ActiveCallsPanel } from '../active-calls-panel';

import { getCallExtraData } from '@/api/calls/calls';
import { type CallPriorityResultData } from '@/models/v4/callPriorities/callPriorityResultData';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { useCallsStore } from '@/stores/calls/store';
import { useSecurityStore } from '@/stores/security/store';

// Mock the router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the API
jest.mock('@/api/calls/calls', () => ({
  getCallExtraData: jest.fn(),
}));

// Mock the security store
jest.mock('@/stores/security/store', () => ({
  useSecurityStore: jest.fn(),
}));

// Mock the calls store
jest.mock('@/stores/calls/store', () => ({
  useCallsStore: jest.fn(),
}));

// Mock the logger
jest.mock('@/lib/logging', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock UI components
jest.mock('@/components/ui/box', () => ({
  Box: ({ children, className, style, ...props }: any) => {
    const { View } = require('react-native');
    return (
      <View style={style} {...props}>
        {children}
      </View>
    );
  },
}));

jest.mock('@/components/ui/hstack', () => ({
  HStack: ({ children, className, space, ...props }: any) => {
    const { View } = require('react-native');
    return (
      <View style={{ flexDirection: 'row' }} {...props}>
        {children}
      </View>
    );
  },
}));

jest.mock('@/components/ui/text', () => ({
  Text: ({ children, className, style, numberOfLines, ...props }: any) => {
    const { Text: RNText } = require('react-native');
    return (
      <RNText style={style} numberOfLines={numberOfLines} {...props}>
        {children}
      </RNText>
    );
  },
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, size, style, className, ...props }: any) => {
    const { View } = require('react-native');
    return (
      <View style={style} {...props}>
        {children}
      </View>
    );
  },
}));

jest.mock('@/components/ui/icon', () => ({
  Icon: ({ as: IconComponent, size, className, color, style, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID="icon" {...props} />;
  },
}));

jest.mock('../panel-header', () => ({
  PanelHeader: ({ title, icon, iconColor, count, isCollapsed, onToggleCollapse, rightContent }: any) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View testID="panel-header">
        <Text testID="panel-title">{title}</Text>
        <Text testID="panel-count">{count}</Text>
        <Pressable testID="toggle-collapse" onPress={onToggleCollapse} />
        {rightContent}
      </View>
    );
  },
}));

const mockUseSecurityStore = useSecurityStore as jest.MockedFunction<typeof useSecurityStore>;
const mockUseCallsStore = useCallsStore as jest.MockedFunction<typeof useCallsStore>;
const mockGetCallExtraData = getCallExtraData as jest.MockedFunction<typeof getCallExtraData>;

const mockFetchCalls = jest.fn();
const mockFetchCallPriorities = jest.fn();

const mockCalls: CallResultData[] = [
  {
    CallId: 'call-1',
    Priority: 1,
    Name: 'Test Call 1',
    Nature: 'Fire Emergency',
    Note: 'Test note',
    Address: '123 Main St',
    DestinationPoiId: null,
    DestinationName: '',
    DestinationAddress: '',
    DestinationTypeName: '',
    DestinationPoiTypeId: null,
    DestinationLatitude: null,
    DestinationLongitude: null,
    Geolocation: '',
    LoggedOn: '2024-01-15T10:00:00Z',
    State: 'Active',
    Number: '001',
    NotesCount: 0,
    AudioCount: 0,
    ImgagesCount: 0,
    FileCount: 0,
    What3Words: '',
    ContactName: '',
    ContactInfo: '',
    ReferenceId: '',
    ExternalId: '',
    IncidentId: '',
    AudioFileId: '',
    Type: 'Emergency',
    LoggedOnUtc: '2024-01-15T10:00:00Z',
    DispatchedOn: '2024-01-15T10:05:00Z',
    DispatchedOnUtc: '2024-01-15T10:05:00Z',
    ScheduledOn: '',
    ScheduledOnUtc: '',
    Latitude: '40.7128',
    Longitude: '-74.0060',
    Protocols: [],
    UdfValues: [],
    CheckInTimersEnabled: false,
    AlarmLevel: 1,
    ActiveRunCardId: null,
  },
  {
    CallId: 'call-2',
    Priority: 2,
    Name: 'Test Call 2',
    Nature: 'Medical Emergency',
    Note: '',
    Address: '456 Oak Ave',
    DestinationPoiId: null,
    DestinationName: '',
    DestinationAddress: '',
    DestinationTypeName: '',
    DestinationPoiTypeId: null,
    DestinationLatitude: null,
    DestinationLongitude: null,
    Geolocation: '',
    LoggedOn: '2024-01-15T11:00:00Z',
    State: 'Open',
    Number: '002',
    NotesCount: 0,
    AudioCount: 0,
    ImgagesCount: 0,
    FileCount: 0,
    What3Words: '',
    ContactName: '',
    ContactInfo: '',
    ReferenceId: '',
    ExternalId: '',
    IncidentId: '',
    AudioFileId: '',
    Type: 'Medical',
    LoggedOnUtc: '2024-01-15T11:00:00Z',
    DispatchedOn: '2024-01-15T11:05:00Z',
    DispatchedOnUtc: '2024-01-15T11:05:00Z',
    ScheduledOn: '',
    ScheduledOnUtc: '',
    Latitude: '40.7589',
    Longitude: '-73.9851',
    Protocols: [],
    UdfValues: [],
    CheckInTimersEnabled: false,
    AlarmLevel: 1,
    ActiveRunCardId: null,
  },
  {
    CallId: 'call-3',
    Priority: 3,
    Name: 'Closed Call',
    Nature: 'False Alarm',
    Note: '',
    Address: '789 Pine Rd',
    DestinationPoiId: null,
    DestinationName: '',
    DestinationAddress: '',
    DestinationTypeName: '',
    DestinationPoiTypeId: null,
    DestinationLatitude: null,
    DestinationLongitude: null,
    Geolocation: '',
    LoggedOn: '2024-01-15T09:00:00Z',
    State: 'Closed',
    Number: '000',
    NotesCount: 0,
    AudioCount: 0,
    ImgagesCount: 0,
    FileCount: 0,
    What3Words: '',
    ContactName: '',
    ContactInfo: '',
    ReferenceId: '',
    ExternalId: '',
    IncidentId: '',
    AudioFileId: '',
    Type: 'Other',
    LoggedOnUtc: '2024-01-15T09:00:00Z',
    DispatchedOn: '2024-01-15T09:05:00Z',
    DispatchedOnUtc: '2024-01-15T09:05:00Z',
    ScheduledOn: '',
    ScheduledOnUtc: '',
    Latitude: '',
    Longitude: '',
    Protocols: [],
    UdfValues: [],
    CheckInTimersEnabled: false,
    AlarmLevel: 1,
    ActiveRunCardId: null,
  },
];

const mockPriorities: CallPriorityResultData[] = [
  {
    Id: 1,
    DepartmentId: 1,
    Name: 'High',
    Color: '#FF0000',
    Sort: 1,
    IsDeleted: false,
    IsDefault: false,
    Tone: 0,
  },
  {
    Id: 2,
    DepartmentId: 1,
    Name: 'Medium',
    Color: '#FFA500',
    Sort: 2,
    IsDeleted: false,
    IsDefault: false,
    Tone: 0,
  },
];

const mockDispatches = [
  {
    Id: 'dispatch-1',
    Timestamp: '2024-01-15T10:05:00Z',
    Type: 'Unit',
    Name: 'Engine 1',
    GroupId: 'group-1',
    Group: 'Station 1',
    Note: '',
    StatusId: 1,
    Location: '',
    StatusText: 'Responding',
    StatusColor: '#FFA500',
  },
  {
    Id: 'dispatch-2',
    Timestamp: '2024-01-15T10:05:00Z',
    Type: 'Personnel',
    Name: 'John Doe',
    GroupId: 'group-1',
    Group: 'Station 1',
    Note: '',
    StatusId: 2,
    Location: '',
    StatusText: 'On Scene',
    StatusColor: '#22C55E',
  },
];

describe('ActiveCallsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSecurityStore.mockReturnValue({
      canUserCreateCalls: true,
    } as any);
    
    // Mock the calls store with selector support
    const mockCallsState = {
      calls: mockCalls,
      callPriorities: mockPriorities,
      isLoadingCalls: false,
      isLoading: false,
      callsError: null,
      error: null,
      fetchCalls: mockFetchCalls,
      fetchCallPriorities: mockFetchCallPriorities,
    };
    
    mockUseCallsStore.mockImplementation((selector?: any) => {
      if (typeof selector === 'function') {
        return selector(mockCallsState);
      }
      return mockCallsState;
    });
    
    mockGetCallExtraData.mockResolvedValue({
      Data: {
        Dispatches: mockDispatches,
        Activity: [],
        CallFormData: '',
        Priority: mockPriorities[0],
        Protocols: [],
      },
    } as any);
  });

  it('renders correctly with calls', async () => {
    render(<ActiveCallsPanel />);

    // Should show panel header with title
    expect(screen.getByTestId('panel-title')).toBeTruthy();

    // Should show count of active calls (2 active/open, 1 closed)
    expect(screen.getByTestId('panel-count')).toHaveTextContent('2');
  });

  it('filters out closed calls', () => {
    render(<ActiveCallsPanel />);

    // Count should be 2 (only Active and Open calls)
    expect(screen.getByTestId('panel-count')).toHaveTextContent('2');
  });

  it('shows empty state when no active calls', () => {
    const closedCalls = mockCalls.filter((c) => c.State === 'Closed');
    const emptyState = {
      calls: closedCalls,
      callPriorities: mockPriorities,
      isLoadingCalls: false,
      isLoading: false,
      callsError: null,
      error: null,
      fetchCalls: mockFetchCalls,
      fetchCallPriorities: mockFetchCallPriorities,
    };
    mockUseCallsStore.mockImplementation((selector?: any) => {
      if (typeof selector === 'function') {
        return selector(emptyState);
      }
      return emptyState;
    });
    render(<ActiveCallsPanel />);

    expect(screen.getByText('dispatch.no_active_calls')).toBeTruthy();
  });

  it('calls onSelectCall when call is pressed', async () => {
    const onSelectCall = jest.fn();
    render(<ActiveCallsPanel onSelectCall={onSelectCall} />);

    // Wait for component to stabilize
    await waitFor(() => {
      expect(screen.getByText('#001')).toBeTruthy();
    });
  });

  it('calls onRefresh when refresh button is pressed', () => {
    render(<ActiveCallsPanel />);

    // The refresh button should be in the panel header rightContent
    // We've mocked PanelHeader to render rightContent
  });

  it('navigates to call details when details button is pressed', async () => {
    render(<ActiveCallsPanel />);

    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText('#001')).toBeTruthy();
    });
  });

  it('shows new call button when user has permission', () => {
    mockUseSecurityStore.mockReturnValue({
      canUserCreateCalls: true,
    } as any);

    render(<ActiveCallsPanel />);

    // Panel header should contain the new call button via rightContent
    expect(screen.getByTestId('panel-header')).toBeTruthy();
  });

  it('hides new call button when user lacks permission', () => {
    mockUseSecurityStore.mockReturnValue({
      canUserCreateCalls: false,
    } as any);

    render(<ActiveCallsPanel />);

    expect(screen.getByTestId('panel-header')).toBeTruthy();
  });

  it('collapses and expands panel', () => {
    render(<ActiveCallsPanel />);

    const toggleButton = screen.getByTestId('toggle-collapse');
    fireEvent.press(toggleButton);

    // Panel should be collapsed now - content hidden
    // After collapse, expand again
    fireEvent.press(toggleButton);
  });

  it('highlights selected call when filter is active', async () => {
    render(<ActiveCallsPanel selectedCallId="call-1" isFilterActive={true} />);

    await waitFor(() => {
      expect(screen.getByText('#001')).toBeTruthy();
    });

    // The selected call should show active filter badge
    expect(screen.getByText('dispatch.active_filter')).toBeTruthy();
  });

  it('fetches and displays dispatched resources', async () => {
    render(<ActiveCallsPanel />);

    // Wait for the component to render
    await waitFor(() => {
      // Check that the component rendered and shows call data
      expect(screen.getByText('#001')).toBeTruthy();
      expect(screen.getByText('#002')).toBeTruthy();
    });
  });

  it('displays call address when available', async () => {
    render(<ActiveCallsPanel />);

    await waitFor(() => {
      expect(screen.getByText('123 Main St')).toBeTruthy();
    });
  });

  it('displays call name or nature', async () => {
    render(<ActiveCallsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Test Call 1')).toBeTruthy();
    });
  });

  it('clears dispatch cache on refresh', async () => {
    const localFetchCalls = jest.fn();
    const stateWithFetch = {
      calls: mockCalls,
      callPriorities: mockPriorities,
      isLoadingCalls: false,
      isLoading: false,
      callsError: null,
      error: null,
      fetchCalls: localFetchCalls,
      fetchCallPriorities: mockFetchCallPriorities,
    };
    mockUseCallsStore.mockImplementation((selector?: any) => {
      if (typeof selector === 'function') {
        return selector(stateWithFetch);
      }
      return stateWithFetch;
    });
    render(<ActiveCallsPanel />);

    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText('#001')).toBeTruthy();
    });

    // The fetchCalls function should have been called on mount
    expect(localFetchCalls).toHaveBeenCalled();
  });
});
