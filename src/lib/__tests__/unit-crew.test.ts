import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';
import { type UnitRoleData } from '@/models/v4/units/unitRoleData';

import { getUnitCrew, getUnitSubtitle } from '../unit-crew';

const seat = (RoleName: string, UserId = '', Name = ''): UnitRoleData => ({ RoleId: RoleName, RoleName, UserId, Name });

describe('getUnitCrew', () => {
  it('counts every seat the unit defines and the ones someone fills, listing who fills them', () => {
    const crew = getUnitCrew({ Roles: [seat('Driver', 'u1', 'Jane Doe'), seat('Officer', 'u2', 'Sam Okafor'), seat('Medic', 'u3', 'Alex Rivera'), seat('Firefighter')] });

    expect(crew).toEqual({ filled: 3, total: 4, names: ['Jane Doe', 'Sam Okafor', 'Alex Rivera'] });
  });

  it('counts a filled seat whose person the server could not name without listing a blank name', () => {
    const crew = getUnitCrew({ Roles: [seat('Driver', 'u1', ''), seat('Officer', 'u2', '  Sam Okafor ')] });

    expect(crew).toEqual({ filled: 2, total: 2, names: ['Sam Okafor'] });
  });

  it('is empty for a unit with no roles, or none sent', () => {
    expect(getUnitCrew({ Roles: [] })).toEqual({ filled: 0, total: 0, names: [] });
    expect(getUnitCrew({ Roles: undefined } as unknown as Pick<UnitInfoResultData, 'Roles'>)).toEqual({ filled: 0, total: 0, names: [] });
    expect(getUnitCrew(undefined)).toEqual({ filled: 0, total: 0, names: [] });
  });
});

describe('getUnitSubtitle', () => {
  it('shows the type and the group together', () => {
    expect(getUnitSubtitle({ Type: 'Engine', GroupName: 'Station 1' }, 'Unassigned')).toBe('Engine · Station 1');
  });

  it('shows whichever of the two the unit has', () => {
    expect(getUnitSubtitle({ Type: 'Engine', GroupName: '' }, 'Unassigned')).toBe('Engine');
    expect(getUnitSubtitle({ Type: '', GroupName: 'Station 1' }, 'Unassigned')).toBe('Station 1');
  });

  it('falls back when the unit has neither', () => {
    expect(getUnitSubtitle({ Type: '', GroupName: '' }, 'Unassigned')).toBe('Unassigned');
  });
});
