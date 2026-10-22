import { invertColor } from '@/lib/utils';
import {
  type AwaitingResourcesCallData,
  type DispatchResponseCodeData,
  type OutstandingRequirementsAlert,
  type OutstandingRequirementsAlertCall,
  OutstandingRequirementsAlertKind,
} from '@/models/v4/awaitingResources/awaitingResourcesResultData';
import {
  type DispatchRecommendationResultData,
  RequirementFallbackStep,
  ResponseTimeSource,
  type RunCardConditionData,
  RunCardConditionResult,
  RunCardDecisionSource,
  type RunCardOperandData,
  type UnitRecommendationData,
} from '@/models/v4/runcards/dispatchRecommendationResultData';

/**
 * Presentation and request helpers for conditional run cards (Dispatch.RunCardConditions): the decision explanation,
 * response codes and calls awaiting resources. Kept out of the components so the rules are unit testable and the New
 * Call, add-resources and awaiting-resources surfaces cannot drift apart on them.
 */

/** A response time as m:ss ("4:05"). Null when the engine had no time. */
export const formatResponseSeconds = (seconds: number | null | undefined): string | null => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;

  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
};

/** A signed margin as m:ss ("+1:30", "-0:20"). Null when there is none. */
export const formatMarginSeconds = (seconds: number | null | undefined): string | null => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
    return null;
  }

  const formatted = formatResponseSeconds(Math.abs(seconds));
  return formatted ? `${seconds < 0 ? '-' : '+'}${formatted}` : null;
};

/**
 * A server timestamp the API stores in UTC (decision pins, requirement times). Zone-less values are UTC, not device
 * time, so a "Z" is assumed when the value carries no designator.
 */
export const parseServerUtc = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value.trim());
  const date = new Date(hasZone ? value : `${value.trim()}Z`);

  return Number.isNaN(date.getTime()) ? null : date;
};

/** Whole minutes since a server UTC timestamp (never negative); null when it cannot be read. */
export const minutesSinceServerUtc = (value: string | null | undefined, now: number = Date.now()): number | null => {
  const date = parseServerUtc(value);
  return date ? Math.max(0, Math.floor((now - date.getTime()) / 60000)) : null;
};

/** Translation key for the branch a condition followed. */
export const conditionResultKey = (result: RunCardConditionResult): string => {
  switch (result) {
    case RunCardConditionResult.Yes:
      return 'run_cards.conditions.result_yes';
    case RunCardConditionResult.No:
      return 'run_cards.conditions.result_no';
    default:
      return 'run_cards.conditions.result_uncertain';
  }
};

/** Translation key for the "decision pinned" line; each takes `time`. */
export const pinSourceKey = (source: RunCardDecisionSource | null | undefined): string => {
  switch (source) {
    case RunCardDecisionSource.DispatcherPreview:
      return 'run_cards.conditions.pinned_preview';
    case RunCardDecisionSource.Reevaluated:
      return 'run_cards.conditions.pinned_reevaluated';
    default:
      return 'run_cards.conditions.pinned_save_time';
  }
};

/** Translation key for how a response time was measured. */
export const timeSourceKey = (source: ResponseTimeSource | null | undefined): string => (source === ResponseTimeSource.Routed ? 'run_cards.conditions.time_routed' : 'run_cards.conditions.time_estimated');

/** Translation key for a fallback step's line; each takes `row`, plus `sent`/`package` or `filled`/`required`. */
export const fallbackStepKey = (step: RequirementFallbackStep, hasSentInstead: boolean): string => {
  switch (step) {
    case RequirementFallbackStep.Relaxed:
      return 'run_cards.conditions.fallback_relaxed';
    case RequirementFallbackStep.Substitute:
      return hasSentInstead ? 'run_cards.conditions.fallback_substitute' : 'run_cards.conditions.fallback_substitute_none';
    default:
      return 'run_cards.conditions.fallback_shortfall';
  }
};

/**
 * What an operand measured, as one phrase: the targets with the resource it picked ("MUG (M-1)"), or the targets alone
 * when nothing matched. `noneLabel` is the translated "none available".
 */
export const operandDisplay = (operand: RunCardOperandData | null | undefined, noneLabel: string): string => {
  if (!operand) {
    return noneLabel;
  }

  const targets = operand.TargetsLabel?.trim();
  const resource = operand.ResourceName?.trim();

  if (targets && resource) {
    return `${targets} (${resource})`;
  }

  return resource || (targets ? `${targets} (${noneLabel})` : noneLabel);
};

/** True when anything about the condition could have gone the other way. */
export const isConditionUncertain = (condition: RunCardConditionData): boolean => condition.Uncertain || condition.Result === RunCardConditionResult.Uncertain;

/**
 * Codes a dispatcher may pick: retired ones stay readable on history but cannot be chosen. Ordered as the department
 * set them up (sort order, then code).
 */
