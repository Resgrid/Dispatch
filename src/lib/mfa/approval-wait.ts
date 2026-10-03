import type { ApprovalState, ApprovalStatusData } from './types';

export const APPROVAL_POLL_MS = 2000;

export type ApprovalWaitResult = ApprovalState | 'aborted' | 'unavailable';

const TERMINAL: readonly ApprovalState[] = ['approved', 'denied', 'expired', 'canceled', 'consumed'];

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });

/**
 * Waits for the member's Responder to decide (plan section 7.9): polls every 2 seconds until the request is decided,
 * expires or is canceled, or `signal` aborts. A sign-in has no realtime connection, so polling is the only way here.
 */
export const waitForApproval = async (status: () => Promise<ApprovalStatusData>, signal?: AbortSignal, intervalMs = APPROVAL_POLL_MS): Promise<ApprovalWaitResult> => {
  for (;;) {
    if (signal?.aborted) {
      return 'aborted';
    }
    let state: ApprovalState;
    try {
      state = (await status()).State;
    } catch {
      return 'unavailable';
    }
    if (TERMINAL.includes(state)) {
      return state;
    }
    await wait(intervalMs, signal);
  }
};
