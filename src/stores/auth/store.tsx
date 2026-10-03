import { jwtDecode } from 'jwt-decode';
import { Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { cacheManager } from '@/lib/cache/cache-manager';
import { clearCacheScope, setCacheScope } from '@/lib/cache/cache-scope';
import { logger } from '@/lib/logging';
import { clearMapboxToken } from '@/lib/mapbox-token';

import { clearPasswordVerificationHash, computePasswordVerification, forgetPendingSsoExchange, loginRequest, type PasswordVerification, savePasswordVerification, storePasswordVerificationHash } from '../../lib/auth/api';
import { cancelScheduledTokenRefresh, initTokenRefresh, performTokenRefresh, scheduleTokenRefresh } from '../../lib/auth/token-refresh';
import type { AuthResponse, AuthState, LoginCredentials } from '../../lib/auth/types';
import { type ProfileModel } from '../../lib/auth/types';
import { isSharedInstallation } from '../../lib/mfa/shared-installation';
import { markSharedSessionLocked, noteSessionRestoredAtLaunch, resetSharedSession } from '../shared-session/store';
import {
  cancelLoginApprovalRequest,
  forgetLoginSecrets,
  holdLoginTransaction,
  type LoginMfaHost,
  loginSetupOptions,
  signInWithBrokeredSso,
  type SsoDepartment,
  startFactorRecovery,
  startLoginApproval,
  verifyLoginMfa,
  waitForLoginApproval,
} from './login-mfa';

// Create MMKV storage instance for auth persistence
const authStorage = new MMKV({
  id: 'auth-storage',
  encryptionKey: Platform.OS === 'web' ? undefined : 'cfef987f-c70f-4fc3-ad9a-b2350d16ee89',
});

// MMKV storage adapter for Zustand
const mmkvStorage = {
  getItem: (name: string) => {
    const value = authStorage.getString(name);
    return value ?? null;
  },
  setItem: (name: string, value: string) => {
    authStorage.set(name, value);
  },
  removeItem: (name: string) => {
    authStorage.delete(name);
  },
};

// The personal lockscreen's verifier for a password sign-in still waiting for its second factor: memory only, stored
// when the sign-in finishes, dropped when it does not. A shared workstation never keeps one (plan section 12.5.2).
let pendingPasswordVerification: PasswordVerification | null = null;

/** Keeps the personal lockscreen's verifier, or makes sure none is left: a shared workstation and SSO never have one. */
const settlePasswordVerification = async (verification: PasswordVerification | null): Promise<void> => {
  try {
    if (verification && !isSharedInstallation()) {
      await savePasswordVerification(verification);
    } else {
      await clearPasswordVerificationHash();
    }
  } catch (error) {
    logger.warn({ message: 'Failed to update the lockscreen password verifier', context: { error: error instanceof Error ? error.message : String(error) } });
  }
};

/**
 * Signs in with a token response from the completion grant (passkey plan section 7.5): the profile from the id token and
 * the proactive refresh, exactly as the password path does. Throws on a missing or malformed id token, which no sign-in
 * may continue without.
 */
const signInWithTokens = (authResponse: AuthResponse, recoveryCodes: string[] | null): void => {
  if (!authResponse.id_token) {
    throw new Error('Invalid authentication response: missing token data');
  }
  const profileData = jwtDecode<ProfileModel>(authResponse.id_token);
  useAuthStore.setState({
    accessToken: authResponse.access_token,
    refreshToken: authResponse.refresh_token,
    refreshTokenExpiresOn: new Date(Date.now() + authResponse.expires_in * 1000).getTime().toString(),
    status: 'signedIn',
    error: null,
    profile: profileData,
    userId: profileData.sub,
    mfaChallenge: null,
    pendingRecoveryCodes: recoveryCodes,
  });
  const verification = pendingPasswordVerification;
  pendingPasswordVerification = null;
  void settlePasswordVerification(verification);
  scheduleTokenRefresh(authResponse.expires_in);
  logger.info({ message: 'Signed in on a login transaction', context: { userId: profileData.sub } });
};

/**
 * How the login transaction module moves this store: finishing a sign-in with tokens, showing a pending sign-in, or
 * sending the member back to the start. Called only after the store exists.
 */
const mfaHost: LoginMfaHost = {
  signIn: signInWithTokens,
  setChallenge: (challenge, error = null) => useAuthStore.setState({ status: challenge ? 'mfaRequired' : 'signedOut', mfaChallenge: challenge, error }),
  restart: (code) => {
    pendingPasswordVerification = null;
    useAuthStore.setState({ status: 'signedOut', mfaChallenge: null, error: code });
  },
};

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      refreshTokenExpiresOn: null,
      status: 'idle',
      error: null,
      profile: null,
      userId: null,
      isFirstTime: true,
      mfaChallenge: null,
      pendingRecoveryCodes: null,
      login: async (credentials: LoginCredentials) => {
        try {
          pendingPasswordVerification = null;
          set({ status: 'loading', error: null });
          logger.info({
            message: 'Login: Calling loginRequest API',
            context: { username: credentials.username, platform: Platform.OS },
          });

          const response = await loginRequest(credentials);

          logger.info({
            message: 'Login: Received response from API',
            context: { successful: response.successful },
          });

          if (response.successful) {
            if (!response.authResponse || !response.authResponse.id_token) {
              logger.error({
                message: 'Login: Missing auth response or id_token',
                context: {
                  hasAuthResponse: !!response.authResponse,
                  hasIdToken: !!response.authResponse?.id_token,
                  hasAccessToken: !!response.authResponse?.access_token,
                  hasRefreshToken: !!response.authResponse?.refresh_token,
                },
              });
              throw new Error('Invalid authentication response: missing token data');
            }

            // Use jwt-decode to safely decode the JWT token
            let profileData: ProfileModel;
            try {
              profileData = jwtDecode<ProfileModel>(response.authResponse.id_token);

              logger.info({
                message: 'Login: Successfully decoded JWT token',
                context: { userId: profileData.sub },
              });
            } catch (jwtError) {
              logger.error({
                message: 'Login: Failed to decode JWT token',
                context: { error: jwtError instanceof Error ? jwtError.message : String(jwtError) },
              });
              throw new Error('Failed to decode authentication token');
            }

            const now = new Date();
            const expiresOn = new Date(now.getTime() + response.authResponse.expires_in * 1000).getTime().toString();

            set({
              accessToken: response.authResponse.access_token,
              refreshToken: response.authResponse.refresh_token,
              refreshTokenExpiresOn: expiresOn,
              status: 'signedIn',
              error: null,
              profile: profileData,
              userId: profileData.sub,
            });

            // Cache a salted hash of the password for the personal lockscreen; a shared workstation never keeps one.
            if (isSharedInstallation()) {
              await clearPasswordVerificationHash();
            } else {
              await storePasswordVerificationHash(credentials.password);
            }

            logger.info({
              message: 'Login: State updated to signedIn',
              context: { userId: profileData.sub },
            });

            // Set up automatic token refresh
            scheduleTokenRefresh(response.authResponse.expires_in);
          } else if (response.mfaTransaction) {
            // The password was right; a second factor (or the setup the department requires) finishes the sign-in on the
            // login transaction. The secret goes to login-mfa memory; the store only holds what the screen shows. The
            // personal lockscreen's verifier waits in memory for the sign-in to finish.
            holdLoginTransaction(response.mfaTransaction.secret);
            pendingPasswordVerification = isSharedInstallation() ? null : await computePasswordVerification(credentials.password);
            set({ status: 'mfaRequired', error: null, mfaChallenge: response.mfaTransaction.challenge });
          } else if (response.enrollmentRequired) {
            set({ status: 'error', error: 'mfa_enrollment_required', mfaChallenge: null });
          } else if (response.mfaRequired) {
            // 2FA challenge: the login screen prompts for the authenticator code and calls
            // login() again with otpCode. Credentials are never retained here.
            logger.info({
              message: 'Login requires two-factor verification',
              context: { invalidOtp: !!response.invalidOtp },
            });
            set({
              status: 'mfaRequired',
              error: response.invalidOtp ? 'invalid_totp' : null,
              mfaChallenge: { kind: 'legacy', methods: ['totp'], enrolled: ['totp'], preferred: 'totp', expiresAt: null, source: 'password' },
            });
          } else {
            logger.error({
              message: 'Login: API returned unsuccessful response',
              context: { message: response.message },
            });
            set({
              status: 'error',
              error: response.message || 'Login failed',
            });
          }
        } catch (error) {
          logger.error({
            message: 'Login: Exception caught',
            context: { error: error instanceof Error ? error.message : String(error) },
          });
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'Login failed',
          });
        }
      },

      verifyLoginMfa: (step) => verifyLoginMfa(mfaHost, step),
      requestLoginApproval: () => startLoginApproval(mfaHost),
      waitForLoginApproval: (approvalRequestId, signal) => waitForLoginApproval(mfaHost, approvalRequestId, signal),
      cancelLoginApproval: (approvalRequestId) => cancelLoginApprovalRequest(approvalRequestId),
      loginSetupOptions: () => loginSetupOptions(mfaHost),
      cancelLoginMfa: () => {
        forgetLoginSecrets();
        pendingPasswordVerification = null;
        set({ status: 'signedOut', mfaChallenge: null, error: null });
      },
      loginWithBrokeredSso: async (department: SsoDepartment) => {
        pendingPasswordVerification = null;
        set({ status: 'loading', error: null, mfaChallenge: null });
        const result = await signInWithBrokeredSso(mfaHost, department);
        if (result.outcome === 'cancelled') {
          set({ status: 'signedOut' });
        } else if (result.outcome === 'failed') {
          set({ status: 'error', error: result.code });
        }
        return result;
      },
      dismissRecoveryCodes: () => set({ pendingRecoveryCodes: null }),
      beginFactorRecovery: (recoveryCode) => startFactorRecovery(mfaHost, recoveryCode),

      logout: async (reason?: string) => {
        logger.info({
          message: 'Logout: Clearing auth state',
        });

        // Cancel any pending automatic refresh so the timer cannot fire after logout
        cancelScheduledTokenRefresh();
        // Sign-in secrets and the shared session state must not outlive the session.
        forgetLoginSecrets();
        forgetPendingSsoExchange();
        pendingPasswordVerification = null;
        resetSharedSession();

        set({
          accessToken: null,
          refreshToken: null,
          refreshTokenExpiresOn: null,
          status: 'signedOut',
          // Why the session ended, when the screen should say (a shared shift that ran out); otherwise nothing.
          error: typeof reason === 'string' ? reason : null,
          profile: null,
          userId: null,
          isFirstTime: true,
          mfaChallenge: null,
          pendingRecoveryCodes: null,
        });

        // The server-supplied Mapbox token belongs to the session's department; the next config load re-applies one.
        try {
          clearMapboxToken();
        } catch (error) {
          logger.warn({
            message: 'Failed to clear the server Mapbox token on logout',
            context: { error: error instanceof Error ? error.message : String(error) },
          });
        }

        // End the session synchronously so API requests and routing cannot keep using
        // rejected credentials while storage cleanup is pending or unavailable.
        try {
          await clearPasswordVerificationHash();
        } catch (error) {
          logger.warn({
            message: 'Failed to clear password verification hash on logout',
            context: { error: error instanceof Error ? error.message : String(error) },
          });
        }
      },

      refreshAccessToken: async () => {
        // Single-flight refresh shared with the axios 401 interceptor. Failure
        // handling (logout) happens inside performTokenRefresh.
        await performTokenRefresh();
      },
      isAuthenticated: (): boolean => {
        return get().status === 'signedIn' && get().accessToken !== null;
      },
      setIsOnboarding: () => {
        logger.info({
          message: 'Setting isOnboarding to true',
        });

        set({
          status: 'onboarding',
        });
      },
      loginWithSso: async (authResponse: AuthResponse) => {
        try {
          set({ status: 'loading', error: null });

          // SSO logins have no password - drop any cached password verification hash
          await clearPasswordVerificationHash();

          const tokenToDecode = authResponse.id_token || authResponse.access_token;
          let profileData: ProfileModel;

          try {
            profileData = jwtDecode<ProfileModel>(tokenToDecode);
            logger.info({
              message: 'SSO: Successfully decoded JWT token',
              context: { userId: profileData.sub },
            });
          } catch (jwtError) {
            logger.error({
              message: 'SSO: Failed to decode JWT token',
              context: { error: jwtError instanceof Error ? jwtError.message : String(jwtError) },
            });
            throw new Error('Failed to decode SSO authentication token');
          }

          const now = new Date();
          const expiresOn = new Date(now.getTime() + authResponse.expires_in * 1000).getTime().toString();

          set({
            accessToken: authResponse.access_token,
            refreshToken: authResponse.refresh_token,
            refreshTokenExpiresOn: expiresOn,
            status: 'signedIn',
            error: null,
            profile: profileData,
            userId: profileData.sub,
          });

          logger.info({
            message: 'SSO: State updated to signedIn',
            context: { userId: profileData.sub },
          });

          // Set up automatic token refresh
          scheduleTokenRefresh(authResponse.expires_in);
        } catch (error) {
          logger.error({
            message: 'SSO: loginWithSso exception',
            context: { error: error instanceof Error ? error.message : String(error) },
          });
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'SSO login failed',
          });
          throw error;
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => mmkvStorage),
      // Only persist essential auth data
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        refreshTokenExpiresOn: state.refreshTokenExpiresOn,
        profile: state.profile,
        userId: state.userId,
        // A pending second factor dies with the process (its secret lives in memory only), so it restarts signed out.
        status: state.status === 'mfaRequired' ? 'signedOut' : state.status,
        isFirstTime: state.isFirstTime,
      }),
    }
  )
);

