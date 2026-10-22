import { buildUnitResponseCodes, outcomeNodeKeyFor, type UnitResponseCodeChoices } from '@/lib/run-card-conditions';
import { type DispatchRecommendationResultData } from '@/models/v4/runcards/dispatchRecommendationResultData';
import { useAwaitingResourcesStore } from '@/stores/awaiting-resources/store';
import { isRunCardConditionsEnabled } from '@/stores/feature-flags/store';
import { useRunCardsStore } from '@/stores/runcards/store';

export interface RunCardSaveFields {
  unitResponseCodes?: string;
  runCardOutcomeNodeKey?: string;
}

/**
 * The conditional run card fields a save carries for a recommendation the dispatcher reviewed: the per-unit response
 * codes for the recommended units being dispatched, and (New Call only) the outcome node of the decision they saw, so
 * the saved call keeps that proposal. Empty without Dispatch.RunCardConditions, so the request stays exactly what it
 * was before.
 */
export const runCardSaveFields = (
  recommendation: DispatchRecommendationResultData | null | undefined,
  choices: UnitResponseCodeChoices | null | undefined,
  selectedUnitIds: (string | number)[] | null | undefined,
  options: { includeOutcome: boolean }
): RunCardSaveFields => {
  if (!isRunCardConditionsEnabled() || !recommendation?.MatchedRunCardId) {
    return {};
  }

  const hasResponseCodes = useAwaitingResourcesStore.getState().responseCodes.length > 0;
  const unitResponseCodes = buildUnitResponseCodes(recommendation, choices, selectedUnitIds, hasResponseCodes);
  const runCardOutcomeNodeKey = options.includeOutcome ? outcomeNodeKeyFor(recommendation) : undefined;

  return {
    ...(unitResponseCodes ? { unitResponseCodes } : {}),
    ...(runCardOutcomeNodeKey ? { runCardOutcomeNodeKey } : {}),
  };
};

/**
 * Adds the response codes a confirmed add-resources selection carried to its EditCall request; the request is returned
 * untouched when there are none, so it stays exactly what it was without conditional run cards.
 */
export const withUnitResponseCodes = <T extends object>(request: T, extras?: { unitResponseCodes?: string } | null): T & { unitResponseCodes?: string } =>
  extras?.unitResponseCodes ? { ...request, unitResponseCodes: extras.unitResponseCodes } : request;

/**
 * New Call: the fields for the recommendation on screen (the run cards store), read at save time so the submit handler
 * needs no extra dependencies.
 */
export const newCallRunCardSaveFields = (selectedUnitIds: (string | number)[] | null | undefined): RunCardSaveFields => {
  const { recommendation, unitResponseCodes } = useRunCardsStore.getState();
  return runCardSaveFields(recommendation, unitResponseCodes, selectedUnitIds, { includeOutcome: true });
};
