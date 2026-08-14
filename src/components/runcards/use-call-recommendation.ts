import { useCallback, useEffect, useMemo } from 'react';

import { recommendedUnitIds, recommendedUserIds } from '@/lib/run-cards';
import { type DispatchSelection } from '@/stores/dispatch/store';
import { useIsRunCardsEnabled } from '@/stores/feature-flags/store';
import { useRunCardsStore } from '@/stores/runcards/store';

interface CallPriorityOption {
  Id: number;
  Name: string;
}

interface UseCallRecommendationArgs {
  /** Priority *name* as held by the form; resolved to its id against `callPriorities`. */
  priorityName: string | null | undefined;
  /** Call type name — the API resolves it case-insensitively. */
  typeName: string | null | undefined;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  callPriorities: CallPriorityOption[];
  /** Alarm level to preview. 1 for a new call; the next level when previewing an escalation. */
  alarmLevel?: number;
}

/**
 * Keeps a run card recommendation in step with the call being composed.
 *
 * Fetching is debounced in the store because priority, type and location all change while the
 * dispatcher works, and every change is a server round trip that runs the whole selection engine.
 *
 * Does nothing at all when `Dispatch.RunCards` is off for the department — no request, no state,
 * no panel. That is the single gate for the whole feature on this screen.
 */
export const useCallRecommendation = ({ priorityName, typeName, latitude, longitude, callPriorities, alarmLevel = 1 }: UseCallRecommendationArgs) => {
  const isRunCardsEnabled = useIsRunCardsEnabled();

  const recommendation = useRunCardsStore((state) => state.recommendation);
  const isLoading = useRunCardsStore((state) => state.isLoading);
  const error = useRunCardsStore((state) => state.error);
  const hasFetched = useRunCardsStore((state) => state.hasFetched);
  const appliedRunCardId = useRunCardsStore((state) => state.appliedRunCardId);
  const fetchRecommendationDebounced = useRunCardsStore((state) => state.fetchRecommendationDebounced);
  const fetchRecommendation = useRunCardsStore((state) => state.fetchRecommendation);
  const markApplied = useRunCardsStore((state) => state.markApplied);
  const clear = useRunCardsStore((state) => state.clear);

  const priorityId = useMemo(() => {
    if (!priorityName) {
      return null;
    }
    return callPriorities.find((priority) => priority.Name === priorityName)?.Id ?? null;
  }, [priorityName, callPriorities]);

  const request = useMemo(
    () => ({
      priority: priorityId ?? -1,
      type: typeName ?? '',
      latitude: typeof latitude === 'number' ? latitude : null,
      longitude: typeof longitude === 'number' ? longitude : null,
      alarmLevel,
    }),
    [priorityId, typeName, latitude, longitude, alarmLevel]
  );

  const canRequest = isRunCardsEnabled && priorityId !== null && !!typeName;

  useEffect(() => {
    if (!canRequest) {
      return;
    }

    fetchRecommendationDebounced(request);
  }, [canRequest, request, fetchRecommendationDebounced]);

  // Leaving the screen must not strand a recommendation for the next call composed.
  useEffect(() => () => clear(), [clear]);

  const refresh = useCallback(() => {
    if (!canRequest) {
      return;
    }
    void fetchRecommendation(request);
  }, [canRequest, fetchRecommendation, request]);

  /**
   * Merges the recommendation into an existing dispatch selection. Additive on purpose: anyone the
   * dispatcher already picked stays picked, and applying twice is idempotent. Clears `everyone`,
   * which is mutually exclusive with an explicit selection.
   */
  const applyToSelection = useCallback(
    (current: DispatchSelection): DispatchSelection => {
      if (!recommendation) {
        return current;
      }

      const unitIds = new Set([...current.units, ...recommendedUnitIds(recommendation)]);
      const userIds = new Set([...current.users, ...recommendedUserIds(recommendation)]);

      markApplied(recommendation.MatchedRunCardId ?? null);

      return {
        ...current,
        everyone: false,
        units: Array.from(unitIds),
        users: Array.from(userIds),
      };
    },
    [recommendation, markApplied]
  );

  return {
    /** False when the department has run cards off — callers should not render the panel at all. */
    isRunCardsEnabled,
    recommendation,
    isLoading,
    error,
    hasFetched,
    isApplied: !!recommendation?.MatchedRunCardId && appliedRunCardId === recommendation.MatchedRunCardId,
    refresh,
    applyToSelection,
  };
};
