import { create } from 'zustand';

import { dismissRequirement as dismissRequirementApi, dispatchUnitToAwaitingCall, getAwaitingCalls, getResponseCodes } from '@/api/awaitingResources/awaitingResources';
import { logger } from '@/lib/logging';
import { activeResponseCodes, parseOutstandingRequirementsAlert } from '@/lib/run-card-conditions';
import { singleFlight } from '@/lib/single-flight';
import {
  type AwaitingResourcesActionResult,
  type AwaitingResourcesCallData,
  type DispatchResponseCodeData,
  type OutstandingRequirementsAlert,
  type OutstandingRequirementsAlertCall,
  OutstandingRequirementsAlertKind,
} from '@/models/v4/awaitingResources/awaitingResourcesResultData';

import { isRunCardConditionsEnabled } from '../feature-flags/store';
import { useToastStore } from '../toast/store';

/**
 * Calls awaiting resources (conditional run cards) and the department's response code catalog.
 *
 * A call is "awaiting resources" when a required resource marked "keep outstanding" could not be sent as configured: a
 * substitute went instead, or nothing could be sent. It stays awaiting until a matching resource is dispatched, a
 * person dismisses the requirement, or the call is closed, never on a timer. The list drives the persistent banner, the
 * menu badge and the Awaiting Resources screen, and it is refreshed on every `outstandingRequirementsUpdated` push.
 *
 * Everything here is inert unless the department has Dispatch.RunCards and Dispatch.RunCardConditions on: no request,
 * no state, no UI.
 */

/** How long the informational "dispatched automatically" toast stays up. */
const AUTO_DISPATCH_TOAST_MS = 10000;

/** Newest unit-available alerts kept on screen at once; older ones drop off. */
const MAX_UNIT_ALERTS = 5;

/**
 * A unit that became available and matches calls awaiting resources. Stays on screen until the dispatcher acts on it
 * (dispatches the unit), closes it, or every call it names stops waiting.
 */
export interface AwaitingUnitAlert {
  /** One alert per unit: a newer push for the same unit replaces it. */
  id: string;
  unitId: number;
  unitName: string | null;
  unitTypeName: string | null;
  message: string | null;
  calls: OutstandingRequirementsAlertCall[];
  receivedAt: number;
}

