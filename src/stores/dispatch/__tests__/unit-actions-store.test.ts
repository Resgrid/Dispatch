import { saveUnitStatus } from '@/api/units/unitStatuses';
import { CustomStateDetailType, DestinationEntityType } from '@/lib/destination-helpers';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type GroupResultData } from '@/models/v4/groups/groupsResultData';
import { type StatusesResultData } from '@/models/v4/statuses/statusesResultData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';

import { useUnitActionsStore } from '../unit-actions-store';

jest.mock('@/api/units/unitStatuses', () => ({
  saveUnitStatus: jest.fn(),
}));

const mockSaveUnitStatus = saveUnitStatus as jest.MockedFunction<typeof saveUnitStatus>;

const unit = (UnitId: string): UnitInfoResultData => ({ UnitId, Name: `Unit ${UnitId}`, CurrentDestinationId: '' }) as UnitInfoResultData;
const status = (Id: number, Text: string, Detail: number): StatusesResultData => ({ Id, Text, Detail, Note: 0 }) as StatusesResultData;
const call: CallResultData = { CallId: '1234', Number: '26-1', Name: 'Structure Fire', State: 0 } as CallResultData;
const station: GroupResultData = { GroupId: '55', Name: 'Station 5' } as GroupResultData;

const responding = status(3, 'Responding', CustomStateDetailType.Calls);
const onScene = status(6, 'On Scene', CustomStateDetailType.Calls);
const returning = status(7, 'Returning', CustomStateDetailType.Stations);
const outOfService = status(8, 'Out of Service', CustomStateDetailType.None);

const lastPayload = () => mockSaveUnitStatus.mock.calls[mockSaveUnitStatus.mock.calls.length - 1][0];

describe('useUnitActionsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveUnitStatus.mockResolvedValue({} as any);
    useUnitActionsStore.getState().reset();
  });

  it('keeps the call destination sticky after a successful submit so the next status carries it too', async () => {
    const store = useUnitActionsStore.getState();
    store.openActions(unit('u1'));
    store.setStatusSelectedCall(call);

    await expect(useUnitActionsStore.getState().submitStatus({ status: responding })).resolves.toBe(true);
    expect(lastPayload()).toMatchObject({ Id: 'u1', Type: '3', RespondingTo: '1234', RespondingToType: DestinationEntityType.Call });

    const afterSubmit = useUnitActionsStore.getState();
    expect(afterSubmit.selectedStatus).toBeNull();
    expect(afterSubmit.statusNote).toBe('');
    expect(afterSubmit.statusDestinationType).toBe('call');
    expect(afterSubmit.statusSelectedCall).toBe(call);

    await useUnitActionsStore.getState().submitStatus({ status: onScene });
    expect(lastPayload()).toMatchObject({ Type: '6', RespondingTo: '1234', RespondingToType: DestinationEntityType.Call });
  });

  it('does not send a destination the status Detail does not support', async () => {
    const store = useUnitActionsStore.getState();
    store.openActions(unit('u1'));
    store.setStatusSelectedCall(call);

    await useUnitActionsStore.getState().submitStatus({ status: outOfService });
    expect(lastPayload()).toMatchObject({ Type: '8', RespondingTo: '', RespondingToType: null });

    await useUnitActionsStore.getState().submitStatus({ status: returning });
    expect(lastPayload()).toMatchObject({ Type: '7', RespondingTo: '', RespondingToType: null });

    useUnitActionsStore.getState().setStatusSelectedStation(station);
    await useUnitActionsStore.getState().submitStatus({ status: returning });
    expect(lastPayload()).toMatchObject({ Type: '7', RespondingTo: '55', RespondingToType: DestinationEntityType.Station });

    await useUnitActionsStore.getState().submitStatus({ status: onScene });
    expect(lastPayload()).toMatchObject({ Type: '6', RespondingTo: '', RespondingToType: null });
  });

  it('presets the call for an explicit call context and sends it even when the status Detail does not list calls', async () => {
    useUnitActionsStore.getState().openActions(unit('u1'), { callContext: call });

    const opened = useUnitActionsStore.getState();
    expect(opened.callContext).toBe(call);
    expect(opened.statusDestinationType).toBe('call');
    expect(opened.statusSelectedCall).toBe(call);

    await useUnitActionsStore.getState().submitStatus({ status: outOfService });
    expect(lastPayload()).toMatchObject({ Id: 'u1', Type: '8', RespondingTo: '1234', RespondingToType: DestinationEntityType.Call });

    await useUnitActionsStore.getState().submitStatus({ status: responding });
    expect(lastPayload()).toMatchObject({ Type: '3', RespondingTo: '1234', RespondingToType: DestinationEntityType.Call });
  });

  it('starts a fresh session and form when opened for another unit, dropping the previous call context', () => {
    const store = useUnitActionsStore.getState();
    store.openActions(unit('u1'), { callContext: call });
    const firstSession = useUnitActionsStore.getState().actionsSessionId;

    useUnitActionsStore.getState().openActions(unit('u2'));
    const reopened = useUnitActionsStore.getState();

    expect(reopened.actionsSessionId).toBe(firstSession + 1);
    expect(reopened.selectedUnit?.UnitId).toBe('u2');
    expect(reopened.callContext).toBeNull();
    expect(reopened.statusDestinationType).toBe('none');
    expect(reopened.statusSelectedCall).toBeNull();
  });

  it('clears the call context when the actions are closed', () => {
    useUnitActionsStore.getState().openActions(unit('u1'), { callContext: call });
    useUnitActionsStore.getState().closeActions();

    expect(useUnitActionsStore.getState().isActionsOpen).toBe(false);
    expect(useUnitActionsStore.getState().callContext).toBeNull();
  });

  it('keeps the form (including the destination) when the save fails', async () => {
    mockSaveUnitStatus.mockRejectedValueOnce(new Error('offline'));
    useUnitActionsStore.getState().openActions(unit('u1'));
    useUnitActionsStore.getState().setStatusSelectedCall(call);
    useUnitActionsStore.getState().setSelectedStatus(responding);

    await expect(useUnitActionsStore.getState().submitStatus()).resolves.toBe(false);
    const state = useUnitActionsStore.getState();
    expect(state.statusError).toBe('offline');
    expect(state.selectedStatus).toBe(responding);
    expect(state.statusSelectedCall).toBe(call);
  });
});
