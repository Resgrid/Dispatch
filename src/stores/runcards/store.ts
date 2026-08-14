import { create } from 'zustand';

import { escalateCall as escalateCallApi, type EscalateCallResultData, getDispatchRecommendation, type RecommendationRequest } from '@/api/runcards/runcards';
import { logger } from '@/lib/logging';
import { type DispatchRecommendationResultData } from '@/models/v4/runcards/dispatchRecommendationResultData';

import { isRunCardsEnabled } from '../feature-flags/store';

/**
 * Holds the run card recommendation for the call currently being composed or edited.
 *
 * The recommendation is a *preview*: nothing is dispatched by fetching it. The dispatcher applies
 * it into the normal dispatch selection, which then rides the existing manual pipeline — the same
 * stance the web New Call page takes. Auto-dispatch, when the department has it on, happens
 * server-side at call creation and never needs the app to do anything.
 */

/** Debounce for the auto-fetch: priority/type/location all change as the dispatcher types. */
const RECOMMENDATION_DEBOUNCE_MS = 600;

interface RunCardsState {
  recommendation: DispatchRecommendationResultData | null;
  isLoading: boolean;
  error: string | null;
  /** True once a fetch settled, so the UI can tell "not asked yet" from "asked, no card matched". */
  hasFetched: boolean;
  /** Recommendation ids the dispatcher has already applied, so the panel can show it as applied. */
  appliedRunCardId: number | null;

  isEscalating: boolean;
  escalationError: string | null;

  fetchRecommendation: (request: RecommendationRequest) => Promise<void>;
  fetchRecommendationDebounced: (request: RecommendationRequest) => void;
  markApplied: (runCardId: number | null) => void;
  clear: () => void;
  escalate: (callId: string) => Promise<EscalateCallResultData | null>;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let inFlightController: AbortController | null = null;

export const useRunCardsStore = create<RunCardsState>((set, get) => ({
  recommendation: null,
  isLoading: false,
  error: null,
  hasFetched: false,
  appliedRunCardId: null,
  isEscalating: false,
  escalationError: null,

  fetchRecommendation: async (request: RecommendationRequest) => {
    // Gated client-side as well as server-side: with the toggle off the endpoint 404s, and a 404
    // rendered as an error would be a permanent scary banner on a department that simply does not
    // use run cards.
    if (!isRunCardsEnabled()) {
      set({ recommendation: null, isLoading: false, error: null, hasFetched: false });
      return;
    }

    // A recommendation is meaningless without both trigger inputs — run cards match on priority
    // and/or call type, so asking before the dispatcher has picked them just wastes a round trip.
    if (typeof request.priority !== 'number' || !request.type) {
      set({ recommendation: null, isLoading: false, error: null, hasFetched: false });
      return;
    }

    inFlightController?.abort();
    const controller = new AbortController();
    inFlightController = controller;

    set({ isLoading: true, error: null });

    try {
      const recommendation = await getDispatchRecommendation(request, controller.signal);

      // A newer request superseded this one while it was in flight.
      if (inFlightController !== controller) {
        return;
      }

      set({ recommendation, isLoading: false, hasFetched: true, error: null });
    } catch (error) {
      if (controller.signal.aborted || inFlightController !== controller) {
        return;
      }

      logger.error({
        message: 'Failed to fetch run card recommendation',
        context: { error },
      });

      // Never block call creation on this: the panel shows a quiet failure and the dispatcher
      // carries on selecting resources by hand.
      set({
        recommendation: null,
        isLoading: false,
        hasFetched: true,
        error: error instanceof Error ? error.message : 'Failed to fetch recommendation',
      });
    }
  },

  fetchRecommendationDebounced: (request: RecommendationRequest) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void get().fetchRecommendation(request);
    }, RECOMMENDATION_DEBOUNCE_MS);
  },

  markApplied: (runCardId: number | null) => {
    set({ appliedRunCardId: runCardId });
  },

  clear: () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    inFlightController?.abort();
    inFlightController = null;

    set({
      recommendation: null,
      isLoading: false,
      error: null,
      hasFetched: false,
      appliedRunCardId: null,
      isEscalating: false,
      escalationError: null,
    });
  },

  escalate: async (callId: string) => {
    if (!isRunCardsEnabled()) {
      return null;
    }

    set({ isEscalating: true, escalationError: null });

    try {
      const result = await escalateCallApi(callId);
      set({ isEscalating: false });
      return result;
    } catch (error) {
      logger.error({
        message: 'Failed to escalate call alarm level',
        context: { error, callId },
      });
      set({
        isEscalating: false,
        escalationError: error instanceof Error ? error.message : 'Failed to escalate call',
      });
      return null;
    }
  },
}));
