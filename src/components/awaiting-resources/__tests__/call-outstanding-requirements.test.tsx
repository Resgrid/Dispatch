import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { getCallRequirements } from '@/api/awaitingResources/awaitingResources';
import { CallOutstandingRequirements } from '@/components/awaiting-resources/call-outstanding-requirements';
import { type CallOutstandingRequirementData, OutstandingRequirementResolution } from '@/models/v4/awaitingResources/awaitingResourcesResultData';

jest.mock('@/api/awaitingResources/awaitingResources', () => ({
  getCallRequirements: jest.fn(),
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

jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

let mockConditionsEnabled = true;
jest.mock('@/stores/feature-flags/store', () => ({
  useIsRunCardConditionsEnabled: () => mockConditionsEnabled,
}));

const mockAwaitingState = {
  lastPushAt: 0,
  busyKey: null as string | null,
  allResponseCodes: [{ Id: 3, Code: 'C3', Name: 'Lights and siren', Description: null, Color: '#dc2626', SortOrder: 1, Retired: false }],
  dismissRequirement: jest.fn(() => Promise.resolve(true)),
};
jest.mock('@/stores/awaiting-resources/store', () => ({
  useAwaitingResourcesStore: (selector: (state: typeof mockAwaitingState) => unknown) => selector(mockAwaitingState),
}));

const mockedGetCallRequirements = getCallRequirements as jest.Mock;

const requirement = (overrides: Partial<CallOutstandingRequirementData> = {}): CallOutstandingRequirementData => ({
  CallOutstandingRequirementId: 70,
  DepartmentId: 1,
  CallId: 7,
  Label: 'MUG',
  TargetsJson: null,
  RequiredCount: 1,
  ResolvedCount: 0,
  StatusFilter: 0,
  ResponseCodeId: 3,
  ResponseCode: 'C3',
  RunCardId: 4,
  AlarmLevel: 1,
  SentInstead: 'PIT P-21',
  CreatedOn: '2026-10-22T10:00:00',
  CreatedByUserId: null,
  ResolvedOn: null,
  Resolution: OutstandingRequirementResolution.Open,
  ResolutionNote: null,
  ...overrides,
});

describe('CallOutstandingRequirements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConditionsEnabled = true;
    mockAwaitingState.busyKey = null;
    mockedGetCallRequirements.mockResolvedValue([requirement()]);
  });

  it("shows what the call is still awaiting, what went instead and the row's code", async () => {
    render(<CallOutstandingRequirements callId="7" canDismiss />);

    await waitFor(() => expect(screen.getByTestId('call-outstanding-requirements')).toBeTruthy());
    expect(mockedGetCallRequirements).toHaveBeenCalledWith('7');
    expect(screen.getByText(/requirement_progress .*"label":"MUG"/)).toBeTruthy();
    expect(screen.getByText(/sent_instead .*PIT P-21/)).toBeTruthy();
    expect(screen.getByText('C3')).toBeTruthy();
  });

  it('dismisses a requirement with a note after confirming in place', async () => {
    render(<CallOutstandingRequirements callId="7" canDismiss />);
    await waitFor(() => expect(screen.getByTestId('call-outstanding-requirements-70-dismiss')).toBeTruthy());

    fireEvent.press(screen.getByTestId('call-outstanding-requirements-70-dismiss'));
    fireEvent.changeText(screen.getByTestId('call-outstanding-requirements-70-note'), '  Caller cancelled  ');
    mockedGetCallRequirements.mockResolvedValue([]);
    await act(async () => {
      fireEvent.press(screen.getByTestId('call-outstanding-requirements-70-confirm-button'));
    });

    expect(mockAwaitingState.dismissRequirement).toHaveBeenCalledWith(7, 70, 'Caller cancelled');
    await waitFor(() => expect(screen.queryByTestId('call-outstanding-requirements')).toBeNull());
  });

  it('offers no dismiss to someone who cannot edit the call', async () => {
    render(<CallOutstandingRequirements callId="7" canDismiss={false} />);

    await waitFor(() => expect(screen.getByTestId('call-outstanding-requirements')).toBeTruthy());
    expect(screen.queryByTestId('call-outstanding-requirements-70-dismiss')).toBeNull();
  });

  it('renders nothing for a call awaiting nothing', async () => {
    mockedGetCallRequirements.mockResolvedValue([]);
    render(<CallOutstandingRequirements callId="7" canDismiss />);

    await waitFor(() => expect(mockedGetCallRequirements).toHaveBeenCalled());
    expect(screen.queryByTestId('call-outstanding-requirements')).toBeNull();
  });

  it('asks nothing without Dispatch.RunCardConditions', async () => {
    mockConditionsEnabled = false;
    render(<CallOutstandingRequirements callId="7" canDismiss />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockedGetCallRequirements).not.toHaveBeenCalled();
    expect(screen.queryByTestId('call-outstanding-requirements')).toBeNull();
  });
});
