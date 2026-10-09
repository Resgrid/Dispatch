import { useCallback, useEffect, useRef, useState } from 'react';

import { getCallRecommendation } from '@/api/runcards/runcards';
import { logger } from '@/lib/logging';
import { recommendedUnitIds, recommendedUserIds } from '@/lib/run-cards';
import { type DispatchRecommendationResultData } from '@/models/v4/runcards/dispatchRecommendationResultData';
import { type DispatchSelection } from '@/stores/dispatch/store';
import { useIsRunCardsEnabled } from '@/stores/feature-flags/store';

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

  const canRequest = isRunCardsEnabled && enabled && !!callId;

  const load = useCallback(async () => {
    controllerRef.current?.abort();

    if (!canRequest || !callId) {
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setIsLoading(true);
    setError(null);

    try {
      const result = await getCallRecommendation(callId, controller.signal);
      if (controller.signal.aborted) {
        return;
      }

      setRecommendation(result);
      setIsApplied(false);
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }

      logger.error({
        message: 'Failed to fetch run card recommendation for adding resources',
        context: { error: err, callId },
      });
      setRecommendation(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setHasFetched(true);
      }
    }
  }, [canRequest, callId]);

  useEffect(() => {
    if (!canRequest) {
      controllerRef.current?.abort();
      setRecommendation(null);
      setIsLoading(false);
      setError(null);
      setHasFetched(false);
      setIsApplied(false);
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
  };
};
