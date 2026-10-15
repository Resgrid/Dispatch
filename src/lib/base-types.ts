/**
 * Canonical meanings ("base types") of statuses, staffing levels, call priorities and call types.
 *
 * Departments name their statuses, staffing levels, priorities and call types however they like ("IN QUARTERS",
 * "Pager Only", "Code 3", "Structure Fire"), so an app must never decide what something means from its name or a
 * hard-coded id. The Resgrid API sends the meaning alongside every value, for built-in and department values alike:
 *  - status options (Statuses/GetAllStatusesForPersonnel, GetAllUnitStatuses): `BaseType` (ActionBaseTypes);
 *    staffing options (Statuses/GetAllStaffingsForPersonnel): `BaseType` (StaffingBaseTypes);
 *    `StateId` on a status option is its custom set id: 0 for a built-in option.
 *  - personnel infos: `StatusBaseType` (ActionBaseTypes), `StaffingBaseType` (StaffingBaseTypes);
 *  - unit infos: `CurrentStatusBaseType` (ActionBaseTypes);
 *  - call priorities: `BaseType` (CallPriorityBaseTypes) and `Sort`;
 *  - call types: `BaseType` (CallTypeClasses); calls: `TypeId`.
 * -1 means the department has not given the value a meaning; older servers send nothing (undefined).
 *
 * Mirrors Resgrid.Model.ActionBaseTypes / StaffingBaseTypes / CallPriority / CallTypeClasses and the availability
 * rules of Resgrid.Model.Reporting.AvailabilityMatrix. Keep this file byte-identical across the Resgrid apps.
 */

export enum ActionBaseTypes {
  None = -1,
  Available = 0,
  NotResponding = 1,
  Responding = 2,
  OnScene = 3,
  MadeContact = 4,
  Investigating = 5,
  Dispatched = 6,
  Cleared = 7,
  Returning = 8,
  Staging = 9,
  Unavailable = 10,
  Enroute = 11,
  Transporting = 12,
  Delivering = 13,
  AtPatient = 14,
  AtHospital = 15,
  Searching = 16,
  Loading = 17,
  Standby = 18,
  OnPatrol = 19,
  Maintenance = 20,
  OnBreak = 21,
  Completed = 22,
  InQuarters = 23,
}

export enum StaffingBaseTypes {
  None = -1,
  Available = 0,
  Delayed = 1,
  Unavailable = 2,
  Committed = 3,
  OnShift = 4,
  OffDuty = 5,
  OnCall = 6,
}

export enum CallPriorityBaseTypes {
  None = -1,
  Low = 0,
  Medium = 1,
  High = 2,
  Emergency = 3,
}

export enum CallTypeClasses {
  None = -1,
  Fire = 1,
  Medical = 2,
  Rescue = 3,
  TrafficCollision = 4,
  HazardousMaterials = 5,
  Alarm = 6,
  ServiceCall = 7,
  LawEnforcement = 8,
  DisasterWeather = 9,
  MutualAid = 10,
  NonEmergencyActivity = 11,
  Other = 12,
}

export type AvailabilityClass = 'available' | 'delayed' | 'committed' | 'unavailable' | 'unknown';

const STATUS_AVAILABILITY: Record<number, AvailabilityClass> = {
  [ActionBaseTypes.Available]: 'available',
  [ActionBaseTypes.NotResponding]: 'unavailable',
  [ActionBaseTypes.Responding]: 'committed',
  [ActionBaseTypes.OnScene]: 'committed',
  [ActionBaseTypes.MadeContact]: 'committed',
  [ActionBaseTypes.Investigating]: 'committed',
  [ActionBaseTypes.Dispatched]: 'committed',
  [ActionBaseTypes.Cleared]: 'available',
  [ActionBaseTypes.Returning]: 'committed',
  [ActionBaseTypes.Staging]: 'committed',
  [ActionBaseTypes.Unavailable]: 'unavailable',
  [ActionBaseTypes.Enroute]: 'committed',
  [ActionBaseTypes.Transporting]: 'committed',
  [ActionBaseTypes.Delivering]: 'committed',
  [ActionBaseTypes.AtPatient]: 'committed',
  [ActionBaseTypes.AtHospital]: 'committed',
  [ActionBaseTypes.Searching]: 'committed',
  [ActionBaseTypes.Loading]: 'committed',
  [ActionBaseTypes.Standby]: 'committed',
  [ActionBaseTypes.OnPatrol]: 'available',
  [ActionBaseTypes.Maintenance]: 'unavailable',
  [ActionBaseTypes.OnBreak]: 'delayed',
  [ActionBaseTypes.Completed]: 'available',
  [ActionBaseTypes.InQuarters]: 'available',
};

