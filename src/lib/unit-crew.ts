import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';

export type UnitCrew = {
  /** Role seats someone is assigned to. */
  filled: number;
  /** Every role seat the unit defines. */
  total: number;
  /** Who fills the seats, in the unit's role order; a seat whose person the server could not name is counted but not listed. */
  names: string[];
};

/**
 * The unit's role seats and who is active on them. The server sends every role the unit defines (UnitInfoResultData.Roles),
 * with the assigned person's UserId and Name on the seats someone fills, so "3/4" reads as three of four seats filled.
 */
export function getUnitCrew(unit: Pick<UnitInfoResultData, 'Roles'> | null | undefined): UnitCrew {
  const roles = unit?.Roles ?? [];
  const filled = roles.filter((role) => !!role?.UserId);
  return {
    filled: filled.length,
    total: roles.length,
    names: filled.map((role) => (role.Name ?? '').trim()).filter(Boolean),
  };
}

/** The unit's type and group as one subtitle ("Engine · Station 1"), so the type shows even when the unit has a group. */
export function getUnitSubtitle(unit: Pick<UnitInfoResultData, 'Type' | 'GroupName'>, fallback: string): string {
  return (
    [unit.Type, unit.GroupName]
      .map((part) => (part ?? '').trim())
      .filter(Boolean)
      .join(' · ') || fallback
  );
}
