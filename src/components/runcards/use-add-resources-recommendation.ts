import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getCallRecommendation } from '@/api/runcards/runcards';
import { type RecommendationConditionsProps } from '@/components/runcards/recommendation-panel';
import { runCardSaveFields } from '@/components/runcards/run-card-save-fields';
import { logger } from '@/lib/logging';
import { type UnitResponseCodeChoices } from '@/lib/run-card-conditions';
import { recommendedUnitIds, recommendedUserIds } from '@/lib/run-cards';
import { type DispatchRecommendationResultData } from '@/models/v4/runcards/dispatchRecommendationResultData';
import { useAwaitingResourcesStore } from '@/stores/awaiting-resources/store';
import { type DispatchSelection } from '@/stores/dispatch/store';
import { useIsRunCardConditionsEnabled, useIsRunCardsEnabled } from '@/stores/feature-flags/store';
import { useToastStore } from '@/stores/toast/store';

interface UseAddResourcesRecommendationArgs {
  /** The active call resources are being added to. */
  callId: string | null | undefined;
  /** Only while the picker is open: every open is a fresh lookup, since units clear and get committed all the time. */
  enabled: boolean;
}

/**
 * Run card recommendation for adding resources to a call already out. The server counts what the call already has toward
 * the run card, so only what is still missing comes back.
 *
 * Kept in local state rather than the run cards store: that store holds the New Call recommendation, which a dispatcher
 * may be composing while adding a unit to another call.
 *
 * Does nothing when `Dispatch.RunCards` is off for the department.
 */
export const useAddResourcesRecommendation = ({ callId, enabled }: UseAddResourcesRecommendationArgs) => {
  const isRunCardsEnabled = useIsRunCardsEnabled();

  const [recommendation, setRecommendation] = useState<DispatchRecommendationResultData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [isApplied, setIsApplied] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  // Conditional run cards: re-evaluating a pinned decision, and the dispatcher's response code choices.
  const isRunCardConditionsEnabled = useIsRunCardConditionsEnabled();
  const responseCodes = useAwaitingResourcesStore((state) => state.responseCodes);
  const [isReevaluating, setIsReevaluating] = useState(false);
  const [unitResponseCodes, setUnitResponseCodes] = useState<UnitResponseCodeChoices>({});

  const canRequest = isRunCardsEnabled && enabled && !!callId;

  const fetchRecommendation = useCallback(
    async (reevaluate: boolean) => {
      controllerRef.current?.abort();

      if (!canRequest || !callId) {
        return;
      }

      const controller = new AbortController();
      controllerRef.current = controller;
      // A re-evaluation keeps the current answer on screen (its button spins) instead of blanking the panel.
      if (reevaluate) {
        setIsReevaluating(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const result = reevaluate ? await getCallRecommendation(callId, controller.signal, { reevaluate: true }) : await getCallRecommendation(callId, controller.signal);
        if (controller.signal.aborted) {
          return;
        }

        setRecommendation(result);
        setIsApplied(false);
        setUnitResponseCodes({});
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        logger.error({
          message: 'Failed to fetch run card recommendation for adding resources',
          context: { error: err, callId, reevaluate },
        });

        if (reevaluate) {
          // The pinned answer is still valid; a failed fresh walk must not take it off screen.
          useToastStore.getState().showToast('error', 'run_cards.conditions.reevaluate_failed');
          return;
        }

        setRecommendation(null);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setIsReevaluating(false);
          setHasFetched(true);
        }
      }
    },
    [canRequest, callId]
  );

  const load = useCallback(() => fetchRecommendation(false), [fetchRecommendation]);
  const reevaluate = useCallback(() => {
    void fetchRecommendation(true);
  }, [fetchRecommendation]);

  useEffect(() => {
    if (!canRequest) {
      controllerRef.current?.abort();
      setRecommendation(null);
      setIsLoading(false);
      setIsReevaluating(false);
      setError(null);
      setHasFetched(false);
      setIsApplied(false);
      setUnitResponseCodes({});
      return;
    }

    void load();

    return () => controllerRef.current?.abort();
  }, [canRequest, load]);

  /**
   * Adds the recommended units and responders to the picker's selection. Additive: anything already picked stays picked.
   * Clears `everyone`, which is mutually exclusive with an explicit selection.
   */
  const applyToSelection = useCallback(
    (current: DispatchSelection): DispatchSelection => {
      if (!recommendation) {
        return current;
      }

      setIsApplied(true);

      return {
        ...current,
        everyone: false,
        units: Array.from(new Set([...current.units, ...recommendedUnitIds(recommendation)])),
        users: Array.from(new Set([...current.users, ...recommendedUserIds(recommendation)])),
      };
    },
    [recommendation]
  );

  const setUnitResponseCode = useCallback((unitId: number, codeId: number | null) => {
    setUnitResponseCodes((current) => ({ ...current, [unitId]: codeId }));
  }, []);

  // A call already out has its decision pinned at save time, so the panel offers Re-evaluate here (unlike New Call).
  const conditions = useMemo<RecommendationConditionsProps>(
    () => ({
      enabled: isRunCardConditionsEnabled,
      responseCodes,
      unitResponseCodes,
      onUnitResponseCodeChange: setUnitResponseCode,
      onReevaluate: reevaluate,
      isReevaluating,
    }),
    [isRunCardConditionsEnabled, responseCodes, unitResponseCodes, setUnitResponseCode, reevaluate, isReevaluating]
  );

  /** UnitResponseCodes for the add-resources save: the recommended units among those being added, with their codes. */
  const getUnitResponseCodes = useCallback(
    (selectedUnitIds: (string | number)[] | null | undefined): string | undefined => runCardSaveFields(recommendation, unitResponseCodes, selectedUnitIds, { includeOutcome: false }).unitResponseCodes,
    [recommendation, unitResponseCodes]
  );

  return {
    /** False when the department has run cards off: callers should not render the panel. */
    isRunCardsEnabled,
    recommendation,
    isLoading,
    error,
    hasFetched,
    isApplied,
    refresh: load,
    applyToSelection,
    /** Pass to the panel's `conditions` prop. */
    conditions,
    getUnitResponseCodes,
  };
};