export const activeResponseCodes = (codes: DispatchResponseCodeData[] | null | undefined): DispatchResponseCodeData[] =>
  (codes ?? []).filter((code) => !!code && !code.Retired && !!code.Code).sort((a, b) => (a.SortOrder ?? 0) - (b.SortOrder ?? 0) || a.Code.localeCompare(b.Code));

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Badge colours for a response code chip; null when the code has no (valid, opaque) colour and gets a plain chip. */
export const responseCodeChipColors = (color: string | null | undefined): { backgroundColor: string; color: string } | null => {
  const backgroundColor = color?.trim();

  if (!backgroundColor || !HEX_COLOR.test(backgroundColor)) {
    return null;
  }

  return { backgroundColor, color: invertColor(backgroundColor, true) };
};

/** Per-unit response code choices the dispatcher made over the proposal: unit id to code id, null to clear. */
export type UnitResponseCodeChoices = Record<number, number | null>;

/** The code a recommended unit goes with: the dispatcher's choice when they made one, else the run card's proposal. */
export const effectiveUnitResponseCodeId = (unit: Pick<UnitRecommendationData, 'UnitId' | 'ResponseCodeId'>, choices: UnitResponseCodeChoices | null | undefined): number | null => {
  if (choices && Object.prototype.hasOwnProperty.call(choices, unit.UnitId)) {
    return choices[unit.UnitId] ?? null;
  }

  return unit.ResponseCodeId ?? null;
};

/**
 * The `UnitResponseCodes` value to post with a save: "unitId:codeId" for every recommended unit that is in the final
 * dispatch selection, with the code it is going with ("unitId:" when none), joined by "|". Posting what the dispatcher
 * saw (not just their changes) keeps the saved call on the reviewed codes even if the server re-reads the card.
 * Undefined when the department uses no codes or nothing recommended is being dispatched, so the field stays off the
 * request entirely.
 */
export const buildUnitResponseCodes = (
  recommendation: DispatchRecommendationResultData | null | undefined,
  choices: UnitResponseCodeChoices | null | undefined,
  selectedUnitIds: (string | number)[] | null | undefined,
  hasResponseCodes: boolean
): string | undefined => {
  if (!hasResponseCodes || !recommendation?.Units?.length || !selectedUnitIds?.length) {
    return undefined;
  }

  const selected = new Set(selectedUnitIds.map((id) => String(id)));
  const entries = recommendation.Units.filter((unit) => selected.has(String(unit.UnitId))).map((unit) => {
    const codeId = effectiveUnitResponseCodeId(unit, choices);
    return `${unit.UnitId}:${codeId ?? ''}`;
  });

  return entries.length > 0 ? entries.join('|') : undefined;
};

/** The outcome node to post as `RunCardOutcomeNodeKey` with a New Call save; undefined for a fixed card. */
export const outcomeNodeKeyFor = (recommendation: DispatchRecommendationResultData | null | undefined): string | undefined => {
  const key = recommendation?.MatchedRunCardId ? recommendation.Decision?.OutcomeNodeKey?.trim() : undefined;
  return key ? key : undefined;
};

/** The call number when it has one, else its id, as dispatchers refer to it. */
export const awaitingCallLabel = (call: Pick<AwaitingResourcesCallData, 'CallId' | 'CallNumber'>): string => call.CallNumber?.trim() || String(call.CallId);

const toNumberOrNull = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const toStringOrNull = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);

const parseAlertCall = (value: unknown): OutstandingRequirementsAlertCall | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const call = value as Record<string, unknown>;
  const callId = toNumberOrNull(call.callId);

  if (callId === null || callId <= 0) {
    return null;
  }

  return {
    callId,
    callNumber: toStringOrNull(call.callNumber),
    callName: toStringOrNull(call.callName),
    priority: toNumberOrNull(call.priority) ?? 0,
    label: toStringOrNull(call.label),
    responseSeconds: toNumberOrNull(call.responseSeconds),
    ageMinutes: toNumberOrNull(call.ageMinutes) ?? 0,
  };
};

/**
 * Reads the `outstandingRequirementsUpdated` payload: a JSON string (camel-cased) or, tolerated, an object. Null when
 * there is none (older servers send the call id alone) or it cannot be read; the caller then just refreshes.
 */
export const parseOutstandingRequirementsAlert = (payload: unknown): OutstandingRequirementsAlert | null => {
  let value: unknown = payload;

  if (typeof value === 'string') {
    if (!value.trim()) {
      return null;
    }

    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const kind = toNumberOrNull(raw.kind);
  const knownKinds: number[] = [OutstandingRequirementsAlertKind.Changed, OutstandingRequirementsAlertKind.UnitAvailable, OutstandingRequirementsAlertKind.AutoDispatched];

  return {
    kind: kind !== null && knownKinds.includes(kind) ? (kind as OutstandingRequirementsAlertKind) : OutstandingRequirementsAlertKind.Changed,
    unitId: toNumberOrNull(raw.unitId),
    unitName: toStringOrNull(raw.unitName),
    unitTypeName: toStringOrNull(raw.unitTypeName),
    message: toStringOrNull(raw.message),
    calls: Array.isArray(raw.calls) ? raw.calls.map(parseAlertCall).filter((call): call is OutstandingRequirementsAlertCall => call !== null) : [],
  };
};
