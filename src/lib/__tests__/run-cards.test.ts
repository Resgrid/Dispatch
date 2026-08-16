import {
  dispatchModeKey,
  formatDistance,
  formatEta,
  hasRecommendationContent,
  personnelDetailParts,
  recommendedUnitIds,
  recommendedUserIds,
  selectionReasonKey,
  shortfallReasonKey,
  unitDetailParts,
} from '@/lib/run-cards';
import {
  DispatchRecommendationMode,
  type DispatchRecommendationResultData,
  type PersonnelRecommendationData,
  RecommendationSelectionReason,
  RequirementShortfallReason,
  type UnitRecommendationData,
} from '@/models/v4/runcards/dispatchRecommendationResultData';

const baseRecommendation = (overrides: Partial<DispatchRecommendationResultData> = {}): DispatchRecommendationResultData => ({
  MatchedRunCardId: 7,
  MatchedRunCardName: 'Structure Fire',
  AlarmLevel: 1,
  ModeUsed: DispatchRecommendationMode.StationBased,
  AutoDispatch: false,
  Units: [],
  Personnel: [],
  Shortfalls: [],
  MoveUps: [],
  Notes: [],
  ...overrides,
});

const unit = (overrides: Partial<UnitRecommendationData> = {}): UnitRecommendationData => ({
  UnitId: 1,
  UnitName: 'Engine 1',
  UnitTypeId: 2,
  UnitTypeName: 'Engine',
  StationGroupId: 3,
  StationGroupName: 'Station 3',
  SelectionReason: RecommendationSelectionReason.InGeofence,
  CascadeDepth: 0,
  DistanceMeters: null,
  EtaSeconds: null,
  LocationTimestamp: null,
  LocationIsStale: false,
  CurrentStatusText: null,
  StaffingLevel: null,
  SatisfiesRequirementId: 11,
  ...overrides,
});

const person = (overrides: Partial<PersonnelRecommendationData> = {}): PersonnelRecommendationData => ({
  UserId: 'user-1',
  Name: 'Jane Doe',
  RoleId: 4,
  RoleName: 'Paramedic',
  StationGroupId: 3,
  StationGroupName: 'Station 3',
  SelectionReason: RecommendationSelectionReason.ClosestByEta,
  CascadeDepth: 0,
  DistanceMeters: null,
  EtaSeconds: null,
  LocationTimestamp: null,
  LocationIsStale: false,
  CurrentStatusText: null,
  SatisfiesRequirementId: 12,
  ...overrides,
});

describe('formatDistance', () => {
  it('uses metres under a kilometre and kilometres above', () => {
    expect(formatDistance(420)).toBe('420 m');
    expect(formatDistance(999)).toBe('999 m');
    expect(formatDistance(1000)).toBe('1.0 km');
    expect(formatDistance(4321)).toBe('4.3 km');
  });

  it('returns null when the engine had no distance to report', () => {
    // Station-based mode does not always compute a distance, and rendering "null m" would be worse
    // than rendering nothing.
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(undefined)).toBeNull();
    expect(formatDistance(-1)).toBeNull();
    expect(formatDistance(Number.NaN)).toBeNull();
  });
});

describe('formatEta', () => {
  it('rounds up to whole minutes above a minute', () => {
    expect(formatEta(45)).toBe('45s');
    expect(formatEta(61)).toBe('2 min');
    expect(formatEta(600)).toBe('10 min');
  });

  it('returns null when no routed ETA was computed', () => {
    expect(formatEta(null)).toBeNull();
    expect(formatEta(undefined)).toBeNull();
  });
});

