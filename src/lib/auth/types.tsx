import type { ApprovalWaitResult } from '@/lib/mfa/approval-wait';
import type { ApprovalRequestData, MfaChallenge, TotpSetupData } from '@/lib/mfa/types';
import type { BrokeredSsoResult, LoginMfaResult, LoginMfaStep, RecoveryStart, SsoDepartment } from '@/stores/auth/login-mfa';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
  /** Current authenticator (TOTP) code; required when the account has 2FA enabled. */
  otpCode?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
  expiration_date: string;
}

export interface LoginResponse {
  successful: boolean;
  message: string;
  authResponse: AuthResponse | null;
  /** The server requires a TOTP code for this account (error mfa_required / invalid_totp). */
  mfaRequired?: boolean;
  /** A code was supplied but rejected (error invalid_totp). */
  invalidOtp?: boolean;
  /**
   * The sign-in continues on a login transaction (passkey plan section 7.5): the password was right and a second factor,
   * or setting one up, finishes it. The secret is the only authority for that; it is held in memory and never logged.
   */
  mfaTransaction?: { secret: string; challenge: MfaChallenge };
  /** The department requires MFA the account does not have, and this server cannot set it up in the app. */
  enrollmentRequired?: boolean;
}
export interface ProfileModel {
  sub: string;
  jti: string;
  useage: string;
  at_hash: string;
  nbf: number;
  exp: number;
  iat: number;
  iss: string;
  name: string;
  oi_au_id: string;
  oi_tkn_id: string;
}

export interface SsoConfig {
  ssoEnabled: boolean;
  providerType: 'oidc' | 'saml2' | null;
  authority: string | null;
  clientId: string | null;
  metadataUrl: string | null;
  entityId: string | null;
  /** Where a SAML sign-in without the broker starts (discovery's SamlLoginUrl): this server's page, sent on to the IdP. */
  samlLoginUrl: string | null;
  allowLocalLogin: boolean;
  requireSso: boolean;
  requireMfa: boolean;
  oidcRedirectUri: string | null;
  oidcScopes: string | null;
  departmentCode: string | null;
  /** The department's id, when the lookup resolved one (never for an unknown user). */
  departmentId: number | null;
  /** A system-encrypted department reference for `Sso/Begin` (passkey workbook section 7.3 discovery fix). */
  departmentToken: string | null;
  /** Whether sign-in can go through the Resgrid broker for this department now (plan section 7.7.2). */
  brokeredSsoAvailable: boolean;
}

export type AuthStatus = 'idle' | 'signedIn' | 'signedOut' | 'loading' | 'error' | 'onboarding' | 'mfaRequired';

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  refreshTokenExpiresOn: string | null;
  status: AuthStatus;
  error: string | null;
  profile: ProfileModel | null;
  userId: string | null;
  /**
   * A sign-in waiting for its second factor (or for the authenticator its department requires), when the server runs the
   * login transaction. Not persisted: the transaction secret lives in `login-mfa` memory and dies with the process.
   */
  mfaChallenge: MfaChallenge | null;
  /** Recovery codes from setting up an authenticator at sign-in, shown once after sign-in and then dropped. Never persisted. */
  pendingRecoveryCodes: string[] | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  /** Finishes the pending sign-in with a second factor (passkey plan section 7.5). */
  verifyLoginMfa: (step: LoginMfaStep) => Promise<LoginMfaResult>;
  /** Asks the member's Responder to approve the pending sign-in; the number is shown on this screen only. */
  requestLoginApproval: () => Promise<ApprovalRequestData | { code: string; restart: boolean }>;
  waitForLoginApproval: (approvalRequestId: string, signal?: AbortSignal) => Promise<ApprovalWaitResult>;
  cancelLoginApproval: (approvalRequestId: string) => Promise<void>;
  /** A new authenticator key for the setup the department requires. */
  loginSetupOptions: () => Promise<TotpSetupData | { code: string; restart: boolean }>;
  /** Abandons the pending sign-in; nothing of it is kept. */
  cancelLoginMfa: () => void;
  /** Signs in through the department's identity provider by way of the Resgrid broker (plan section 7.7.2). */
  loginWithBrokeredSso: (department: SsoDepartment) => Promise<BrokeredSsoResult>;
  dismissRecoveryCodes: () => void;
  /** "I lost my authenticator": spends a recovery code on the pending sign-in to open the restricted recovery. */
  beginFactorRecovery: (recoveryCode: string) => Promise<RecoveryStart | { code: string; restart: boolean }>;
  logout: (reason?: string) => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  isFirstTime: boolean;
  isAuthenticated: () => boolean;
  setIsOnboarding: () => void;
  loginWithSso: (authResponse: AuthResponse) => Promise<void>;
}
