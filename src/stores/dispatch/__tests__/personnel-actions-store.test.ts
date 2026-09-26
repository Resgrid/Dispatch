import { savePersonsStatuses } from '@/api/personnel/personnelStatuses';
import { CustomStateDetailType, DestinationEntityType } from '@/lib/destination-helpers';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type GroupResultData } from '@/models/v4/groups/groupsResultData';
import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import { type StatusesResultData } from '@/models/v4/statuses/statusesResultData';

import { usePersonnelActionsStore } from '../personnel-actions-store';

jest.mock('@/api/personnel/personnelStatuses', () => ({
  savePersonsStatuses: jest.fn(),
}));

jest.mock('@/api/personnel/personnelStaffing', () => ({
  savePersonsStaffings: jest.fn(),
}));

const mockSavePersonsStatuses = savePersonsStatuses as jest.MockedFunction<typeof savePersonsStatuses>;

const person = (UserId: string): PersonnelInfoResultData => ({ UserId, FirstName: 'Pat', LastName: UserId, StatusDestinationId: '' }) as PersonnelInfoResultData;
const status = (Id: number, Text: string, Detail: number): StatusesResultData => ({ Id, Text, Detail, Note: 0 }) as StatusesResultData;
const call: CallResultData = { CallId: '1234', Number: '26-1', Name: 'Structure Fire', State: 0 } as CallResultData;
const station: GroupResultData = { GroupId: '55', Name: 'Station 5' } as GroupResultData;

const responding = status(2, 'Responding', CustomStateDetailType.CallsAndStations);
const onScene = status(3, 'On Scene', CustomStateDetailType.Calls);
const standingBy = status(4, 'Standing By', CustomStateDetailType.Stations);
const notResponding = status(1, 'Not Responding', CustomStateDetailType.None);

const lastPayload = () => mockSavePersonsStatuses.mock.calls[mockSavePersonsStatuses.mock.calls.length - 1][0];

describe('usePersonnelActionsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSavePersonsStatuses.mockResolvedValue({} as any);
    usePersonnelActionsStore.getState().reset();
  });

  it('keeps the call destination sticky after a successful submit so the next status carries it too', async () => {
    usePersonnelActionsStore.getState().openActions(person('p1'));
    usePersonnelActionsStore.getState().setStatusSelectedCall(call);

    await expect(usePersonnelActionsStore.getState().submitStatus({ status: responding })).resolves.toBe(true);
    expect(lastPayload()).toMatchObject({ UserIds: ['p1'], Type: '2', RespondingTo: '1234', RespondingToType: DestinationEntityType.Call });

    const afterSubmit = usePersonnelActionsStore.getState();
    expect(afterSubmit.selectedStatus).toBeNull();
    expect(afterSubmit.statusDestinationType).toBe('call');
    expect(afterSubmit.statusSelectedCall).toBe(call);

    await usePersonnelActionsStore.getState().submitStatus({ status: onScene });
    expect(lastPayload()).toMatchObject({ Type: '3', RespondingTo: '1234', RespondingToType: DestinationEntityType.Call });
  });

  it('does not send a destination the status Detail does not support', async () => {
    usePersonnelActionsStore.getState().openActions(person('p1'));
    usePersonnelActionsStore.getState().setStatusSelectedCall(call);

    await usePersonnelActionsStore.getState().submitStatus({ status: notResponding });
    expect(lastPayload()).toMatchObject({ Type: '1', RespondingTo: '', RespondingToType: null });

    await usePersonnelActionsStore.getState().submitStatus({ status: standingBy });
    expect(lastPayload()).toMatchObject({ Type: '4', RespondingTo: '', RespondingToType: null });

    usePersonnelActionsStore.getState().setStatusSelectedStation(station);
    await usePersonnelActionsStore.getState().submitStatus({ status: onScene });
    expect(lastPayload()).toMatchObject({ Type: '3', RespondingTo: '', RespondingToType: null });

    await usePersonnelActionsStore.getState().submitStatus({ status: standingBy });
    expect(lastPayload()).toMatchObject({ Type: '4', RespondingTo: '55', RespondingToType: DestinationEntityType.Station });
  });

  it('presets the call for an explicit call context and sends it even when the status Detail does not list calls', async () => {
    usePersonnelActionsStore.getState().openActions(person('p1'), { callContext: call });

    expect(usePersonnelActionsStore.getState().statusDestinationType).toBe('call');
    expect(usePersonnelActionsStore.getState().statusSelectedCall).toBe(call);

    await usePersonnelActionsStore.getState().submitStatus({ status: notResponding });
    expect(lastPayload()).toMatchObject({ UserIds: ['p1'], Type: '1', RespondingTo: '1234', RespondingToType: DestinationEntityType.Call });
  });

  it('starts a fresh session and form when opened for another person', () => {
    usePersonnelActionsStore.getState().openActions(person('p1'), { callContext: call });
    const firstSession = usePersonnelActionsStore.getState().actionsSessionId;

    usePersonnelActionsStore.getState().openActions(person('p2'));
    const reopened = usePersonnelActionsStore.getState();

    expect(reopened.actionsSessionId).toBe(firstSession + 1);
    expect(reopened.selectedPersonnel?.UserId).toBe('p2');
    expect(reopened.callContext).toBeNull();
    expect(reopened.statusDestinationType).toBe('none');
    expect(reopened.statusSelectedCall).toBeNull();
  });
});
