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
  /** Conditional run cards: the row's status filter found nothing, so an available resource of the same kind filled it. */
  RelaxedFill = 6,
  /** Conditional run cards: picked from the row's substitute package because the row itself could not be filled. */
  SubstitutePackage = 7,
  /** Conditional run cards: added by an "ensure first-arriving" row because it arrives before anything else matching. */
  FirstArriving = 8,
}

/** Mirrors `RequirementScopes`: which table a requirement id refers to. */
export enum RequirementScope {
  /** A fixed alarm level row (RunCardUnitRequirement / RunCardRoleRequirement). */
  Level = 0,
  /** A response package row (conditional run cards). */
  Package = 1,
}

/** Mirrors `RunCardDecisionSources`: where a pinned decision came from. */
export enum RunCardDecisionSource {
  SaveTime = 1,
  DispatcherPreview = 2,
  Reevaluated = 3,
}

/** Mirrors `RecommendationOutcomes`. */
export enum RecommendationOutcome {
  /** The outcome picks a response package to dispatch. */
  Dispatch = 0,
  /** The outcome only advises the dispatcher (AdviceText); nothing is selected. */
  Advice = 1,
}

/** Mirrors `RunCardConditionTypes`. */
export enum RunCardConditionType {
  None = 0,
  /** The subject arrives at least the threshold before the reference. */
  ArrivesBefore = 1,
  /** At least RequiredCount resources can respond within the threshold. */
  AvailableWithin = 2,
}

/** Mirrors `RunCardConditionResults`: the branch the decision followed. */
export enum RunCardConditionResult {
  No = 0,
  Yes = 1,
  Uncertain = 2,
}

/** Mirrors `ResponseTimeSources`. */
export enum ResponseTimeSource {
  /** Straight-line distance at an assumed speed. */
  Estimated = 0,
  /** Routed drive time. */
  Routed = 1,
}

/** Mirrors `RunCardStatusFilters`: which resources a row or operand may draw from. */
export enum RunCardStatusFilter {
  AnyAvailable = 0,
  InQuarters = 1,
  AwayFromQuarters = 2,
  BaseTypes = 3,
}

/** Mirrors `RequirementFallbackSteps`: what a row needed when it could not be filled as configured. */
export enum RequirementFallbackStep {
  /** The status filter was relaxed to any available resource of the same kind. */
  Relaxed = 1,
  /** The row's substitute package was sent in its place. */
  Substitute = 2,
  /** Nothing could be sent; the row stayed short. */
  Shortfall = 3,
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
  /** Conditional run cards: resources of the kind exist, but none in the row's status filter. */
  NoUnitMatchingStatusFilter = 8,
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
  /** The status's button colour as the department set it up (hex); null when it has none or the server predates it. */
  CurrentStatusColor?: string | null;
  /** The status's text colour (hex), drawn on `CurrentStatusColor`; null when the status has none. */
  CurrentStatusTextColor?: string | null;
  StaffingLevel: number | null;
  SatisfiesRequirementId: number;
  /** Which table `SatisfiesRequirementId` refers to; absent from servers that predate conditional run cards. */
  RequirementScope?: RequirementScope;
  /** Conditional run cards: the row this unit fills, as dispatchers read it ("MUG", "First due engine"). */
  RowLabel?: string | null;
  /** Response code the row proposes (department code catalog), with its short code, name and badge colour. */
  ResponseCodeId?: number | null;
  ResponseCode?: string | null;
  ResponseCodeName?: string | null;
  ResponseCodeColor?: string | null;
}

/** Shared by unit and personnel rows: the conditional run card fields a recommended resource can carry. */
export type RecommendedResourceCodeFields = Pick<UnitRecommendationData, 'RowLabel' | 'ResponseCodeId' | 'ResponseCode' | 'ResponseCodeName' | 'ResponseCodeColor'>;

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
  RequirementScope?: RequirementScope;
  /** Conditional run cards: travel (routed or estimated) plus the department's personnel turnout. */
  ResponseSeconds?: number | null;
  RowLabel?: string | null;
  ResponseCodeId?: number | null;
  ResponseCode?: string | null;
  ResponseCodeName?: string | null;
  ResponseCodeColor?: string | null;
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
  RequirementScope?: RequirementScope;
  /** Conditional run cards: the row is marked "keep outstanding", so the saved call will keep awaiting it. */
  Outstanding?: boolean;
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
  /**
   * Conditional run cards: how the level decided what to ask for (decision path, fallbacks, first-arriving rows). Null
   * for a fixed level, and absent from servers that predate conditional run cards.
   */
  Decision?: RunCardDecisionData | null;
}