const STAFFING_AVAILABILITY: Record<number, AvailabilityClass> = {
  [StaffingBaseTypes.Available]: 'available',
  [StaffingBaseTypes.Delayed]: 'delayed',
  [StaffingBaseTypes.Unavailable]: 'unavailable',
  [StaffingBaseTypes.Committed]: 'committed',
  [StaffingBaseTypes.OnShift]: 'available',
  [StaffingBaseTypes.OffDuty]: 'unavailable',
  [StaffingBaseTypes.OnCall]: 'available',
};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

/** The availability a status base type means; 'unknown' when it is missing or None. */
export const statusAvailability = (baseType: unknown): AvailabilityClass => {
  const n = toNumber(baseType);
  return n === null ? 'unknown' : (STATUS_AVAILABILITY[n] ?? 'unknown');
};

/** The availability a staffing base type means; 'unknown' when it is missing or None. */
export const staffingAvailability = (baseType: unknown): AvailabilityClass => {
  const n = toNumber(baseType);
  return n === null ? 'unknown' : (STAFFING_AVAILABILITY[n] ?? 'unknown');
};

/** True when the base type was sent and means something (not None). */
export const hasBaseType = (baseType: unknown): boolean => {
  const n = toNumber(baseType);
  return n !== null && n >= 0;
};

/** Available or delayed: the resource can take another assignment (dispatch's rule). */
export const isStatusAvailable = (baseType: unknown): boolean => {
  const availability = statusAvailability(baseType);
  return availability === 'available' || availability === 'delayed';
};

/** Responding to an assignment (dispatched, responding, en route). */
export const isStatusResponding = (baseType: unknown): boolean => {
  const n = toNumber(baseType);
  return n === ActionBaseTypes.Dispatched || n === ActionBaseTypes.Responding || n === ActionBaseTypes.Enroute;
};

/** Working at the scene or with the patient/subject. */
export const isStatusOnScene = (baseType: unknown): boolean => {
  const n = toNumber(baseType);
  return n === ActionBaseTypes.OnScene || n === ActionBaseTypes.MadeContact || n === ActionBaseTypes.Investigating || n === ActionBaseTypes.AtPatient || n === ActionBaseTypes.Searching || n === ActionBaseTypes.Staging;
};

/** On duty for staffing purposes: available, on shift, on call or delayed (not off duty or unavailable). */
export const isStaffingOnDuty = (baseType: unknown): boolean => {
  const availability = staffingAvailability(baseType);
  return availability === 'available' || availability === 'delayed' || availability === 'committed';
};

/** The fields the personnel in service count reads (PersonnelInfoResultData). */
export interface PersonnelInServiceFields {
  Status?: string | null;
  StatusBaseType?: number | null;
  StaffingBaseType?: number | null;
}

/**
 * Personnel in service, the one definition every app counts: working an assignment right now -- a committed status
 * (dispatched, responding, en route, on scene, returning ...) -- and not off duty or unavailable by staffing. Available,
 * delayed, unavailable and unknown statuses do not count. A status without a meaning (older servers, or an option the
 * department has not given one) falls back to the rule the apps used before: a status other than Available or Off Duty.
 */
export const isPersonnelInService = (person: PersonnelInServiceFields | null | undefined): boolean => {
  if (!person || staffingAvailability(person.StaffingBaseType) === 'unavailable') return false;
  if (hasBaseType(person.StatusBaseType)) return statusAvailability(person.StatusBaseType) === 'committed';
  return !!person.Status && person.Status !== 'Available' && person.Status !== 'Off Duty';
};

/**
 * Orders call priorities from most to least urgent: by meaning (Emergency first), then the department's own sort order,
 * then id. Use it instead of sorting on the raw priority id, which mixes built-in values (0-3) with department ids.
 */
export const comparePriorityUrgency = (
  a: { BaseType?: number | null; Sort?: number | null; Id?: number | string | null } | null | undefined,
  b: { BaseType?: number | null; Sort?: number | null; Id?: number | string | null } | null | undefined
): number => {
  const baseA = toNumber(a?.BaseType) ?? -1;
  const baseB = toNumber(b?.BaseType) ?? -1;
  if (baseA !== baseB) return baseB - baseA;
  const sortA = toNumber(a?.Sort) ?? 0;
  const sortB = toNumber(b?.Sort) ?? 0;
  if (sortA !== sortB) return sortA - sortB;
  return (toNumber(a?.Id) ?? 0) - (toNumber(b?.Id) ?? 0);
};

/** True when the priority means Emergency. */
export const isEmergencyPriority = (baseType: unknown): boolean => toNumber(baseType) === CallPriorityBaseTypes.Emergency;
