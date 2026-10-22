import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { type AwaitingResourcesCallData } from '@/models/v4/awaitingResources/awaitingResourcesResultData';

import AwaitingResources from '../awaiting-resources';

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
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
  cssInterop: jest.fn(),
}));

jest.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({ trackEvent: jest.fn() }),
}));

jest.mock('@/components/ui/focus-aware-status-bar', () => ({
  FocusAwareStatusBar: () => null,
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

// The dismiss prompt renders inline so the test can type a note and confirm.
jest.mock('@/components/awaiting-resources/dismiss-requirement-modal', () => ({
  DismissRequirementModal: ({ isOpen, requirementLabel, onConfirm }: any) => {
    const { Pressable, Text } = require('react-native');
    return isOpen ? (
      <Pressable testID="dismiss-confirm" onPress={() => onConfirm('Caller cancelled')}>
        <Text>{`dismiss ${requirementLabel}`}</Text>
      </Pressable>
    ) : null;
  },
}));

let mockConditionsEnabled = true;
jest.mock('@/stores/feature-flags/store', () => ({
  FeatureFlagKeys: { DispatchRunCardConditions: 'Dispatch.RunCardConditions' },
  useIsRunCardConditionsEnabled: () => mockConditionsEnabled,
  useFeatureFlagStatus: () => (mockConditionsEnabled ? 'enabled' : 'disabled'),
}));

const mockAwaitingState = {
  calls: [] as AwaitingResourcesCallData[],
  isLoading: false,
  error: null as string | null,
  lastFetched: 1,
  busyKey: null as string | null,
  allResponseCodes: [{ Id: 3, Code: 'C3', Name: 'Lights and siren', Description: null, Color: '#dc2626', SortOrder: 1, Retired: false }],
  fetchAwaitingCalls: jest.fn(() => Promise.resolve()),
  dispatchUnit: jest.fn(() => Promise.resolve(null)),
  dismissRequirement: jest.fn(() => Promise.resolve(true)),
};
jest.mock('@/stores/awaiting-resources/store', () => ({
  useAwaitingResourcesStore: (selector: (state: typeof mockAwaitingState) => unknown) => selector(mockAwaitingState),
}));

const mockSecurity = { canUserCreateCalls: true };
jest.mock('@/stores/security/store', () => ({
  useSecurityStore: () => mockSecurity,
}));

const waitingCall = (overrides: Partial<AwaitingResourcesCallData> = {}): AwaitingResourcesCallData => ({
  CallId: 7,
  CallNumber: '26-7',
  CallName: 'Cardiac arrest',
  Priority: 1,
  PriorityName: 'High',
  PriorityColor: '#dc2626',
  Address: '1 Main St',
  LoggedOn: '2026-10-22T10:00:00',
  Requirements: [
    {
      CallOutstandingRequirementId: 70,
      Label: 'MUG',
      RequiredCount: 1,
      ResolvedCount: 0,
      SentInstead: 'PIT P-21',
      ResponseCode: 'C3',
      CreatedOn: '2026-10-22T10:00:00',
      AvailableUnits: [{ UnitId: 41, UnitName: 'M-1', UnitTypeName: 'MUG', ResponseSeconds: 250 }],
    },
  ],
  ...overrides,
});

describe('AwaitingResources screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConditionsEnabled = true;
    mockSecurity.canUserCreateCalls = true;
    mockAwaitingState.calls = [waitingCall()];
    mockAwaitingState.isLoading = false;
    mockAwaitingState.error = null;
    mockAwaitingState.lastFetched = 1;
    mockAwaitingState.busyKey = null;
  });

  it('refreshes the list when shown', () => {
    render(<AwaitingResources />);

    expect(mockAwaitingState.fetchAwaitingCalls).toHaveBeenCalledTimes(1);
  });

  it('lists each waiting call with what it awaits, what went instead, its code and the units available now', () => {
    render(<AwaitingResources />);

    expect(screen.getByText('26-7 · Cardiac arrest')).toBeTruthy();
    expect(screen.getByText('High')).toBeTruthy();
    expect(screen.getByText(/requirement_progress .*"label":"MUG","resolved":0,"required":1/)).toBeTruthy();
    expect(screen.getByText(/sent_instead .*PIT P-21/)).toBeTruthy();
    expect(screen.getByText('C3')).toBeTruthy();
    expect(screen.getByText('M-1 (MUG)')).toBeTruthy();
    expect(screen.getByText(/response_time .*"time":"4:10"/)).toBeTruthy();
  });

  it('dispatches an available unit to the call in one step', () => {
    render(<AwaitingResources />);

    fireEvent.press(screen.getByTestId('awaiting-requirement-70-unit-41-dispatch'));

    expect(mockAwaitingState.dispatchUnit).toHaveBeenCalledWith(7, 41);
  });

  it('dismisses a requirement with the note given', async () => {
    render(<AwaitingResources />);

    fireEvent.press(screen.getByTestId('awaiting-requirement-70-dismiss'));
    expect(screen.getByText('dismiss MUG')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('dismiss-confirm'));
    });

    expect(mockAwaitingState.dismissRequirement).toHaveBeenCalledWith(7, 70, 'Caller cancelled');
    // The prompt closes once the dismiss took.
    expect(screen.queryByTestId('dismiss-confirm')).toBeNull();
  });

  it('opens the call', () => {
    const { router } = require('expo-router');
    render(<AwaitingResources />);

    fireEvent.press(screen.getByTestId('awaiting-call-7-open'));

    expect(router.push).toHaveBeenCalledWith('/call/7');
  });

  it('says so when no matching unit is available', () => {
    mockAwaitingState.calls = [waitingCall({ Requirements: [{ ...waitingCall().Requirements[0], AvailableUnits: [] }] })];
    render(<AwaitingResources />);

    expect(screen.getByTestId('awaiting-requirement-70-no-units')).toBeTruthy();
  });

  it('offers no actions to someone who cannot edit calls', () => {
    mockSecurity.canUserCreateCalls = false;
    render(<AwaitingResources />);

    expect(screen.queryByTestId('awaiting-requirement-70-unit-41-dispatch')).toBeNull();
    expect(screen.queryByTestId('awaiting-requirement-70-dismiss')).toBeNull();
  });

  it('shows the empty state when nothing is waiting', () => {
    mockAwaitingState.calls = [];
    render(<AwaitingResources />);

    expect(screen.getByText('awaiting_resources.empty_title')).toBeTruthy();
  });

  it('neither asks nor lists anything without Dispatch.RunCardConditions', () => {
    mockConditionsEnabled = false;
    render(<AwaitingResources />);

    expect(mockAwaitingState.fetchAwaitingCalls).not.toHaveBeenCalled();
    expect(screen.getByText('awaiting_resources.not_enabled')).toBeTruthy();
    expect(screen.queryByTestId('awaiting-resources-list')).toBeNull();
  });
});
