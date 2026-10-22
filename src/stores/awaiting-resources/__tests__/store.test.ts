import { act } from '@testing-library/react-native';

import { dismissRequirement, dispatchUnitToAwaitingCall, getAwaitingCalls, getResponseCodes } from '@/api/awaitingResources/awaitingResources';
import { useAwaitingResourcesStore } from '@/stores/awaiting-resources/store';
import { isRunCardConditionsEnabled } from '@/stores/feature-flags/store';

jest.mock('@/api/awaitingResources/awaitingResources', () => ({
  getAwaitingCalls: jest.fn(),
  getCallRequirements: jest.fn(),
  dismissRequirement: jest.fn(),
  dispatchUnitToAwaitingCall: jest.fn(),
  getResponseCodes: jest.fn(),
}));

jest.mock('@/stores/feature-flags/store', () => ({
  isRunCardConditionsEnabled: jest.fn(() => true),
}));

const mockShowToast = jest.fn();
jest.mock('@/stores/toast/store', () => ({
  useToastStore: { getState: () => ({ showToast: mockShowToast }) },
}));

jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockedGetAwaitingCalls = getAwaitingCalls as jest.Mock;
const mockedDismiss = dismissRequirement as jest.Mock;
const mockedDispatch = dispatchUnitToAwaitingCall as jest.Mock;
const mockedGetResponseCodes = getResponseCodes as jest.Mock;
const mockedIsEnabled = isRunCardConditionsEnabled as jest.Mock;

const waitingCall = (callId: number) => ({
  CallId: callId,
  CallNumber: `26-${callId}`,
  CallName: 'Cardiac arrest',
  Priority: 1,
  PriorityName: 'High',
  PriorityColor: '#ff0000',
  Address: '1 Main St',
  LoggedOn: '2026-10-22T10:00:00',
  Requirements: [{ CallOutstandingRequirementId: callId * 10, Label: 'MUG', RequiredCount: 1, ResolvedCount: 0, SentInstead: 'PIT P-21', ResponseCode: 'C3', CreatedOn: '2026-10-22T10:00:00', AvailableUnits: [] }],
});

const unitAvailablePayload = (unitId: number, callIds: number[]) =>
  JSON.stringify({
    kind: 1,
    unitId,
    unitName: `M-${unitId}`,
    unitTypeName: 'MUG',
    message: `M-${unitId} available`,
    calls: callIds.map((callId) => ({ callId, callNumber: `26-${callId}`, callName: 'Cardiac arrest', priority: 1, label: 'MUG', responseSeconds: 240, ageMinutes: 5 })),
  });

/** Lets the refresh each action starts settle. */
const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

