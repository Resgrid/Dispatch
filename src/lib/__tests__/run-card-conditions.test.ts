import {
  activeResponseCodes,
  buildUnitResponseCodes,
  effectiveUnitResponseCodeId,
  fallbackStepKey,
  formatMarginSeconds,
  formatResponseSeconds,
  minutesSinceServerUtc,
  operandDisplay,
  outcomeNodeKeyFor,
  parseOutstandingRequirementsAlert,
  parseServerUtc,
  responseCodeChipColors,
} from '@/lib/run-card-conditions';
import { type DispatchResponseCodeData, OutstandingRequirementsAlertKind } from '@/models/v4/awaitingResources/awaitingResourcesResultData';
import { type DispatchRecommendationResultData, RequirementFallbackStep, ResponseTimeSource, RunCardStatusFilter, type UnitRecommendationData } from '@/models/v4/runcards/dispatchRecommendationResultData';

const unit = (unitId: number, responseCodeId: number | null): UnitRecommendationData =>
  ({ UnitId: unitId, UnitName: `U-${unitId}`, ResponseCodeId: responseCodeId, SelectionReason: 4, LocationIsStale: false, SatisfiesRequirementId: 1 }) as UnitRecommendationData;

const recommendation = (units: UnitRecommendationData[], outcomeNodeKey: string | null = 'leaf-a'): DispatchRecommendationResultData =>
  ({
    MatchedRunCardId: 9,
    MatchedRunCardName: 'Cardiac arrest',
    AlarmLevel: 1,
    ModeUsed: 2,
    AutoDispatch: false,
    Units: units,
    Personnel: [],
    Shortfalls: [],
    MoveUps: [],
    Notes: [],
    Decision: outcomeNodeKey === null ? null : ({ OutcomeNodeKey: outcomeNodeKey } as DispatchRecommendationResultData['Decision']),
  }) as DispatchRecommendationResultData;

const code = (id: number, overrides: Partial<DispatchResponseCodeData> = {}): DispatchResponseCodeData => ({
  Id: id,
  Code: `C${id}`,
  Name: `Code ${id}`,
  Description: null,
  Color: null,
  SortOrder: 0,
  Retired: false,
  ...overrides,
});

describe('formatResponseSeconds', () => {
  it('formats seconds as m:ss', () => {
    expect(formatResponseSeconds(250)).toBe('4:10');
    expect(formatResponseSeconds(59.6)).toBe('1:00');
    expect(formatResponseSeconds(0)).toBe('0:00');
  });

  it('is null without a usable time', () => {
    expect(formatResponseSeconds(null)).toBeNull();
    expect(formatResponseSeconds(undefined)).toBeNull();
    expect(formatResponseSeconds(-5)).toBeNull();
    expect(formatResponseSeconds(Number.NaN)).toBeNull();
  });

  it('signs a margin', () => {
    expect(formatMarginSeconds(90)).toBe('+1:30');
    expect(formatMarginSeconds(-20)).toBe('-0:20');
    expect(formatMarginSeconds(null)).toBeNull();
  });
});

describe('operandDisplay', () => {
  const operand = (targets: string | null, resource: string | null) => ({
    TargetsLabel: targets,
    StatusFilter: RunCardStatusFilter.AnyAvailable,
    IsPerson: false,
    ResourceId: resource ? '1' : null,
    ResourceName: resource,
    ResponseSeconds: null,
    TimeSource: ResponseTimeSource.Estimated,
    PositionSource: 0,
    Stale: false,
    CandidateCount: resource ? 1 : 0,
  });

  it('names the targets with the resource it picked', () => {
    expect(operandDisplay(operand('MUG', 'M-1'), 'none')).toBe('MUG (M-1)');
  });

  it('says nothing matched when there was no pick', () => {
    expect(operandDisplay(operand('PIT', null), 'none')).toBe('PIT (none)');
    expect(operandDisplay(null, 'none')).toBe('none');
  });
});

describe('fallbackStepKey', () => {
  it('maps each step to its line', () => {
    expect(fallbackStepKey(RequirementFallbackStep.Relaxed, false)).toBe('run_cards.conditions.fallback_relaxed');
    expect(fallbackStepKey(RequirementFallbackStep.Substitute, true)).toBe('run_cards.conditions.fallback_substitute');
    expect(fallbackStepKey(RequirementFallbackStep.Substitute, false)).toBe('run_cards.conditions.fallback_substitute_none');
    expect(fallbackStepKey(RequirementFallbackStep.Shortfall, false)).toBe('run_cards.conditions.fallback_shortfall');
  });
});

