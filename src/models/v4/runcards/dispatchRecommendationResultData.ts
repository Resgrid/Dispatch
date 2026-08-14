/**
 * Mirrors `Resgrid.Model.DispatchRecommendationResult` and its children. Field names match the API
 * payload exactly (PascalCase) — these are deserialized straight from JSON, never constructed.
 */

/** Mirrors `RecommendationSelectionReasons`. Why the engine picked this resource. */
export enum RecommendationSelectionReason {
  Unknown = 0,
  /** Resource belongs to the station whose geofence contains the call. */
  InGeofence = 1,
  /** Pulled from a next-nearest station after the owning station fell short. */
  CascadeStation = 2,
  /** Closest-unit mode pick by straight-line distance. */
  ClosestByDistance = 3,
  /** Closest-unit mode pick re-ranked by routed ETA. */
  ClosestByEta = 4,
  /** Resource was inside its rest period, but nothing rested could fill the requirement. */
  RestPeriodOverridden = 5,
}

/** Mirrors `RequirementShortfallReasons`. Why a requirement could not be filled. */
export enum RequirementShortfallReason {
  Unknown = 0,
  NoCandidatesAvailable = 1,
  OutsideRadius = 2,
  LocationsTooStale = 3,
  NoLocationData = 4,
  UnitsNotStaffed = 5,
  AllInRestPeriod = 6,
  StationsExhausted = 7,
}

/** Mirrors `DispatchRecommendationModes`. */
export enum DispatchRecommendationMode {
  /** Run cards match but never select resources — the dispatcher picks manually. */
  ManualOnly = 0,
  /** Resources drawn from the station whose geofence contains the call, cascading outward. */
  StationBased = 1,
  /** Resources ordered by distance (optionally routed ETA) from their last known fix. */
  ClosestUnit = 2,
}

export interface UnitRecommendationData {
  UnitId: number;
  UnitName: string;
  UnitTypeId: number;
  UnitTypeName: string;
  StationGroupId: number | null;
  StationGroupName: string | null;
  SelectionReason: RecommendationSelectionReason;
  /** How many stations out the cascade went (0 = owning/containing station). */
  CascadeDepth: number;
  DistanceMeters: number | null;
  EtaSeconds: number | null;
  LocationTimestamp: string | null;
  LocationIsStale: boolean;
  CurrentStatusText: string | null;
  StaffingLevel: number | null;
  SatisfiesRequirementId: number;
}

export interface PersonnelRecommendationData {
  UserId: string;
  Name: string;
  RoleId: number;
  RoleName: string;
  StationGroupId: number | null;
  StationGroupName: string | null;
  SelectionReason: RecommendationSelectionReason;
  CascadeDepth: number;
  DistanceMeters: number | null;
  EtaSeconds: number | null;
  LocationTimestamp: string | null;
  LocationIsStale: boolean;
  CurrentStatusText: string | null;
  SatisfiesRequirementId: number;
}

export interface RequirementShortfallData {
  /** true = unit type requirement, false = personnel role requirement. */
  IsUnitRequirement: boolean;
  RequirementId: number;
  TypeOrRoleId: number;
  TypeOrRoleName: string;
  AlarmLevel: number;
  RequiredCount: number;
  FilledCount: number;
  Reason: RequirementShortfallReason;
}

export interface MoveUpRecommendationData {
  StationGroupId: number;
  StationGroupName: string;
  UnitTypeId: number | null;
  UnitTypeName: string | null;
  PersonnelRoleId: number | null;
  PersonnelRoleName: string | null;
  MinimumRequired: number;
  AvailableAfterDispatch: number;
  SuggestedUnitId: number | null;
  SuggestedUnitName: string | null;
  SuggestedUserId: string | null;
  SuggestedUserName: string | null;
  FromStationGroupId: number | null;
  FromStationGroupName: string | null;
  DistanceMeters: number | null;
}

export interface DispatchRecommendationResultData {
  /** Null when no run card matched — the whole result is then a no-op. */
  MatchedRunCardId: number | null;
  MatchedRunCardName: string | null;
  AlarmLevel: number;
  ModeUsed: DispatchRecommendationMode;
  /** Resolved auto-dispatch decision (department default plus any card override). */
  AutoDispatch: boolean;
  Units: UnitRecommendationData[];
  Personnel: PersonnelRecommendationData[];
  Shortfalls: RequirementShortfallData[];
  MoveUps: MoveUpRecommendationData[];
  /** Human-readable decision log from the engine. */
  Notes: string[];
}
