import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { type CallResultData } from '@/models/v4/calls/callResultData';

import PendingCalls from '../pending-calls';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    // Runs once on mount, like a screen gaining focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useEffect(callback, []);
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({ trackEvent: jest.fn() }),
}));

jest.mock('@/components/ui/focus-aware-status-bar', () => ({
  FocusAwareStatusBar: () => null,
}));

jest.mock('@/components/ui/input', () => {
  const { TextInput, View } = require('react-native');
  return {
    Input: ({ children }: any) => <View>{children}</View>,
    InputField: ({ value, onChangeText, placeholder }: any) => <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} testID="pending-calls-search" />,
    InputIcon: () => null,
    InputSlot: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock('@/components/common/loading', () => ({
  Loading: ({ text }: any) => {
    const { Text } = require('react-native');
    return <Text testID="loading">{text}</Text>;
  },
}));

jest.mock('@/components/common/zero-state', () => ({
  __esModule: true,
  default: ({ heading }: any) => {
    const { Text } = require('react-native');
    return <Text testID="zero-state">{heading}</Text>;
  },
}));

const mockOpenDispatchPicker = jest.fn();
const mockConfirmCancelPending = jest.fn();
jest.mock('@/components/calls/use-call-dispatch-now', () => ({
  useCallDispatchNow: () => ({ openDispatchPicker: mockOpenDispatchPicker, confirmCancelPending: mockConfirmCancelPending, busyCallId: null, dispatchPicker: null }),
}));

const mockPendingState = {
  pendingCalls: [] as CallResultData[],
  isLoading: false,
  error: null as string | null,
  fetchPendingCalls: jest.fn(() => Promise.resolve()),
};
jest.mock('@/stores/calls/pending-store', () => ({
  usePendingCallsStore: (selector: (state: typeof mockPendingState) => unknown) => selector(mockPendingState),
}));

const mockCallsState = { callPriorities: [{ Id: 1, Name: 'Routine', Color: '#00ff00' }], fetchCallPriorities: jest.fn() };
jest.mock('@/stores/calls/store', () => ({
  useCallsStore: (selector: (state: typeof mockCallsState) => unknown) => selector(mockCallsState),
}));

const mockSecurity = { canUserCreateCalls: true };
jest.mock('@/stores/security/store', () => ({
  useSecurityStore: () => mockSecurity,
}));

const mockSignalR = { lastCallsUpdateTimestamp: 0 };
jest.mock('@/stores/signalr/signalr-store', () => ({
  useSignalRStore: (selector: (state: typeof mockSignalR) => unknown) => selector(mockSignalR),
}));

const pendingCall = (callId: string, name: string): CallResultData =>
  ({ CallId: callId, Number: `26-${callId}`, Name: name, Nature: 'Follow-up visit', Type: 'Welfare', Priority: 1, Address: '1 Main St', LoggedOn: '2026-10-06T09:15:00', State: 8 }) as CallResultData;

describe('PendingCalls screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPendingState.pendingCalls = [pendingCall('11', 'Welfare check'), pendingCall('12', 'Medication follow-up')];
    mockPendingState.isLoading = false;
    mockPendingState.error = null;
    mockSecurity.canUserCreateCalls = true;
    mockSignalR.lastCallsUpdateTimestamp = 0;
  });

  it('loads the pending calls when shown', () => {
    render(<PendingCalls />);

    expect(mockPendingState.fetchPendingCalls).toHaveBeenCalledTimes(1);
    expect(mockCallsState.fetchCallPriorities).toHaveBeenCalled();
  });

  it('lists the pending calls with their number, name, priority and received time', () => {
    render(<PendingCalls />);

    expect(screen.getByText('26-11')).toBeTruthy();
    expect(screen.getByText('Welfare check')).toBeTruthy();
    expect(screen.getByText('Medication follow-up')).toBeTruthy();
    expect(screen.getAllByText('Routine')).toHaveLength(2);
    expect(screen.getAllByText('Oct 06, 2026 09:15 am')).toHaveLength(2);
    expect(screen.getByText('pending_calls.table_received')).toBeTruthy();
  });

  it('opens the dispatch picker and the cancel confirmation for a row', () => {
    render(<PendingCalls />);

    fireEvent.press(screen.getByTestId('pending-call-dispatch-12'));
    fireEvent.press(screen.getByTestId('pending-call-cancel-11'));

    expect(mockOpenDispatchPicker).toHaveBeenCalledWith('12');
    expect(mockConfirmCancelPending).toHaveBeenCalledWith('11');
  });

  it('opens the call when a row is pressed', () => {
    const { router } = require('expo-router');
    render(<PendingCalls />);

    fireEvent.press(screen.getByTestId('pending-call-row-11'));

    expect(router.push).toHaveBeenCalledWith('/call/11');
  });

  it('hides the row actions from a user who cannot create calls', () => {
    mockSecurity.canUserCreateCalls = false;
    render(<PendingCalls />);

    expect(screen.queryByTestId('pending-call-dispatch-11')).toBeNull();
    expect(screen.queryByText('dispatch.actions')).toBeNull();
  });

  it('shows the empty state when nothing is pending', () => {
    mockPendingState.pendingCalls = [];
    render(<PendingCalls />);

    expect(screen.getByTestId('zero-state')).toBeTruthy();
    expect(screen.getByText('pending_calls.no_pending_calls')).toBeTruthy();
  });

  it('keeps the rows on screen while a refresh is running', () => {
    mockPendingState.isLoading = true;
    render(<PendingCalls />);

    expect(screen.queryByTestId('loading')).toBeNull();
    expect(screen.getByText('Welfare check')).toBeTruthy();
  });

  it('refreshes when a calls push arrives', () => {
    const { rerender } = render(<PendingCalls />);
    expect(mockPendingState.fetchPendingCalls).toHaveBeenCalledTimes(1);

    act(() => {
      mockSignalR.lastCallsUpdateTimestamp = Date.now();
    });
    rerender(<PendingCalls />);

    expect(mockPendingState.fetchPendingCalls).toHaveBeenCalledTimes(2);
  });

  it('filters by the search text', () => {
    render(<PendingCalls />);

    fireEvent.changeText(screen.getByTestId('pending-calls-search'), 'medication');

    expect(screen.queryByText('Welfare check')).toBeNull();
    expect(screen.getByText('Medication follow-up')).toBeTruthy();
  });
});
