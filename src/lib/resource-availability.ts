import { hasBaseType, isPersonnelInService as isSharedPersonnelInService, isStaffingOnDuty, isStatusAvailable } from '@/lib/base-types';
import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';

/*
 * What a status or staffing level means comes from its base type (see base-types.ts), never its name: departments name
 * them freely ("IN QUARTERS", "Pager Only"). Every helper here decides by the base type whenever the server sent one, and
 * only falls back to the text rule its screen has always used when it did not -- an older server (undefined), or a
 * department status or staffing level the department never gave a meaning (-1 / null).
 */

type UnitStatusFields = Pick<UnitInfoResultData, 'CurrentStatus' | 'CurrentStatusId' | 'CurrentStatusBaseType'>;
type PersonnelStatusFields = Pick<PersonnelInfoResultData, 'Status' | 'StatusBaseType'>;
type PersonnelStaffingFields = Pick<PersonnelInfoResultData, 'Staffing' | 'StaffingBaseType'>;

/** Decides by the base type when the server sent one that means something; otherwise by the screen's legacy text rule. */
const decide = (baseType: number | null | undefined, byBaseType: (baseType: number) => boolean, legacy: () => boolean): boolean => (hasBaseType(baseType) ? byBaseType(Number(baseType)) : legacy());

/** Status names the home dashboard counted as available before base types; there a missing status never counts. */
const DASHBOARD_AVAILABLE_STATUS_NAMES = ['available', 'standing by'];

/**
 * Whether a unit is currently available for dispatch (dispatch console rule). By the current status's base type when
 * the server sent one; otherwise when its status text/id is "Available", or when it has no known status yet.
 */
export function isUnitAvailable(unit: UnitStatusFields): boolean {
  return decide(unit.CurrentStatusBaseType, isStatusAvailable, () => {
    const status = (unit.CurrentStatus || '').trim().toLowerCase();
    const statusId = (unit.CurrentStatusId ?? '').toString().trim().toLowerCase();
    if (status || statusId) {
      return status === 'available' || statusId === 'available';
    }
    return true; // no status known yet — treat as available
  });
}

/** Whether a person is currently available (dispatch console rule): by the status's base type, else a status named "Available". */
export function isPersonnelAvailable(person: PersonnelStatusFields): boolean {
  return decide(person.StatusBaseType, isStatusAvailable, () => (person.Status || '').trim().toLowerCase() === 'available');
}

/** Whether a person is on duty (dispatch console rule): by the staffing level's base type, else any staffing level except "Off Duty". */
export function isPersonnelOnDuty(person: PersonnelStaffingFields): boolean {
  return decide(person.StaffingBaseType, isStaffingOnDuty, () => !!person.Staffing && person.Staffing.toLowerCase() !== 'off duty');
}

/**
 * Whether a unit counts as available on the home dashboard. By the current status's base type when sent; otherwise only
 * an explicit "Available" or "Standing By" status counts -- a missing status does not, for safety.
 */
export function isUnitAvailableForDashboard(unit: UnitStatusFields): boolean {
  return decide(unit.CurrentStatusBaseType, isStatusAvailable, () => DASHBOARD_AVAILABLE_STATUS_NAMES.includes((unit.CurrentStatus || '').toLowerCase()));
}

/** Whether a person counts as available on the home dashboard: by the status's base type, else an "Available" or "Standing By" status. */
export function isPersonnelAvailableForDashboard(person: PersonnelStatusFields): boolean {
  return decide(person.StatusBaseType, isStatusAvailable, () => DASHBOARD_AVAILABLE_STATUS_NAMES.includes((person.Status || '').toLowerCase()));
}

/** Whether a person counts as on duty on the home dashboard: by the staffing level's base type, else any staffing level except "Off Duty" or "Unavailable". */
export function isPersonnelOnDutyForDashboard(person: PersonnelStaffingFields): boolean {
  return decide(person.StaffingBaseType, isStaffingOnDuty, () => {
    const staffing = (person.Staffing || '').toLowerCase();
    return !!staffing && staffing !== 'off duty' && staffing !== 'unavailable';
  });
}

/** Whether a person counts as in service on the department stats: the one definition every app shares (lib/base-types). */
export function isPersonnelInService(person: PersonnelStatusFields & PersonnelStaffingFields): boolean {
  return isSharedPersonnelInService(person);
}