// Wire the shared refresh engine to this store. Kept outside the store creator so the
// axios interceptor and the auth store share one single-flight refresh path.
initTokenRefresh({
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  applyAuthResponse: (response: AuthResponse) => {
    // A refresh that raced sign-out must not resurrect the session: logout already
    // cleared the store, so reject instead of applying. Throwing makes
    // performTokenRefresh treat this as a failed refresh, which also stops it from
    // rescheduling the refresh timer for the ended session.
    if (useAuthStore.getState().status === 'signedOut') {
      throw new Error('Token refresh completed after sign-out; discarding tokens');
    }
    useAuthStore.setState({
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      refreshTokenExpiresOn: String(Date.now() + response.expires_in * 1000),
      status: 'signedIn',
      error: null,
    });
  },
  // A locked shared session: the lock screen unlocks the same session and the refresh runs again afterwards.
  onSharedSessionLocked: () => markSharedSessionLocked(null),
  onRefreshFailed: () => {
    // Avoid a logout re-entry loop if the failure was triggered by a timer that
    // fired after the user already signed out.
    if (useAuthStore.getState().status !== 'signedOut') {
      void useAuthStore.getState().logout();
    }
  },
});

// Persist restores the credentials, but timers do not survive a reload. Register
// after initTokenRefresh, including the synchronous MMKV hydration that already ran.
const resumeTokenRefresh = (state: AuthState): void => {
  if (state.status !== 'signedIn' || !state.refreshToken) {
    cancelScheduledTokenRefresh();
    return;
  }
  // A shared workstation session restored at launch locks before anyone can use it (passkey plan section 12.5.3): on a
  // shared installation the screen is concealed from the first frame, before the server is even asked.
  noteSessionRestoredAtLaunch();
  if (isSharedInstallation()) {
    markSharedSessionLocked(null);
  }
  const expiresOn = Number(state.refreshTokenExpiresOn);
  const remainingSeconds = Number.isFinite(expiresOn) ? Math.max(0, (expiresOn - Date.now()) / 1000) : 0;
  scheduleTokenRefresh(remainingSeconds);
};

