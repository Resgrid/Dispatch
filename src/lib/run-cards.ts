import {
  DispatchRecommendationMode,
  type DispatchRecommendationResultData,
  type PersonnelRecommendationData,
  RecommendationSelectionReason,
  RequirementShortfallReason,
  type UnitRecommendationData,
} from '@/models/v4/runcards/dispatchRecommendationResultData';

/**
 * Presentation helpers for run card recommendations.
 *
 * Kept out of the components so the label mapping and the "is this worth showing" rules are unit
 * testable, and so the new-call and edit-call screens cannot drift apart on them.
 */

/** Translation key for a selection reason, e.g. why this engine picked this unit. */
export const selectionReasonKey = (reason: RecommendationSelectionReason): string => {
  switch (reason) {
    case RecommendationSelectionReason.InGeofence:
      return 'run_cards.reason.in_geofence';
    case RecommendationSelectionReason.CascadeStation:
      return 'run_cards.reason.cascade_station';
    case RecommendationSelectionReason.ClosestByDistance:
      return 'run_cards.reason.closest_by_distance';
    case RecommendationSelectionReason.ClosestByEta:
      return 'run_cards.reason.closest_by_eta';
    case RecommendationSelectionReason.RestPeriodOverridden:
      return 'run_cards.reason.rest_period_overridden';
    default:
      return 'run_cards.reason.unknown';
  }
};

/** Translation key explaining why a requirement could not be filled. */
export const shortfallReasonKey = (reason: RequirementShortfallReason): string => {
  switch (reason) {
    case RequirementShortfallReason.NoCandidatesAvailable:
      return 'run_cards.shortfall.no_candidates';
    case RequirementShortfallReason.OutsideRadius:
      return 'run_cards.shortfall.outside_radius';
    case RequirementShortfallReason.LocationsTooStale:
      return 'run_cards.shortfall.locations_stale';
    case RequirementShortfallReason.NoLocationData:
      return 'run_cards.shortfall.no_location_data';
    case RequirementShortfallReason.UnitsNotStaffed:
      return 'run_cards.shortfall.not_staffed';
    case RequirementShortfallReason.AllInRestPeriod:
      return 'run_cards.shortfall.all_in_rest_period';
    case RequirementShortfallReason.StationsExhausted:
      return 'run_cards.shortfall.stations_exhausted';
    default:
      return 'run_cards.shortfall.unknown';
  }
};

/** Translation key for the mode the engine resolved to. */
export const dispatchModeKey = (mode: DispatchRecommendationMode): string => {
  switch (mode) {
    case DispatchRecommendationMode.StationBased:
      return 'run_cards.mode.station_based';
    case DispatchRecommendationMode.ClosestUnit:
      return 'run_cards.mode.closest_unit';
    default:
      return 'run_cards.mode.manual_only';
  }
};

/** Metres below 1 km, kilometres to one decimal above. Null when the engine had no distance. */
export const formatDistance = (meters: number | null | undefined): string | null => {
  if (typeof meters !== 'number' || !Number.isFinite(meters) || meters < 0) {
    return null;
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(1)} km`;
};

/** Rounded-up minutes, or seconds under a minute. Null when no routed ETA was computed. */
export const formatEta = (seconds: number | null | undefined): string | null => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  return `${Math.ceil(seconds / 60)} min`;
};

/**
 * True when the recommendation is worth putting on screen: a card matched and it either selected
 * something, could not fill something, or wants a move-up. A matched card that produced nothing at
 * all (manual-only mode with no shortfalls) has nothing to say.
 */
export const hasRecommendationContent = (recommendation: DispatchRecommendationResultData | null): boolean => {
  if (!recommendation || !recommendation.MatchedRunCardId) {
    return false;
  }

  return (recommendation.Units?.length ?? 0) > 0 || (recommendation.Personnel?.length ?? 0) > 0 || (recommendation.Shortfalls?.length ?? 0) > 0 || (recommendation.MoveUps?.length ?? 0) > 0;
};

/** Unit ids the recommendation selected, as the strings the dispatch selection uses. */
export const recommendedUnitIds = (recommendation: DispatchRecommendationResultData | null): string[] => (recommendation?.Units ?? []).map((unit) => String(unit.UnitId));

/** User ids the recommendation selected. */
export const recommendedUserIds = (recommendation: DispatchRecommendationResultData | null): string[] => (recommendation?.Personnel ?? []).filter((person) => !!person.UserId).map((person) => person.UserId);

/** Secondary line for a unit row: station, distance, ETA and staleness, whichever the engine knew. */
export const unitDetailParts = (unit: UnitRecommendationData): string[] => {
  const parts: string[] = [];

  if (unit.StationGroupName) {
    parts.push(unit.StationGroupName);
  }

  const distance = formatDistance(unit.DistanceMeters);
  if (distance) {
    parts.push(distance);
  }

  const eta = formatEta(unit.EtaSeconds);
  if (eta) {
    parts.push(eta);
  }

  if (unit.CurrentStatusText) {
    parts.push(unit.CurrentStatusText);
  }

  return parts;
};

/** Secondary line for a personnel row. */
export const personnelDetailParts = (person: PersonnelRecommendationData): string[] => {
  const parts: string[] = [];

  if (person.RoleName) {
    parts.push(person.RoleName);
  }

  if (person.StationGroupName) {
    parts.push(person.StationGroupName);
  }

  const distance = formatDistance(person.DistanceMeters);
  if (distance) {
    parts.push(distance);
  }

  const eta = formatEta(person.EtaSeconds);
  if (eta) {
    parts.push(eta);
  }

  if (person.CurrentStatusText) {
    parts.push(person.CurrentStatusText);
  }

  return parts;
};
