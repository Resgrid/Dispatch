/** Mirrors `RunCardTriggerTypes`. */
export enum RunCardTriggerType {
  Priority = 0,
  CallType = 1,
  Both = 2,
}

export interface RunCardTriggerData {
  RunCardTriggerId: number;
  /** 0 = priority, 1 = call type, 2 = both. */
  TriggerType: RunCardTriggerType;
  /** Call priority (system 0-3 or DepartmentCallPriorityId). */
  Priority: number | null;
  CallTypeId: number | null;
  /** Optional window start (UTC). */
  StartsOn: string | null;
  /** Optional window end (UTC). */
  EndsOn: string | null;
}

export interface RunCardUnitRequirementData {
  RunCardUnitRequirementId: number;
  UnitTypeId: number;
  RequiredCount: number;
  SortOrder: number;
}

export interface RunCardRoleRequirementData {
  RunCardRoleRequirementId: number;
  PersonnelRoleId: number;
  RequiredCount: number;
  SortOrder: number;
}

export interface RunCardAlarmLevelData {
  RunCardAlarmLevelId: number;
  /** 1-based level number. Levels are additive: striking level N dispatches only level N. */
  AlarmLevel: number;
  Name: string | null;
  UnitRequirements: RunCardUnitRequirementData[];
  RoleRequirements: RunCardRoleRequirementData[];
}

export interface RunCardSelectionData {
  RunCardAvailabilitySelectionId: number;
  /** 1 = unit status, 2 = personnel status, 3 = staffing. */
  SelectionType: number;
  UnitTypeId: number | null;
  IsCustomState: boolean;
  StateId: number;
}

/** A run card (CAD-style response plan) with its full child graph. */
export interface RunCardResultData {
  RunCardId: number;
  Name: string;
  Description: string | null;
  IsDisabled: boolean;
  /** null = department default, 0 = manual only, 1 = station based, 2 = closest unit. */
  DispatchModeOverride: number | null;
  /** null = department default, 0 = pre-populate, 1 = auto. */
  AutoDispatchOverride: number | null;
  MinimumStaffingLevelOverride: number | null;
  HomeStationGroupId: number | null;
  Triggers: RunCardTriggerData[];
  AlarmLevels: RunCardAlarmLevelData[];
  Selections: RunCardSelectionData[];
}