useAuthStore.persist.onFinishHydration(resumeTokenRefresh);
if (useAuthStore.persist.hasHydrated()) {
  resumeTokenRefresh(useAuthStore.getState());
}

// Keep the API cache scoped to whoever is signed in. Cache keys embed this identity, so stamping it
// here means a second user on the same device can never be served the first user's cached rosters,
// units or contacts -- and signing out drops the scope so nothing leaks into an anonymous session.
useAuthStore.subscribe((state, previousState) => {
  if (state.userId === previousState.userId) {
    return;
  }

  try {
    // Drop everything the previous identity cached before the new scope goes live, so nothing from
    // the old account can be read back even if a key were to collide.
    cacheManager.clear();
  } catch (error) {
    // Cache hygiene must never be able to break sign-in or sign-out. Stale entries expire on their
    // own, and the scope moved on below, so they are no longer addressable by the new identity.
    logger.warn({
      message: 'Failed to clear the API cache on identity change',
      context: { error },
    });
  }

  // Deliberately outside the clear() attempt: leaving the scope on the previous user is the one
  // failure that actually leaks, since cache keys embed it and the entries we just failed to drop
  // are still there. The new identity has to take over the scope whether or not the clear worked.
  try {
    if (state.userId) {
      setCacheScope({ userId: state.userId });
    } else {
      clearCacheScope();
    }
  } catch (error) {
    logger.warn({
      message: 'Failed to reset the API cache scope on identity change',
      context: { error },
    });
  }
});

export default useAuthStore;
