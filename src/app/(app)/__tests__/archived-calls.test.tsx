import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { type CallResultData } from '@/models/v4/calls/callResultData';

import ArchivedCalls from '../archived-calls';

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
  useTranslation: () => ({ t: (key: string, options?: Record<string, unknown>) => (options && 'count' in options ? `${key}:${options.count}/${options.total}` : key) }),
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
    InputField: ({ value, onChangeText, placeholder }: any) => <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} testID="archived-calls-search" />,
    InputIcon: () => null,
    InputSlot: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock('@/components/operations/option-select', () => ({
  OptionSelect: ({ value, options, onChange, testID }: any) => {
    const { Pressable, Text, View } = require('react-native');
    return (
      <View testID={testID}>
        <Text>{value}</Text>
        {options.map((option: { value: string; label: string }) => (
          <Pressable key={option.value} testID={`${testID}-${option.value}`} onPress={() => onChange(option.value)}>
            <Text>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  },
}));

jest.mock('@/components/common/date-time-field', () => ({
  DateTimeField: ({ value, onChange, testID }: any) => {
    const { TextInput } = require('react-native');
    return <TextInput value={value} onChangeText={onChange} testID={testID} />;
  },
}));

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

const mockArchivedState = {
  years: ['2026', '2025'],
  selectedYear: '2026' as string | null,
  archivedCalls: [] as CallResultData[],
  isLoading: false,
  error: null as string | null,
  lastFetched: 0,
  load: jest.fn(() => Promise.resolve()),
  selectYear: jest.fn(() => Promise.resolve()),
  fetchArchivedCalls: jest.fn(() => Promise.resolve()),
};
jest.mock('@/stores/calls/archived-store', () => ({
  useArchivedCallsStore: Object.assign((selector: (state: typeof mockArchivedState) => unknown) => selector(mockArchivedState), { getState: () => mockArchivedState }),
}));

const mockCallsState = {
  callPriorities: [
    { Id: 1, Name: 'Routine', Color: '#00ff00' },
    { Id: 2, Name: 'Emergency', Color: '#ff0000' },
  ],
  fetchCallPriorities: jest.fn(),
};
jest.mock('@/stores/calls/store', () => ({
  useCallsStore: (selector: (state: typeof mockCallsState) => unknown) => selector(mockCallsState),
}));

const mockSecurity = { canUserCreateCalls: true };
jest.mock('@/stores/security/store', () => ({
  useSecurityStore: () => mockSecurity,
}));

const archivedCall = (callId: string, overrides: Partial<CallResultData>): CallResultData =>
  ({
    CallId: callId,
    Number: `26-${callId}`,
    Name: 'Call',
    Nature: '',
    Type: 'Fire',
    Priority: 1,
    Address: '1 Main St',
    LoggedOn: '2026-03-05T14:22:00',
    ClosedOn: '2026-03-05T16:00:00',
    State: 1,
    ...overrides,
  }) as CallResultData;

describe('ArchivedCalls screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockArchivedState.archivedCalls = [
      archivedCall('41', { Name: 'Welfare check', Nature: 'Adult in distress', Type: 'EMS', Priority: 2, State: 2 }),
      archivedCall('40', { Name: 'Structure fire', Nature: 'Smoke showing', State: 1 }),
    ];
    mockArchivedState.selectedYear = '2026';
    mockArchivedState.lastFetched = 0;
    mockArchivedState.isLoading = false;
    mockArchivedState.error = null;
    mockSecurity.canUserCreateCalls = true;
  });

  it('loads the years and calls, and the priorities, when shown', () => {
    render(<ArchivedCalls />);

    expect(mockArchivedState.load).toHaveBeenCalledTimes(1);
    expect(mockCallsState.fetchCallPriorities).toHaveBeenCalled();
  });

  it('reuses a year loaded a moment ago when shown again', () => {
    mockArchivedState.lastFetched = Date.now();
    render(<ArchivedCalls />);

    expect(mockArchivedState.load).not.toHaveBeenCalled();
  });

  it('lists the archived calls with how and when they closed', () => {
    render(<ArchivedCalls />);

    expect(screen.getByText('26-41')).toBeTruthy();
    expect(screen.getByText('Welfare check')).toBeTruthy();
    expect(screen.getByText('Adult in distress')).toBeTruthy();
    expect(screen.getByText('call_detail.close_call_types.cancelled')).toBeTruthy();
    expect(screen.getByText('call_detail.close_call_types.closed')).toBeTruthy();
    expect(screen.getAllByText('Mar 05, 2026 02:22 pm')).toHaveLength(2);
    expect(screen.getAllByText('Mar 05, 2026 04:00 pm')).toHaveLength(2);
  });

  it('opens the call when a row is pressed', () => {
    const { router } = require('expo-router');
    render(<ArchivedCalls />);

    fireEvent.press(screen.getByTestId('archived-call-row-40'));

    expect(router.push).toHaveBeenCalledWith('/call/40');
  });

  it('searches the calls and says how many match', () => {
    render(<ArchivedCalls />);

    fireEvent.changeText(screen.getByTestId('archived-calls-search'), 'distress');

    expect(screen.getByText('Welfare check')).toBeTruthy();
    expect(screen.queryByText('Structure fire')).toBeNull();
    expect(screen.getByText('archived_calls.showing:1/2')).toBeTruthy();
  });

  it('filters by close type, and clears the filters', () => {
    render(<ArchivedCalls />);

    fireEvent.press(screen.getByTestId('archived-calls-filters-toggle'));
    fireEvent.press(screen.getByTestId('archived-filter-state-1'));

    expect(screen.queryByText('Welfare check')).toBeNull();
    expect(screen.getByText('Structure fire')).toBeTruthy();

    fireEvent.press(screen.getByTestId('archived-filters-clear'));

    expect(screen.getByText('Welfare check')).toBeTruthy();
  });

  it('filters by priority and by the types the calls carry', () => {
    render(<ArchivedCalls />);

    fireEvent.press(screen.getByTestId('archived-calls-filters-toggle'));
    fireEvent.press(screen.getByTestId('archived-filter-type-EMS'));

    expect(screen.getByText('Welfare check')).toBeTruthy();
    expect(screen.queryByText('Structure fire')).toBeNull();

    fireEvent.press(screen.getByTestId('archived-filter-type-EMS'));
    fireEvent.press(screen.getByTestId('archived-filter-priority-1'));

    expect(screen.queryByText('Welfare check')).toBeNull();
    expect(screen.getByText('Structure fire')).toBeTruthy();
  });

  it('switches the year', () => {
    render(<ArchivedCalls />);

    fireEvent.press(screen.getByTestId('archived-calls-year-2025'));

    expect(mockArchivedState.selectYear).toHaveBeenCalledWith('2025');
  });

  it('opens Add Archived Call for a user who can create calls, and hides it otherwise', () => {
    const { router } = require('expo-router');
    const { rerender } = render(<ArchivedCalls />);

    fireEvent.press(screen.getByTestId('archived-calls-add'));
    expect(router.push).toHaveBeenCalledWith('/call/new/archived');

    mockSecurity.canUserCreateCalls = false;
    rerender(<ArchivedCalls />);
    expect(screen.queryByTestId('archived-calls-add')).toBeNull();
  });

  it('says when the year has no archived calls, and when nothing matches', () => {
    const { rerender } = render(<ArchivedCalls />);

    fireEvent.changeText(screen.getByTestId('archived-calls-search'), 'no such call');
    expect(screen.getByText('archived_calls.no_matches')).toBeTruthy();

    mockArchivedState.archivedCalls = [];
    rerender(<ArchivedCalls />);
    expect(screen.getByText('archived_calls.no_archived_calls')).toBeTruthy();
  });

  it('shows the error when nothing could be loaded', () => {
    mockArchivedState.archivedCalls = [];
    mockArchivedState.error = 'Network down';
    render(<ArchivedCalls />);

    expect(screen.getByText('common.errorOccurred')).toBeTruthy();
  });

  it('keeps the rows on screen while a refresh is running', () => {
    mockArchivedState.isLoading = true;
    render(<ArchivedCalls />);

    expect(screen.queryByTestId('loading')).toBeNull();
    expect(screen.getByText('Welfare check')).toBeTruthy();
  });
});
