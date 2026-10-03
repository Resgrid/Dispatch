import type { PasskeyCeremonyData, PasskeyData, SsoBeginData, SsoRedeemData } from '@/lib/mfa/types';

import { api } from '../common/client';

// ---------------------------------------------------------------------------
// The signed-in side of sign-in methods (passkey plan sections 6.5, 7.6 and 7.9): the account methods view, passkeys for
// this app, the Responder installations that approve sign-ins, and the fresh verification the server asks for before any
// change.
// Bodies are PascalCase; results carry their payload in `Data`.
// ---------------------------------------------------------------------------

const data = async <T>(request: Promise<{ data: { Data: T } }>): Promise<T> => (await request).data.Data;

// ---- Account methods view (plan section 6.5) --------------------------------------------------------------------------

export interface TotpMethodData {
  Enrolled: boolean;
  EnrolledOn: string | null;
  LastUsedOn: string | null;
  RecoveryCodesRemaining: number;
  RecoveryCodeWarning: boolean;
  SetUpOnSharedInstallation: boolean;
  CanTurnOff: boolean;
}

export interface PasskeyGroupData {
  Client: string;
  RegistrationAvailable: boolean;
  Passkeys: PasskeyData[];
}

export interface ApprovalInstallationData {
  InstallationId: string;
  Label: string | null;
  Platform: string | null;
  IsCurrent: boolean;
  ApprovalsOn: boolean;
  StoppedOn: string | null;
  LastDecisionOn: string | null;
  LastDecision: 'approved' | 'denied' | null;
}

export interface LinkedIdentityData {
  DepartmentId: number;
  DepartmentName: string | null;
  ProviderType: string | null;
  LinkedOn: string | null;
  AcceptsProviderStepUp: boolean;
  LastProviderStepUpOn: string | null;
}

export interface MfaActivityData {
  ActivityId: string;
  OccurredOn: string;
  Method: string;
  Purpose: string;
  Successful: boolean;
  Client: string | null;
  Installation: string | null;
  SharedInstallation: boolean;
  IsCurrentSession: boolean;
  ReportedOn: string | null;
}

export interface AccountMethodsData {
  CurrentClient: string | null;
  Totp: TotpMethodData;
  PasskeyGroups: PasskeyGroupData[];
  ApprovalInstallations: ApprovalInstallationData[];
  LinkedIdentities: LinkedIdentityData[];
  RecentActivity: MfaActivityData[];
}

export const getAccountMethods = () => data<AccountMethodsData>(api.get('/AccountSecurity/Methods'));

/** "This wasn't me": ends the session a verification served and sends a notice. */
export const reportActivity = (activityId: string) => data<{ SessionEnded: boolean; NextSteps: string[] }>(api.post('/AccountSecurity/ReportActivity', { ActivityId: activityId }));

// ---- Fresh proof before a change (plan sections 6.2 and 7.6 row 14) ----------------------------------------------------

export const reauthenticateWithPassword = (password: string) => data<{ VerifiedAt: string }>(api.post('/AccountSecurity/Reauthenticate', { Password: password }));

export interface SsoReauthSecrets {
  returnTarget: string;
  state: string;
  codeChallenge: string;
  platform: string;
}

/** For a member whose department signs in through its identity provider: reauthenticate there instead of with a password. */
export const beginSsoReauthentication = (secrets: SsoReauthSecrets) =>
  data<SsoBeginData>(
    api.post('/Sso/Begin', {
      Purpose: 'reauth',
      ReturnTarget: secrets.returnTarget,
      State: secrets.state,
      CodeChallenge: secrets.codeChallenge,
      CodeChallengeMethod: 'S256',
      Platform: secrets.platform,
    })
  );

export const redeemSsoReauthentication = (ssoTransactionId: string, ssoCode: string, codeVerifier: string) =>
  data<SsoRedeemData>(api.post('/Sso/Redeem', { SsoTransactionId: ssoTransactionId, SsoCode: ssoCode, CodeVerifier: codeVerifier }));

export interface StepUpOptionsData {
  Methods: string[];
  Preferred: string | null;
  EnrollmentRequired: boolean;
  WindowMinutes: number;
  Passkey: PasskeyCeremonyData | null;
}

export const getStepUpOptions = (operation: string) => data<StepUpOptionsData>(api.get('/Mfa/StepUpOptions', { params: { operation } }));

export interface VerifyStepUpInput {
  Operation: string;
  Method: 'totp' | 'passkey';
  Code?: string;
  RequestId?: string;
  Credential?: Record<string, unknown>;
}

export const verifyStepUp = (input: VerifyStepUpInput) => data<{ VerifiedAt: string; ExpiresAt: string }>(api.post('/Mfa/VerifyStepUp', input as unknown as Record<string, unknown>));

// ---- Passkeys for this app (plan section 6.1) --------------------------------------------------------------------------

export const getPasskeyRegistrationOptions = () => data<PasskeyCeremonyData>(api.post('/Passkeys/RegistrationOptions', {}));

export const completePasskeyRegistration = (requestId: string, credential: Record<string, unknown>, displayName: string) =>
  data<PasskeyData>(api.post('/Passkeys/CompleteRegistration', { RequestId: requestId, Credential: credential, DisplayName: displayName }));

export interface PasskeyChangeData {
  Revoked: number;
  SessionsEnded: number;
  CurrentSessionEnded: boolean;
}

export const renamePasskey = (passkeyId: string, displayName: string) => data<PasskeyChangeData>(api.post('/Passkeys/Rename', { PasskeyId: passkeyId, DisplayName: displayName }));

export const revokePasskey = (passkeyId: string) => data<PasskeyChangeData>(api.post('/Passkeys/Revoke', { PasskeyId: passkeyId }));

/** Responder passkeys only: whether this passkey may approve other apps' sign-ins. */
export const setPasskeyApproval = (passkeyId: string, enabled: boolean) => data<PasskeyChangeData>(api.post('/Passkeys/SetApproval', { PasskeyId: passkeyId, Enabled: enabled }));

export const stopApprovalInstallations = (installationId: string | null) =>
  data<{ InstallationsStopped: number; PasskeysStopped: number }>(api.post('/MfaApproval/Installations/Disable', installationId ? { InstallationId: installationId, All: false } : { All: true }));