describe('response codes', () => {
  it('leaves retired codes out of the picker and keeps the department order', () => {
    const codes = activeResponseCodes([code(1, { SortOrder: 2 }), code(2, { Retired: true }), code(3, { SortOrder: 1 })]);
    expect(codes.map((c) => c.Id)).toEqual([3, 1]);
  });

  it('colours a chip only for an opaque hex colour', () => {
    expect(responseCodeChipColors('#ff0000')).toEqual({ backgroundColor: '#ff0000', color: expect.any(String) });
    expect(responseCodeChipColors('red')).toBeNull();
    expect(responseCodeChipColors(null)).toBeNull();
  });

  it("uses the dispatcher's choice over the proposal, including choosing none", () => {
    expect(effectiveUnitResponseCodeId(unit(5, 3), {})).toBe(3);
    expect(effectiveUnitResponseCodeId(unit(5, 3), { 5: 4 })).toBe(4);
    expect(effectiveUnitResponseCodeId(unit(5, 3), { 5: null })).toBeNull();
  });

  it('posts every recommended unit being dispatched with the code it goes with', () => {
    const rec = recommendation([unit(5, 3), unit(6, null), unit(7, 1)]);

    expect(buildUnitResponseCodes(rec, { 6: 2 }, ['5', '6'], true)).toBe('5:3|6:2');
    expect(buildUnitResponseCodes(rec, { 5: null }, [5, 7], true)).toBe('5:|7:1');
  });

  it('posts nothing without a code catalog or recommended units in the selection', () => {
    const rec = recommendation([unit(5, 3)]);

    expect(buildUnitResponseCodes(rec, {}, ['5'], false)).toBeUndefined();
    expect(buildUnitResponseCodes(rec, {}, ['99'], true)).toBeUndefined();
    expect(buildUnitResponseCodes(null, {}, ['5'], true)).toBeUndefined();
  });

  it('posts the outcome node only for a conditional card', () => {
    expect(outcomeNodeKeyFor(recommendation([], 'leaf-b'))).toBe('leaf-b');
    expect(outcomeNodeKeyFor(recommendation([], null))).toBeUndefined();
    expect(outcomeNodeKeyFor(null)).toBeUndefined();
  });
});

describe('server times', () => {
  it('reads a zone-less server time as UTC', () => {
    expect(parseServerUtc('2026-10-22T10:00:00')?.toISOString()).toBe('2026-10-22T10:00:00.000Z');
    expect(parseServerUtc('2026-10-22T10:00:00Z')?.toISOString()).toBe('2026-10-22T10:00:00.000Z');
    expect(parseServerUtc('2026-10-22T12:00:00+02:00')?.toISOString()).toBe('2026-10-22T10:00:00.000Z');
    expect(parseServerUtc('not a date')).toBeNull();
  });

  it('counts whole minutes since', () => {
    const now = Date.parse('2026-10-22T10:05:30Z');
    expect(minutesSinceServerUtc('2026-10-22T10:00:00', now)).toBe(5);
    expect(minutesSinceServerUtc('2026-10-22T10:10:00', now)).toBe(0);
    expect(minutesSinceServerUtc(null, now)).toBeNull();
  });
});

describe('parseOutstandingRequirementsAlert', () => {
  it('reads the camel-cased JSON payload', () => {
    const payload = JSON.stringify({
      kind: 1,
      unitId: 41,
      unitName: 'M-1',
      unitTypeName: 'MUG',
      message: 'M-1 available: 2 calls waiting for a MUG',
      calls: [
        { callId: 7, callNumber: '26-7', callName: 'Cardiac arrest', priority: 1, label: 'MUG', responseSeconds: 240, ageMinutes: 6 },
        { callId: 0, callNumber: 'bad' },
      ],
    });

    expect(parseOutstandingRequirementsAlert(payload)).toEqual({
      kind: OutstandingRequirementsAlertKind.UnitAvailable,
      unitId: 41,
      unitName: 'M-1',
      unitTypeName: 'MUG',
      message: 'M-1 available: 2 calls waiting for a MUG',
      calls: [{ callId: 7, callNumber: '26-7', callName: 'Cardiac arrest', priority: 1, label: 'MUG', responseSeconds: 240, ageMinutes: 6 }],
    });
  });

  it('is null for an id-only push from an older server or an unreadable payload', () => {
    expect(parseOutstandingRequirementsAlert(undefined)).toBeNull();
    expect(parseOutstandingRequirementsAlert('')).toBeNull();
    expect(parseOutstandingRequirementsAlert('{not json')).toBeNull();
    expect(parseOutstandingRequirementsAlert('[1,2]')).toBeNull();
  });

  it('treats an unknown kind as a plain change', () => {
    expect(parseOutstandingRequirementsAlert({ kind: 9 })?.kind).toBe(OutstandingRequirementsAlertKind.Changed);
  });
});