describe('key mapping', () => {
  it('maps every selection reason to its own key', () => {
    const keys = [
      RecommendationSelectionReason.InGeofence,
      RecommendationSelectionReason.CascadeStation,
      RecommendationSelectionReason.ClosestByDistance,
      RecommendationSelectionReason.ClosestByEta,
      RecommendationSelectionReason.RestPeriodOverridden,
    ].map(selectionReasonKey);

    expect(new Set(keys).size).toBe(keys.length);
    expect(selectionReasonKey(RecommendationSelectionReason.Unknown)).toBe('run_cards.reason.unknown');
  });

  it('maps every shortfall reason to its own key', () => {
    const keys = [
      RequirementShortfallReason.NoCandidatesAvailable,
      RequirementShortfallReason.OutsideRadius,
      RequirementShortfallReason.LocationsTooStale,
      RequirementShortfallReason.NoLocationData,
      RequirementShortfallReason.UnitsNotStaffed,
      RequirementShortfallReason.AllInRestPeriod,
      RequirementShortfallReason.StationsExhausted,
    ].map(shortfallReasonKey);

    expect(new Set(keys).size).toBe(keys.length);
    expect(shortfallReasonKey(RequirementShortfallReason.Unknown)).toBe('run_cards.shortfall.unknown');
  });

  it('maps dispatch modes, defaulting to manual', () => {
    expect(dispatchModeKey(DispatchRecommendationMode.StationBased)).toBe('run_cards.mode.station_based');
    expect(dispatchModeKey(DispatchRecommendationMode.ClosestUnit)).toBe('run_cards.mode.closest_unit');
    expect(dispatchModeKey(DispatchRecommendationMode.ManualOnly)).toBe('run_cards.mode.manual_only');
  });
});

describe('hasRecommendationContent', () => {
  it('is false with no recommendation or no matched card', () => {
    expect(hasRecommendationContent(null)).toBe(false);
    expect(hasRecommendationContent(baseRecommendation({ MatchedRunCardId: null }))).toBe(false);
  });

  it('is false for a matched card that selected nothing and reported nothing', () => {
    // Manual-only mode with no shortfalls has nothing to tell the dispatcher.
    expect(hasRecommendationContent(baseRecommendation())).toBe(false);
  });

  it('is true when there is anything to show', () => {
    expect(hasRecommendationContent(baseRecommendation({ Units: [unit()] }))).toBe(true);
    expect(hasRecommendationContent(baseRecommendation({ Personnel: [person()] }))).toBe(true);
    expect(
      hasRecommendationContent(
        baseRecommendation({
          Shortfalls: [
            {
              IsUnitRequirement: true,
              RequirementId: 1,
              TypeOrRoleId: 2,
              TypeOrRoleName: 'Engine',
              AlarmLevel: 1,
              RequiredCount: 3,
              FilledCount: 1,
              Reason: RequirementShortfallReason.NoCandidatesAvailable,
            },
          ],
        })
      )
    ).toBe(true);
  });
});

describe('recommended id extraction', () => {
  it('returns unit ids as strings so they match the dispatch selection', () => {
    expect(recommendedUnitIds(baseRecommendation({ Units: [unit({ UnitId: 4 }), unit({ UnitId: 9 })] }))).toEqual(['4', '9']);
  });

  it('drops personnel rows with no user id', () => {
    const withBlank = baseRecommendation({ Personnel: [person({ UserId: 'a' }), person({ UserId: '' })] });
    expect(recommendedUserIds(withBlank)).toEqual(['a']);
  });

  it('handles a null recommendation', () => {
    expect(recommendedUnitIds(null)).toEqual([]);
    expect(recommendedUserIds(null)).toEqual([]);
  });
});

describe('detail lines', () => {
  it('includes only the facts the engine actually knew', () => {
    expect(unitDetailParts(unit({ StationGroupName: 'Station 3', DistanceMeters: 1500, EtaSeconds: 200, CurrentStatusText: 'Available' }))).toEqual(['Station 3', '1.5 km', '4 min', 'Available']);

    expect(unitDetailParts(unit({ StationGroupName: null, DistanceMeters: null, EtaSeconds: null, CurrentStatusText: null }))).toEqual([]);
  });

  it('leads with the role for personnel', () => {
    expect(personnelDetailParts(person({ RoleName: 'Paramedic', StationGroupName: 'Station 3', DistanceMeters: 300 }))).toEqual(['Paramedic', 'Station 3', '300 m']);
  });
});