describe('useAwaitingResourcesStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsEnabled.mockReturnValue(true);
    mockedGetAwaitingCalls.mockResolvedValue({ Enabled: true, Data: [waitingCall(7), waitingCall(8)] });
    useAwaitingResourcesStore.getState().reset();
  });

  it('loads the calls awaiting resources', async () => {
    await act(async () => {
      await useAwaitingResourcesStore.getState().fetchAwaitingCalls();
    });

    expect(useAwaitingResourcesStore.getState().calls.map((call) => call.CallId)).toEqual([7, 8]);
    expect(useAwaitingResourcesStore.getState().lastFetched).toBeGreaterThan(0);
  });

  it('asks nothing and holds nothing without Dispatch.RunCardConditions', async () => {
    mockedIsEnabled.mockReturnValue(false);
    useAwaitingResourcesStore.setState({ calls: [waitingCall(7)] as never });

    await act(async () => {
      await useAwaitingResourcesStore.getState().fetchAwaitingCalls();
    });

    expect(mockedGetAwaitingCalls).not.toHaveBeenCalled();
    expect(useAwaitingResourcesStore.getState().calls).toEqual([]);
  });

  it('empties the list when the server says the department turned the feature off', async () => {
    mockedGetAwaitingCalls.mockResolvedValue({ Enabled: false, Data: [] });

    await act(async () => {
      await useAwaitingResourcesStore.getState().fetchAwaitingCalls();
    });

    expect(useAwaitingResourcesStore.getState().calls).toEqual([]);
  });

  it('keeps the last list when a refresh fails', async () => {
    await act(async () => {
      await useAwaitingResourcesStore.getState().fetchAwaitingCalls();
    });
    mockedGetAwaitingCalls.mockRejectedValue(new Error('offline'));

    await act(async () => {
      await useAwaitingResourcesStore.getState().fetchAwaitingCalls();
    });

    expect(useAwaitingResourcesStore.getState().calls).toHaveLength(2);
    expect(useAwaitingResourcesStore.getState().error).toBe('offline');
  });

  it('loads the response codes once, leaving retired ones out of the picker', async () => {
    mockedGetResponseCodes.mockResolvedValue({
      Codes: [
        { Id: 1, Code: 'C3', Name: 'Lights and siren', Description: null, Color: '#ff0000', SortOrder: 1, Retired: false },
        { Id: 2, Code: 'C9', Name: 'Old', Description: null, Color: null, SortOrder: 2, Retired: true },
      ],
      ShowToCrews: true,
    });

    await act(async () => {
      await useAwaitingResourcesStore.getState().fetchResponseCodes();
      await useAwaitingResourcesStore.getState().fetchResponseCodes();
    });

    const state = useAwaitingResourcesStore.getState();
    expect(mockedGetResponseCodes).toHaveBeenCalledTimes(1);
    expect(state.responseCodes.map((code) => code.Code)).toEqual(['C3']);
    expect(state.allResponseCodes).toHaveLength(2);
    expect(state.showCodesToCrews).toBe(true);
  });

  describe('outstandingRequirementsUpdated', () => {
    it('refreshes the list on an id-only push from an older server', async () => {
      act(() => {
        useAwaitingResourcesStore.getState().handleOutstandingRequirementsUpdated('7');
      });
      await flush();

      expect(mockedGetAwaitingCalls).toHaveBeenCalledTimes(1);
      expect(useAwaitingResourcesStore.getState().unitAlerts).toEqual([]);
    });

    it('raises a lasting alert for a unit that became available, one per unit', async () => {
      act(() => {
        useAwaitingResourcesStore.getState().handleOutstandingRequirementsUpdated('0', unitAvailablePayload(41, [7]));
        useAwaitingResourcesStore.getState().handleOutstandingRequirementsUpdated('0', unitAvailablePayload(41, [7, 8]));
      });
      await flush();

      const alerts = useAwaitingResourcesStore.getState().unitAlerts;
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toEqual(expect.objectContaining({ id: 'unit-41', unitId: 41, unitName: 'M-41' }));
      expect(alerts[0].calls.map((call) => call.callId)).toEqual([7, 8]);
      // Not a toast: it has to stay until acted on.
      expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('drops an alert once none of its calls is waiting any more', async () => {
      act(() => {
        useAwaitingResourcesStore.getState().handleOutstandingRequirementsUpdated('0', unitAvailablePayload(41, [9]));
      });
      await flush();

      expect(useAwaitingResourcesStore.getState().unitAlerts).toEqual([]);
    });

    it("announces an automatic dispatch and clears that unit's alert", async () => {
      act(() => {
        useAwaitingResourcesStore.getState().handleOutstandingRequirementsUpdated('0', unitAvailablePayload(41, [7]));
      });
      await flush();

      act(() => {
        useAwaitingResourcesStore.getState().handleOutstandingRequirementsUpdated('7', JSON.stringify({ kind: 2, unitId: 41, unitName: 'M-41', message: 'M-41 sent to 26-7', calls: [] }));
      });
      await flush();

      expect(useAwaitingResourcesStore.getState().unitAlerts).toEqual([]);
      expect(mockShowToast).toHaveBeenCalledWith('info', 'M-41 sent to 26-7', 'awaiting_resources.auto_dispatched_title', expect.objectContaining({ duration: expect.any(Number) }));
    });

    it('ignores pushes without Dispatch.RunCardConditions', async () => {
      mockedIsEnabled.mockReturnValue(false);

      act(() => {
        useAwaitingResourcesStore.getState().handleOutstandingRequirementsUpdated('0', unitAvailablePayload(41, [7]));
      });
      await flush();

      expect(mockedGetAwaitingCalls).not.toHaveBeenCalled();
      expect(useAwaitingResourcesStore.getState().unitAlerts).toEqual([]);
    });
  });

  describe('actions', () => {
    it('dispatches a unit to a waiting call, spends its alert and refreshes', async () => {
      mockedDispatch.mockResolvedValue({ Success: true, Message: 'M-41 added to 26-7', Resolved: 1 });
      act(() => {
        useAwaitingResourcesStore.getState().handleOutstandingRequirementsUpdated('0', unitAvailablePayload(41, [7]));
      });
      await flush();
      mockedGetAwaitingCalls.mockClear();

      let result: unknown;
      await act(async () => {
        result = await useAwaitingResourcesStore.getState().dispatchUnit(7, 41);
      });
      await flush();

      expect(mockedDispatch).toHaveBeenCalledWith(7, 41);
      expect(result).toEqual(expect.objectContaining({ Success: true }));
      expect(useAwaitingResourcesStore.getState().unitAlerts).toEqual([]);
      expect(useAwaitingResourcesStore.getState().busyKey).toBeNull();
      expect(mockShowToast).toHaveBeenCalledWith('success', 'M-41 added to 26-7');
      expect(mockedGetAwaitingCalls).toHaveBeenCalled();
    });

    it("shows the server's reason when a dispatch does not take", async () => {
      mockedDispatch.mockResolvedValue({ Success: false, Message: 'The unit is no longer available.', Resolved: 0 });

      await act(async () => {
        await useAwaitingResourcesStore.getState().dispatchUnit(7, 41);
      });

      expect(mockShowToast).toHaveBeenCalledWith('error', 'The unit is no longer available.');
    });

    it('dismisses a requirement with its note', async () => {
      mockedDismiss.mockResolvedValue({ Success: true, Resolved: 0 });

      let dismissed = false;
      await act(async () => {
        dismissed = await useAwaitingResourcesStore.getState().dismissRequirement(7, 70, 'Caller cancelled');
      });

      expect(dismissed).toBe(true);
      expect(mockedDismiss).toHaveBeenCalledWith(7, 70, 'Caller cancelled');
      expect(mockShowToast).toHaveBeenCalledWith('success', 'awaiting_resources.dismiss_success');
    });

    it('reports a failed dismiss', async () => {
      mockedDismiss.mockRejectedValue(new Error('500'));

      let dismissed = true;
      await act(async () => {
        dismissed = await useAwaitingResourcesStore.getState().dismissRequirement(7, 70);
      });

      expect(dismissed).toBe(false);
      expect(mockShowToast).toHaveBeenCalledWith('error', 'awaiting_resources.dismiss_error');
    });
  });
});
