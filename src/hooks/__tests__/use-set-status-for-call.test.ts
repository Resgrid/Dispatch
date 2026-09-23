import { act, renderHook } from '@testing-library/react-native';

import { savePersonsStatuses } from '@/api/personnel/personnelStatuses';
import { saveUnitStatus } from '@/api/units/unitStatuses';
import { CustomStateDetailType, DestinationEntityType } from '@/lib/destination-helpers';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import { type StatusesResultData } from '@/models/v4/statuses/statusesResultData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';
import { useDispatchConsoleStore } from '@/stores/dispatch/dispatch-console-store';
import { usePersonnelActionsStore } from '@/stores/dispatch/personnel-actions-store';
import { useUnitActionsStore } from '@/stores/dispatch/unit-actions-store';

import { useSetStatusForCall } from '../use-set-status-for-call';

jest.mock('@/api/units/unitStatuses', () => ({
  saveUnitStatus: jest.fn(),
}));

jest.mock('@/api/personnel/personnelStatuses', () => ({
  savePersonsStatuses: jest.fn(),
}));

jest.mock('@/api/personnel/personnelStaffing', () => ({
  savePersonsStaffings: jest.fn(),
}));

const mockSaveUnitStatus = saveUnitStatus as jest.MockedFunction<typeof saveUnitStatus>;
const mockSavePersonsStatuses = savePersonsStatuses as jest.MockedFunction<typeof savePersonsStatuses>;

const selectedCall = { CallId: '777', Number: '26-777', Name: 'MVA', State: 0 } as CallResultData;
const otherCall = { CallId: '888', Number: '26-888', Name: 'Alarm', State: 0 } as CallResultData;
const engine = { UnitId: 'e1', Name: 'Engine 1', CurrentDestinationId: '' } as UnitInfoResultData;
const medic = { UnitId: 'm1', Name: 'Medic 1', CurrentDestinationId: '' } as UnitInfoResultData;
const firefighter = { UserId: 'u-ff', FirstName: 'Sam', LastName: 'Smith', StatusDestinationId: '' } as PersonnelInfoResultData;
const onScene = { Id: 6, Text: 'On Scene', Detail: CustomStateDetailType.Calls, Note: 0 } as StatusesResultData;
// A status whose Detail lists no destinations — the explicit call context still carries the call
const available = { Id: 0, Text: 'Available', Detail: CustomStateDetailType.None, Note: 0 } as StatusesResultData;

describe('useSetStatusForCall', () => {
  const setSelectedUnitData = jest.fn();
  const setSelectedPersonnelData = jest.fn();

  const renderHandlers = () =>
    renderHook(() =>
      useSetStatusForCall({
        calls: [otherCall, selectedCall],
        units: [engine, medic],
        personnel: [firefighter],
        selectedCallId: selectedCall.CallId,
        setSelectedUnitData,
        setSelectedPersonnelData,
      })
    );

  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveUnitStatus.mockResolvedValue({} as any);
    mockSavePersonsStatuses.mockResolvedValue({} as any);
    useUnitActionsStore.getState().reset();
    usePersonnelActionsStore.getState().reset();
    useDispatchConsoleStore.setState({ selectedUnitId: null, selectedPersonnelId: null });
  });

  it('"+" on a unit selects it and opens the unit actions panel with the selected call preset', async () => {
    const { result } = renderHandlers();

    act(() => {
      result.current.handleSetUnitStatusForCall('m1');
    });

    expect(useDispatchConsoleStore.getState().selectedUnitId).toBe('m1');
    expect(useDispatchConsoleStore.getState().selectedPersonnelId).toBeNull();
    expect(setSelectedUnitData).toHaveBeenCalledWith(medic);
    expect(setSelectedPersonnelData).toHaveBeenCalledWith(null);

    const unitActions = useUnitActionsStore.getState();
    expect(unitActions.isActionsOpen).toBe(true);
    expect(unitActions.selectedUnit).toBe(medic);
    expect(unitActions.callContext).toBe(selectedCall);
    expect(unitActions.statusDestinationType).toBe('call');
    expect(unitActions.statusSelectedCall).toBe(selectedCall);

    // The dispatcher picks the status and saves through the normal path
    await act(async () => {
      await useUnitActionsStore.getState().submitStatus({ status: available });
    });
    expect(mockSaveUnitStatus).toHaveBeenCalledWith(expect.objectContaining({ Id: 'm1', Type: '0', RespondingTo: '777', RespondingToType: DestinationEntityType.Call }));

    await act(async () => {
      await useUnitActionsStore.getState().submitStatus({ status: onScene });
    });
    expect(mockSaveUnitStatus).toHaveBeenLastCalledWith(expect.objectContaining({ Id: 'm1', Type: '6', RespondingTo: '777', RespondingToType: DestinationEntityType.Call }));
  });

  it('"+" on a person selects them and opens the personnel actions panel with the selected call preset', async () => {
    const { result } = renderHandlers();

    act(() => {
      result.current.handleSetPersonnelStatusForCall('u-ff');
    });

    expect(useDispatchConsoleStore.getState().selectedPersonnelId).toBe('u-ff');
    expect(useDispatchConsoleStore.getState().selectedUnitId).toBeNull();
    expect(setSelectedPersonnelData).toHaveBeenCalledWith(firefighter);
    expect(setSelectedUnitData).toHaveBeenCalledWith(null);

    const personnelActions = usePersonnelActionsStore.getState();
    expect(personnelActions.isActionsOpen).toBe(true);
    expect(personnelActions.callContext).toBe(selectedCall);
    expect(personnelActions.statusSelectedCall).toBe(selectedCall);

    await act(async () => {
      await usePersonnelActionsStore.getState().submitStatus({ status: onScene });
    });
    expect(mockSavePersonsStatuses).toHaveBeenCalledWith(expect.objectContaining({ UserIds: ['u-ff'], Type: '6', RespondingTo: '777', RespondingToType: DestinationEntityType.Call }));
  });

  it('re-targets an already-open panel for the same unit with a new session and the call preset', () => {
    useUnitActionsStore.getState().openActions(engine);
    const session = useUnitActionsStore.getState().actionsSessionId;
    const { result } = renderHandlers();

    act(() => {
      result.current.handleSetUnitStatusForCall('e1');
    });

    expect(useUnitActionsStore.getState().actionsSessionId).toBe(session + 1);
    expect(useUnitActionsStore.getState().callContext).toBe(selectedCall);
  });

  it('ignores an unknown unit or person', () => {
    const { result } = renderHandlers();

    act(() => {
      result.current.handleSetUnitStatusForCall('missing');
      result.current.handleSetPersonnelStatusForCall('missing');
    });

    expect(useUnitActionsStore.getState().isActionsOpen).toBe(false);
    expect(usePersonnelActionsStore.getState().isActionsOpen).toBe(false);
    expect(setSelectedUnitData).not.toHaveBeenCalled();
  });
});