interface AwaitingResourcesState {
  /** Active calls awaiting a required resource, highest priority then oldest. */
  calls: AwaitingResourcesCallData[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number;
  /** Unit-available alerts waiting on the dispatcher, newest first. */
  unitAlerts: AwaitingUnitAlert[];
  /** The last payload received, for diagnostics and tests. */
  lastAlert: OutstandingRequirementsAlert | null;
  /** When the last `outstandingRequirementsUpdated` push arrived (epoch ms), so a call's own view can refetch on it. */
  lastPushAt: number;
  /** The action in flight (`dispatch:<callId>:<unitId>` or `dismiss:<requirementId>`), so its button can show a spinner. */
  busyKey: string | null;

  /** Pickable codes (retired ones left out). Empty means the department uses none: no code UI anywhere. */
  responseCodes: DispatchResponseCodeData[];
  /** Every code including retired ones, for showing the code a call was sent with. */
  allResponseCodes: DispatchResponseCodeData[];
  showCodesToCrews: boolean;
  responseCodesLoaded: boolean;

  fetchAwaitingCalls: () => Promise<void>;
  /** Loads the response code catalog once per session; `force` reloads it. */
  fetchResponseCodes: (force?: boolean) => Promise<void>;
  dismissRequirement: (callId: number, requirementId: number, note?: string) => Promise<boolean>;
  dispatchUnit: (callId: number, unitId: number) => Promise<AwaitingResourcesActionResult | null>;
  /** The `outstandingRequirementsUpdated` hub event: (call id or "0", payload JSON). */
  handleOutstandingRequirementsUpdated: (id: unknown, payload?: unknown) => void;
  dismissUnitAlert: (alertId: string) => void;
  reset: () => void;
}

const initialState = {
  calls: [] as AwaitingResourcesCallData[],
  isLoading: false,
  error: null as string | null,
  lastFetched: 0,
  unitAlerts: [] as AwaitingUnitAlert[],
  lastAlert: null as OutstandingRequirementsAlert | null,
  lastPushAt: 0,
  busyKey: null as string | null,
  responseCodes: [] as DispatchResponseCodeData[],
  allResponseCodes: [] as DispatchResponseCodeData[],
  showCodesToCrews: false,
  responseCodesLoaded: false,
};

/** Keeps each alert to the calls still awaiting resources, dropping alerts with nothing left to act on. */
const pruneAlerts = (alerts: AwaitingUnitAlert[], calls: AwaitingResourcesCallData[]): AwaitingUnitAlert[] => {
  const waiting = new Set(calls.map((call) => call.CallId));
  return alerts.map((alert) => ({ ...alert, calls: alert.calls.filter((call) => waiting.has(call.callId)) })).filter((alert) => alert.calls.length > 0);
};

const errorMessage = (error: unknown, fallback: string): string => (error instanceof Error ? error.message : fallback);

export const useAwaitingResourcesStore = create<AwaitingResourcesState>((set, get) => ({
  ...initialState,

  // Single-flight: the layout's mount and resume, the screen's focus, the banner and every hub push all refresh this
  // together; callers that arrive mid-request share one trailing refetch.
  fetchAwaitingCalls: singleFlight(async () => {
    if (!isRunCardConditionsEnabled()) {
      set({ calls: [], unitAlerts: [], isLoading: false, error: null });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await getAwaitingCalls();

      // The server re-checks the flag: Enabled false with an empty list means the department turned it off.
      const calls = response?.Enabled === false ? [] : (response?.Data ?? []);

      set((state) => ({
        calls,
        isLoading: false,
        lastFetched: Date.now(),
        unitAlerts: pruneAlerts(state.unitAlerts, calls),
      }));
    } catch (error) {
      logger.error({
        message: 'Failed to fetch calls awaiting resources',
        context: { error },
      });
      // Keep the last list: a failed refresh must not make a waiting call vanish from the banner.
      set({ isLoading: false, error: errorMessage(error, 'Failed to fetch calls awaiting resources') });
    }
  }),

  fetchResponseCodes: async (force = false) => {
    if (!isRunCardConditionsEnabled()) {
      set({ responseCodes: [], allResponseCodes: [], showCodesToCrews: false, responseCodesLoaded: false });
      return;
    }

    if (get().responseCodesLoaded && !force) {
      return;
    }

    try {
      const config = await getResponseCodes();
      set({
        responseCodes: activeResponseCodes(config.Codes),
        allResponseCodes: config.Codes ?? [],
        showCodesToCrews: !!config.ShowToCrews,
        responseCodesLoaded: true,
      });
    } catch (error) {
      // Codes are optional decoration on a proposal; without them the proposal still works, just without a picker.
      logger.warn({
        message: 'Failed to fetch dispatch response codes',
        context: { error },
      });
    }
  },

  dismissRequirement: async (callId: number, requirementId: number, note?: string) => {
    if (!isRunCardConditionsEnabled()) {
      return false;
    }

    set({ busyKey: `dismiss:${requirementId}` });

    try {
      const result = await dismissRequirementApi(callId, requirementId, note);

      if (result?.Success) {
        useToastStore.getState().showToast('success', 'awaiting_resources.dismiss_success');
      } else {
        useToastStore.getState().showToast('error', result?.Message || 'awaiting_resources.dismiss_error');
      }

      return !!result?.Success;
    } catch (error) {
      logger.error({
        message: 'Failed to dismiss outstanding requirement',
        context: { error, callId, requirementId },
      });
      useToastStore.getState().showToast('error', 'awaiting_resources.dismiss_error');
      return false;
    } finally {
      set({ busyKey: null });
      void get().fetchAwaitingCalls();
    }
  },

  dispatchUnit: async (callId: number, unitId: number) => {
    if (!isRunCardConditionsEnabled()) {
      return null;
    }

    set({ busyKey: `dispatch:${callId}:${unitId}` });

    try {
      const result = await dispatchUnitToAwaitingCall(callId, unitId);

      if (result?.Success) {
        // The unit is on its way: any alert offering it elsewhere is spent.
        set((state) => ({ unitAlerts: state.unitAlerts.filter((alert) => alert.unitId !== unitId) }));
        useToastStore.getState().showToast('success', result.Message || 'awaiting_resources.dispatch_success');
      } else {
        useToastStore.getState().showToast('error', result?.Message || 'awaiting_resources.dispatch_error');
      }

      return result ?? null;
    } catch (error) {
      logger.error({
        message: 'Failed to dispatch unit to call awaiting resources',
        context: { error, callId, unitId },
      });
      useToastStore.getState().showToast('error', 'awaiting_resources.dispatch_error');
      return null;
    } finally {
      set({ busyKey: null });
      void get().fetchAwaitingCalls();
    }
  },

  handleOutstandingRequirementsUpdated: (id: unknown, payload?: unknown) => {
    if (!isRunCardConditionsEnabled()) {
      return;
    }

    // Every kind changes the list in some way, and older servers send the call id alone: always refresh.
    set({ lastPushAt: Date.now() });
    void get().fetchAwaitingCalls();

    const alert = parseOutstandingRequirementsAlert(payload);
    if (!alert) {
      return;
    }

    set({ lastAlert: alert });

    if (alert.kind === OutstandingRequirementsAlertKind.UnitAvailable && alert.unitId !== null && alert.calls.length > 0) {
      const unitAlert: AwaitingUnitAlert = {
        id: `unit-${alert.unitId}`,
        unitId: alert.unitId,
        unitName: alert.unitName,
        unitTypeName: alert.unitTypeName,
        message: alert.message,
        calls: alert.calls,
        receivedAt: Date.now(),
      };

      set((state) => ({
        unitAlerts: [unitAlert, ...state.unitAlerts.filter((existing) => existing.unitId !== alert.unitId)].slice(0, MAX_UNIT_ALERTS),
      }));
      return;
    }

    if (alert.kind === OutstandingRequirementsAlertKind.AutoDispatched) {
      if (alert.unitId !== null) {
        set((state) => ({ unitAlerts: state.unitAlerts.filter((existing) => existing.unitId !== alert.unitId) }));
      }

      useToastStore.getState().showToast('info', alert.message || 'awaiting_resources.auto_dispatched_fallback', 'awaiting_resources.auto_dispatched_title', { duration: AUTO_DISPATCH_TOAST_MS });
    }
  },

  dismissUnitAlert: (alertId: string) => {
    set((state) => ({ unitAlerts: state.unitAlerts.filter((alert) => alert.id !== alertId) }));
  },

  reset: () => set(initialState),
}));