/** Mirrors `RunCardOperandExplanation`: the resource an operand measured (its pick), or none. */
export interface RunCardOperandData {
  /** The operand's targets, as dispatchers read them ("PIT", "Any ALS unit"). */
  TargetsLabel: string | null;
  StatusFilter: RunCardStatusFilter;
  /** True when the pick is a person rather than a unit. */
  IsPerson: boolean;
  /** UnitId or UserId of the pick; null when nothing matched. */
  ResourceId: string | null;
  ResourceName: string | null;
  ResponseSeconds: number | null;
  TimeSource: ResponseTimeSource;
  PositionSource: number;
  Stale: boolean;
  /** How many resources matched the operand. */
  CandidateCount: number;
}

/** Mirrors `RunCardConditionExplanation`: one condition tested on the decision path. */
export interface RunCardConditionData {
  NodeKey: string | null;
  Label: string | null;
  ConditionType: RunCardConditionType;
  /** The branch followed. An uncertain condition still follows its determinate answer. */
  Result: RunCardConditionResult;
  /** A resource left out for data quality (stale or missing position) could have changed the answer. */
  Uncertain: boolean;
  Subject: RunCardOperandData | null;
  Reference: RunCardOperandData | null;
  ThresholdSeconds: number | null;
  RequiredCount: number;
  /** ArrivesBefore: reference minus subject seconds (positive = subject earlier). AvailableWithin: limit minus the k-th pick's seconds. */
  MarginSeconds: number | null;
  TimeSource: ResponseTimeSource;
  Note: string | null;
}

/** Mirrors `RunCardFallbackExplanation`: a row that needed a fallback step. */
export interface RunCardFallbackData {
  RowLabel: string | null;
  RequirementScope: RequirementScope;
  RequirementId: number;
  /** What the substitute step sent in the row's place ("P-21, A-3"). */
  SentInstead: string | null;
  Step: RequirementFallbackStep;
  SubstitutePackageName: string | null;
  /** The saved call keeps an outstanding requirement for this row. */
  Outstanding: boolean;
  RequiredCount: number;
  FilledCount: number;
}

/** Mirrors `RunCardFirstArrivingExplanation`: an "ensure first-arriving" row and what it found. */
export interface RunCardFirstArrivingData {
  RowLabel: string | null;
  ResourceName: string | null;
  IsPerson: boolean;
  ResponseSeconds: number | null;
  /** Already in the proposal (or on the call); nothing was added. */
  AlreadyIncluded: boolean;
}

/** Mirrors `RunCardDecisionExplanation` (DispatchRecommendationResult.Decision). */
export interface RunCardDecisionData {
  /** True when the level has a decision graph (false for a fixed level that only uses a package). */
  LevelHasGraph: boolean;
  /** The outcome came from the call's pinned decision rather than a fresh walk. */
  Pinned: boolean;
  /** The outcome is the one the dispatcher saw on the New Call preview. */
  FromPreview: boolean;
  PinnedOn: string | null;
  PinSource: RunCardDecisionSource | null;
  /** A condition on the path could have gone the other way had a resource left out for data quality been counted. */
  Uncertain: boolean;
  /** A row needed a relaxed fill, a substitute, or stayed short. */
  IdealConfigurationUnavailable: boolean;
  Outcome: RecommendationOutcome;
  /** Posted back as RunCardOutcomeNodeKey on New Call so the saved call keeps the reviewed proposal. */
  OutcomeNodeKey: string | null;
  OutcomeLabel: string | null;
  PackageId: number | null;
  PackageName: string | null;
  AdviceText: string | null;
  Path: RunCardConditionData[];
  Fallbacks: RunCardFallbackData[];
  FirstArriving: RunCardFirstArrivingData[];
  /** Server-internal snapshot of the rows the outcome resolved to; not read by the app. */
  ResolvedRows?: unknown[];
}
