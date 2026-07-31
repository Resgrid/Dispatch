import { jwtDecode } from 'jwt-decode';
import { Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { logger } from '@/lib/logging';

import { clearPasswordVerificationHash, loginRequest, refreshTokenRequest, storePasswordVerificationHash } from '../../lib/auth/api';
import type { AuthResponse, AuthState, LoginCredentials } from '../../lib/auth/types';
import { type ProfileModel } from '../../lib/auth/types';

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
      login: async (credentials: LoginCredentials) => {
        try {
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

            // Cache a salted hash of the password for lockscreen verification
            await storePasswordVerificationHash(credentials.password);

            logger.info({
              message: 'Login: State updated to signedIn',
              context: { userId: profileData.sub },
            });

            // Set up automatic token refresh
            //const decodedToken: { exp: number } = jwtDecode(
            //);
            //const now = new Date();
            //const expiresIn =
            //  response.authResponse?.expires_in! * 1000 - Date.now() - 60000; // Refresh 1 minute before expiry
            //const expiresOn = new Date(
            //  now.getTime() + response.authResponse?.expires_in! * 1000
            //)
            //  .getTime()
            //  .toString();

            //setTimeout(() => get().refreshAccessToken(), expiresIn);
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

      logout: async () => {
        logger.info({
          message: 'Logout: Clearing auth state',
        });

        await clearPasswordVerificationHash();

        set({
          accessToken: null,
          refreshToken: null,
          refreshTokenExpiresOn: null,
          status: 'signedOut',
          error: null,
          profile: null,
          userId: null,
          isFirstTime: true,
        });
      },

      refreshAccessToken: async () => {
        try {
          const { refreshToken } = get();
          if (!refreshToken) {
            throw new Error('No refresh token available');
          }

          const response = await refreshTokenRequest(refreshToken);

          set({
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            status: 'signedIn',
            error: null,
          });

          // Set up next token refresh
          //const decodedToken: { exp: number } = jwt_decode(
          //  response.access_token
          //);
          const expiresIn = response.expires_in * 1000 - Date.now() - 60000; // Refresh 1 minute before expiry
          setTimeout(() => get().refreshAccessToken(), expiresIn);
        } catch (error) {
          // If refresh fails, log out the user
          get().logout();
        }
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
        status: state.status,
        isFirstTime: state.isFirstTime,
      }),
    }
  )
);

export default useAuthStore;
