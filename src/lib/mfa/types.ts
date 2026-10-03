/** The second factors the server knows (passkey plan section 7.5; `MfaMethodNames`). */
export type MfaMethod = 'totp' | 'passkey' | 'passkey_approval' | 'federated';

export const MFA_METHODS: readonly MfaMethod[] = ['totp', 'passkey', 'passkey_approval', 'federated'];

export const isMfaMethod = (value: unknown): value is MfaMethod => typeof value === 'string' && (MFA_METHODS as readonly string[]).includes(value);

/** The token endpoint sends methods as a space-separated string; `Sso/Redeem` sends an array. */
export const parseMethods = (value: unknown): MfaMethod[] => {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(' ') : [];
  return items.map((item) => (typeof item === 'string' ? item.trim() : item)).filter(isMfaMethod);
};

/** A sign-in waiting for its second factor. The secret itself is never part of this view (see `mfa-transaction`). */
export interface MfaChallenge {
  /** `verify`: choose a second factor. `setup`: the department requires MFA the account does not have yet. `legacy`: the server has no transaction; resend with a code. */
  kind: 'verify' | 'setup' | 'legacy';
  /** What this sign-in accepts (the deployment's and department's switches), in the server's order. */
  methods: MfaMethod[];
  /** What the member has: a sign-in offers only the accepted methods that are also here. */
  enrolled: MfaMethod[];
  preferred: MfaMethod | null;
  /** Epoch ms after which the transaction is gone. */
  expiresAt: number | null;
  /** Where the first factor came from: a password, or the department's identity provider. */
  source: 'password' | 'sso';
}

/** The WebAuthn options the server issued, as JSON (base64url values, camelCase names). */
export type WebAuthnOptions = Record<string, unknown>;

export interface PasskeyCeremonyData {
  RequestId: string;
  Options: WebAuthnOptions;
}

export interface CompletionData {
  CompletionCode: string;
  ExpiresIn: number;
  Recovery: boolean;
  RecoveryCodes: string[] | null;
}

export interface ApprovalRequestData {
  ApprovalRequestId: string;
  MatchNumber: string;
  ExpiresIn: number;
}

export type ApprovalState = 'pending' | 'approved' | 'denied' | 'expired' | 'canceled' | 'consumed';

export interface ApprovalStatusData {
  State: ApprovalState;
  ExpiresAt: string | null;
}

export interface TotpSetupData {
  SharedKey: string;
  AuthenticatorUri: string;
  ExpiresIn: number;
}

export interface SsoBeginData {
  AuthorizeUrl: string;
  SsoTransactionId: string;
  ExpiresIn: number;
}

export interface SsoRedeemData {
  Outcome: 'mfa_required' | 'completed' | 'reauthenticated';
  Transaction: string | null;
  ExpiresIn: number;
  MfaMethods: string[] | null;
  MfaEnrolled: string[] | null;
  MfaPreferred: string | null;
  CompletionCode: string | null;
  MfaSatisfiedBy: string | null;
  VerifiedAt: string | null;
}

export interface FactorRecoveryStatusData {
  Transaction: string | null;
  State: 'pending' | 'canceled';
  ExpiresIn: number;
  NextActions: string[] | null;
  Passkeys: PasskeyData[] | null;
}

export interface RecoveryCompleteData {
  RecoveryCodes: string[];
  SignInAgain: boolean;
}

export interface PasskeyData {
  PasskeyId: string;
  DisplayName: string;
  Client: string | null;
  CreatedOn: string;
  CreatedPlatform: string | null;
  CreatedInstallation: string | null;
  CreatedOnSharedInstallation: boolean;
  Attachment: string | null;
  BackupEligible: boolean;
  BackedUp: boolean;
  LastUsedOn: string | null;
  LastUsedClient: string | null;
  LastUsedInstallation: string | null;
  ApprovalEnabled: boolean | null;
}

/** The v4 wrapper: every result here carries its payload in `Data`. */
export interface V4Result<T> {
  Data: T;
}

/** Server timestamps read from a row may lack a zone; they are UTC. */
export const parseUtc = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }
  const zoned = /([zZ]|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value}Z`;
  const parsed = Date.parse(zoned);
  return Number.isFinite(parsed) ? parsed : null;
};
