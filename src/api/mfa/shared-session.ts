import { OPERATOR_ACTIVITY_HEADER } from '@/lib/mfa/client-app';
import type { ApprovalRequestData, ApprovalStatusData, PasskeyCeremonyData, SsoBeginData } from '@/lib/mfa/types';
import type { CurrentSessionData } from '@/stores/shared-session/store';

import { api } from '../common/client';

// ---------------------------------------------------------------------------
// The shared session calls (passkey plan section 10.5, workbook section 8): bearer, and the only API paths a
// locked session may still use. Unlocking resumes the same session, so the tokens are kept throughout. Bodies are
// PascalCase; results carry their payload in `Data`.
// ---------------------------------------------------------------------------

const data = async <T>(request: Promise<{ data: { Data: T } }>): Promise<T> => (await request).data.Data;

/**
 * The server's view of this session. `activity` reports real operator input, which moves the idle deadline; polling
 * never sends it.
 */
export const getCurrentSession = (activity = false) => data<CurrentSessionData>(api.get('/sessions/current', activity ? { headers: { [OPERATOR_ACTIVITY_HEADER]: '1' } } : {}));

export const lockSession = () => data<{ Locked: boolean; LockVersion: number }>(api.post('/sessions/lock', {}));

/** Ends this operator's shift on the installation; the caller then drops tokens, caches and sockets. A body is required. */
export const endShift = (switchOperator: boolean) => data<{ Ended: boolean }>(api.post('/sessions/end-shift', { SwitchOperator: switchOperator }));

export interface UnlockOptionsData {
  Operator: string | null;
  LockVersion: number;
  /** Empty means no quick unlock: the shift has to end. */
  Methods: string[];
  Preferred: string | null;
  /** Never started on its own on a shared installation: the operator chooses it. */
  Passkey: PasskeyCeremonyData | null;
}

export const getUnlockOptions = (lockVersion: number) => data<UnlockOptionsData>(api.post('/sessions/unlock-options', { LockVersion: lockVersion }));

export const requestUnlockApproval = (lockVersion: number) => data<ApprovalRequestData>(api.post('/sessions/unlock-approval', { LockVersion: lockVersion }));

export const getUnlockApprovalStatus = (approvalRequestId: string) => data<ApprovalStatusData>(api.get(`/sessions/unlock-approval/${encodeURIComponent(approvalRequestId)}`));

export const cancelUnlockApproval = (approvalRequestId: string) => data<ApprovalStatusData>(api.delete(`/sessions/unlock-approval/${encodeURIComponent(approvalRequestId)}`));

export interface UnlockSsoSecrets {
  returnTarget: string;
  state: string;
  codeChallenge: string;
  platform: string;
}

/** Begins the provider's own sign-in for this lock (the broker asks who is signing in, every time). */
export const beginUnlockSso = (lockVersion: number, secrets: UnlockSsoSecrets) =>
  data<SsoBeginData>(
    api.post('/sessions/unlock-sso', {
      LockVersion: lockVersion,
      Platform: secrets.platform,
      ReturnTarget: secrets.returnTarget,
      State: secrets.state,
      CodeChallenge: secrets.codeChallenge,
      CodeChallengeMethod: 'S256',
    })
  );

export type CompleteUnlockInput =
  | { Method: 'totp'; Code: string }
  | { Method: 'passkey'; RequestId: string; Credential: Record<string, unknown> }
  | { Method: 'passkey_approval'; ApprovalRequestId: string }
  | { Method: 'federated'; SsoTransactionId: string; SsoCode: string; CodeVerifier: string };

/** Unlocks the same session; the result names the operator. */
export const completeUnlock = (lockVersion: number, input: CompleteUnlockInput) => data<CurrentSessionData>(api.post('/sessions/complete-unlock', { LockVersion: lockVersion, ...input }));
