import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform } from 'react-native';

import { buildDispatchList, closeCall, dispatchCallNow, getCallExtraData } from '@/api/calls/calls';
import { dispatchesToSelection, EMPTY_DISPATCH_SELECTION } from '@/lib/dispatch-helpers';
import { logger } from '@/lib/logging';
import { CallState } from '@/lib/utils';
import { type DispatchedEventResultData } from '@/models/v4/calls/dispatchedEventResultData';
import { refreshQueuedCallLists, usePendingCallsStore } from '@/stores/calls/pending-store';
import { type DispatchSelection } from '@/stores/dispatch/store';
import { useToastStore } from '@/stores/toast/store';

import { DispatchSelectionModal } from './dispatch-selection-modal';

type TranslateFn = ReturnType<typeof useTranslation>['t'];

/** Asks before an irreversible action: the browser's confirm on web, a native alert elsewhere. */
export const confirmCallAction = (message: string, confirmLabel: string, onConfirm: () => void, t: TranslateFn) => {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.confirm(message)) onConfirm();
    return;
  }
  Alert.alert('', message, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: confirmLabel, onPress: onConfirm },
  ]);
};

/** Number of recipients in a selection; "everyone" counts as one. */
const selectionSize = (selection: DispatchSelection) => (selection.everyone ? 1 : selection.users.length + selection.groups.length + selection.roles.length + selection.units.length);

/** The plain-text reason a 400 from DispatchCallNow / CloseCall carries, when there is one. */
const getServerMessage = (error: unknown): string | null => {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  return typeof data === 'string' && data.trim() ? data.trim() : null;
};

interface PickerTarget {
  callId: string;
  initialSelection: DispatchSelection;
  /** Recipients already stored on the call (its proposed dispatch); null when they could not be read. */
  proposedCount: number | null;
}

interface UseCallDispatchNowOptions {
  /** Runs after a call was dispatched (it is now Active) and the pending and scheduled lists were refreshed. */
  onDispatched?: (callId: string) => void;
  /** Runs after a pending call was cancelled. */
  onCancelled?: (callId: string) => void;
}

/**
 * Dispatching a Pending call, or a scheduled call ahead of its time, through `Calls/DispatchCallNow`.
 *
 * - `openDispatchPicker` opens the dispatch picker preselected with the call's proposed recipients
 *   (its current `Dispatches`). Confirming sends the picked list; confirming an empty pick falls back to
 *   the proposed recipients, so the server dispatches whoever was proposed when the call was saved.
 * - `confirmDispatchNow` asks, then dispatches to the recipients already on the call (scheduled calls).
 * - `confirmCancelPending` asks, then closes a pending call as Cancelled. Nobody was notified of it, so
 *   nobody is notified of the cancellation either.
 *
 * Render `dispatchPicker` once in the screen that uses the hook.
 */
export const useCallDispatchNow = ({ onDispatched, onCancelled }: UseCallDispatchNowOptions = {}) => {
  const { t } = useTranslation();
  const showToast = useToastStore((state) => state.showToast);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [busyCallId, setBusyCallId] = useState<string | null>(null);

  const runDispatch = useCallback(
    async (callId: string, dispatchList?: string) => {
      setBusyCallId(callId);
      try {
        await dispatchCallNow(callId, dispatchList);
        showToast('success', t('calls.dispatch_now_success'));
        refreshQueuedCallLists();
        onDispatched?.(callId);
      } catch (error) {
        const serverMessage = getServerMessage(error);
        logger.error({ message: 'Failed to dispatch call now', context: { error, callId, serverMessage } });
        showToast('error', serverMessage ? `${t('calls.dispatch_now_error')}: ${serverMessage}` : t('calls.dispatch_now_error'));
      } finally {
        setBusyCallId(null);
      }
    },
    [onDispatched, showToast, t]
  );

  const openDispatchPicker = useCallback(async (callId: string, knownDispatches?: DispatchedEventResultData[] | null) => {
    let proposed: DispatchSelection | null = knownDispatches ? dispatchesToSelection(knownDispatches) : null;

    if (!proposed) {
      setBusyCallId(callId);
      try {
        const extraData = await getCallExtraData(callId);
        proposed = dispatchesToSelection(extraData?.Data?.Dispatches);
      } catch (error) {
        // The picker still works without a preselection; an empty pick then lets the server use whatever
        // was proposed.
        logger.warn({ message: 'Could not read the proposed dispatch of a pending call', context: { error, callId } });
      } finally {
        setBusyCallId(null);
      }
    }

    setPickerTarget({ callId, initialSelection: proposed ?? EMPTY_DISPATCH_SELECTION, proposedCount: proposed ? selectionSize(proposed) : null });
  }, []);

  const handlePickerConfirm = useCallback(
    (selection: DispatchSelection) => {
      const target = pickerTarget;
      if (!target) return;

      const dispatchList = buildDispatchList(selection);
      if (!dispatchList && target.proposedCount === 0) {
        showToast('error', t('calls.dispatch_now_no_recipients'));
        return;
      }

      // An empty pick sends no list, so the server dispatches the call's proposed recipients.
      void runDispatch(target.callId, dispatchList || undefined);
    },
    [pickerTarget, runDispatch, showToast, t]
  );

  const confirmDispatchNow = useCallback(
    (callId: string) => {
      confirmCallAction(t('calls.dispatch_now_confirm'), t('calls.dispatch_now'), () => void runDispatch(callId), t);
    },
    [runDispatch, t]
  );

  const confirmCancelPending = useCallback(
    (callId: string) => {
      confirmCallAction(
        t('pending_calls.cancel_confirm'),
        t('pending_calls.cancel_call'),
        () => {
          void (async () => {
            setBusyCallId(callId);
            try {
              await closeCall({ callId, type: CallState.CANCELLED });
              showToast('success', t('pending_calls.cancel_success'));
              void usePendingCallsStore.getState().fetchPendingCalls();
              onCancelled?.(callId);
            } catch (error) {
              const serverMessage = getServerMessage(error);
              logger.error({ message: 'Failed to cancel pending call', context: { error, callId, serverMessage } });
              showToast('error', serverMessage ? `${t('pending_calls.cancel_error')}: ${serverMessage}` : t('pending_calls.cancel_error'));
            } finally {
              setBusyCallId(null);
            }
          })();
        },
        t
      );
    },
    [onCancelled, showToast, t]
  );

  const dispatchPicker = (
    <DispatchSelectionModal isVisible={pickerTarget !== null} onClose={() => setPickerTarget(null)} onConfirm={handlePickerConfirm} initialSelection={pickerTarget?.initialSelection ?? EMPTY_DISPATCH_SELECTION} />
  );

  return { openDispatchPicker, confirmDispatchNow, confirmCancelPending, busyCallId, dispatchPicker };
};
