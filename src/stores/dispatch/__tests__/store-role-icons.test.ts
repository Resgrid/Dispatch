import { getAllGroups } from '@/api/groups/groups';
import { getRecipients } from '@/api/messaging/messages';
import { getAllPersonnelInfos } from '@/api/personnel/personnel';
import { getUnitsInfos } from '@/api/units/units';

import { useDispatchStore } from '../store';

jest.mock('@/api/groups/groups', () => ({ getAllGroups: jest.fn() }));
jest.mock('@/api/messaging/messages', () => ({ getRecipients: jest.fn() }));
jest.mock('@/api/personnel/personnel', () => ({ getAllPersonnelInfos: jest.fn() }));
jest.mock('@/api/units/units', () => ({ getUnitsInfos: jest.fn() }));
jest.mock('@/lib/logging', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() } }));

const ROLE_ICON_URL = 'https://api.resgrid.dev/api/v4/TypeIcons/0123456789abcdef0123456789abcdef';
const PERSON_ICON_URL = 'https://api.resgrid.dev/api/v4/TypeIcons/fedcba9876543210fedcba9876543210';

describe('useDispatchStore role icons', () => {
  beforeEach(() => {
    (getAllGroups as jest.Mock).mockResolvedValue({ Data: [] });
    (getUnitsInfos as jest.Mock).mockResolvedValue({ Data: [] });
    (getAllPersonnelInfos as jest.Mock).mockResolvedValue({
      Data: [
        { UserId: 'u1', FirstName: 'Jane', LastName: 'Medic', RoleIconUrl: PERSON_ICON_URL },
        { UserId: 'u2', FirstName: 'Sam', LastName: 'Driver' },
      ],
    });
    (getRecipients as jest.Mock).mockResolvedValue({
      Data: [
        { Id: 'R:7', Type: 'Roles', Name: 'Paramedic', TypeIconUrl: ROLE_ICON_URL },
        { Id: 'R:8', Type: 'Roles', Name: 'Driver', TypeIconUrl: null },
        { Id: 'G:1', Type: 'Groups', Name: 'Station 1' },
      ],
    });
  });

  it("carries a role's own icon and a person's role icon into the picker data", async () => {
    await useDispatchStore.getState().fetchDispatchData();

    const { roles, users } = useDispatchStore.getState().data;
    expect(roles).toEqual([
      { Id: '7', Name: 'Paramedic', TypeIconUrl: ROLE_ICON_URL },
      { Id: '8', Name: 'Driver', TypeIconUrl: null },
    ]);
    // Users carry their status, staffing, group and roles too (the picker shows them); only the icon matters here.
    expect(users).toMatchObject([
      { Id: 'u1', Name: 'Jane Medic', TypeIconUrl: PERSON_ICON_URL },
      { Id: 'u2', Name: 'Sam Driver' },
    ]);
    expect(users[1].TypeIconUrl).toBeUndefined();
  });
});
