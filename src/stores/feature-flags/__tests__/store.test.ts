import { renderHook } from '@testing-library/react-native';

import { FeatureFlagKeys, featureFlagsStore, useChatSystemStatus } from '../store';

// Mock the API
jest.mock('@/api/feature-flags/feature-flags', () => ({
  getAllFeatureFlags: jest.fn(),
}));

// Mock logging
jest.mock('@/lib/logging', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock the storage
jest.mock('@/lib/storage', () => ({
  zustandStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

// Mock identity sources
jest.mock('../../auth/store', () => ({
  __esModule: true,
  default: {
    getState: jest.fn(),
  },
}));

jest.mock('../../security/store', () => ({
  securityStore: {
    getState: jest.fn(),
  },
}));

const { getAllFeatureFlags } = require('@/api/feature-flags/feature-flags');
const useAuthStore = require('../../auth/store').default;
const { securityStore } = require('../../security/store');

const setIdentity = (userId: string | null, departmentId: string | null) => {
  useAuthStore.getState.mockReturnValue({ userId });
  securityStore.getState.mockReturnValue({
    rights: departmentId ? { DepartmentId: departmentId } : null,
  });
};

describe('Feature Flags Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    featureFlagsStore.setState({
      flags: {},
      isLoaded: false,
      error: null,
      identityKey: null,
    });
    setIdentity('user-1', 'dept-1');
  });

  describe('fetchFlags', () => {
    it('should store flags and stamp the current identity on success', async () => {
      getAllFeatureFlags.mockResolvedValue({
        Data: [{ Key: FeatureFlagKeys.ChatSystem, Enabled: true, Value: null }],
      });

      await featureFlagsStore.getState().fetchFlags();

      const state = featureFlagsStore.getState();
      expect(state.flags[FeatureFlagKeys.ChatSystem]).toEqual({ enabled: true, value: null });
      expect(state.isLoaded).toBe(true);
      expect(state.error).toBeNull();
      expect(state.identityKey).toBe('user-1:dept-1');
    });

    it('should keep persisted flags on failure for the same identity', async () => {
      featureFlagsStore.setState({
        flags: { [FeatureFlagKeys.ChatSystem]: { enabled: true, value: null } },
        isLoaded: true,
        identityKey: 'user-1:dept-1',
      });
      getAllFeatureFlags.mockRejectedValue(new Error('network down'));

      await featureFlagsStore.getState().fetchFlags();

      const state = featureFlagsStore.getState();
      expect(state.flags[FeatureFlagKeys.ChatSystem]?.enabled).toBe(true);
      expect(state.identityKey).toBe('user-1:dept-1');
      expect(state.error).toBe('network down');
    });

    it('should clear flags from a different department before fetching so a failed fetch cannot reuse them', async () => {
      featureFlagsStore.setState({
        flags: { [FeatureFlagKeys.ChatSystem]: { enabled: true, value: null } },
        isLoaded: true,
        identityKey: 'user-1:dept-old',
      });
      getAllFeatureFlags.mockRejectedValue(new Error('network down'));

      await featureFlagsStore.getState().fetchFlags();

      const state = featureFlagsStore.getState();
      expect(state.flags).toEqual({});
      // Fail-closed: the failed fetch still resolves the flags so consumers stop waiting.
      expect(state.isLoaded).toBe(true);
      expect(state.identityKey).toBeNull();
    });

    it('should clear flags from a different account before fetching', async () => {
      featureFlagsStore.setState({
        flags: { [FeatureFlagKeys.ChatSystem]: { enabled: true, value: null } },
        isLoaded: true,
        identityKey: 'user-other:dept-1',
      });
      getAllFeatureFlags.mockRejectedValue(new Error('network down'));

      await featureFlagsStore.getState().fetchFlags();

      expect(featureFlagsStore.getState().flags).toEqual({});
    });

    it('should replace another identity flags with fresh ones on success', async () => {
      featureFlagsStore.setState({
        flags: { [FeatureFlagKeys.ChatSystem]: { enabled: true, value: null } },
        isLoaded: true,
        identityKey: 'user-other:dept-other',
      });
      getAllFeatureFlags.mockResolvedValue({
        Data: [{ Key: FeatureFlagKeys.ChatSystem, Enabled: false, Value: null }],
      });

      await featureFlagsStore.getState().fetchFlags();

      const state = featureFlagsStore.getState();
      expect(state.flags[FeatureFlagKeys.ChatSystem]?.enabled).toBe(false);
      expect(state.identityKey).toBe('user-1:dept-1');
    });

    it('should keep flags on failure when department is unknown but the user matches', async () => {
      setIdentity('user-1', null);
      featureFlagsStore.setState({
        flags: { [FeatureFlagKeys.ChatSystem]: { enabled: true, value: null } },
        isLoaded: true,
        identityKey: 'user-1:dept-1',
      });
      getAllFeatureFlags.mockRejectedValue(new Error('network down'));

      await featureFlagsStore.getState().fetchFlags();

      const state = featureFlagsStore.getState();
      expect(state.flags[FeatureFlagKeys.ChatSystem]?.enabled).toBe(true);
      expect(state.identityKey).toBe('user-1:dept-1');
    });

    it('should clear flags when department is unknown and the user differs', async () => {
      setIdentity('user-2', null);
      featureFlagsStore.setState({
        flags: { [FeatureFlagKeys.ChatSystem]: { enabled: true, value: null } },
        isLoaded: true,
        identityKey: 'user-1:dept-1',
      });
      getAllFeatureFlags.mockRejectedValue(new Error('network down'));

      await featureFlagsStore.getState().fetchFlags();

      expect(featureFlagsStore.getState().flags).toEqual({});
    });
  });

  describe('useChatSystemStatus', () => {
    it('should be unknown before the initial fetch resolves', () => {
      const { result } = renderHook(() => useChatSystemStatus());

      expect(result.current).toBe('unknown');
    });

    it('should report enabled and disabled from the flag entry', () => {
      featureFlagsStore.setState({
        flags: { [FeatureFlagKeys.ChatSystem]: { enabled: true, value: null } },
      });
      const { result: enabled } = renderHook(() => useChatSystemStatus());
      expect(enabled.current).toBe('enabled');

      featureFlagsStore.setState({
        flags: { [FeatureFlagKeys.ChatSystem]: { enabled: false, value: null } },
      });
      const { result: disabled } = renderHook(() => useChatSystemStatus());
      expect(disabled.current).toBe('disabled');
    });

    it('should resolve disabled when flags loaded without an entry', () => {
      featureFlagsStore.setState({ flags: {}, isLoaded: true });

      const { result } = renderHook(() => useChatSystemStatus());

      expect(result.current).toBe('disabled');
    });

    it('should resolve disabled (fail-closed) after a failed fetch with no persisted flags', async () => {
      getAllFeatureFlags.mockRejectedValue(new Error('network down'));

      await featureFlagsStore.getState().fetchFlags();

      const { result } = renderHook(() => useChatSystemStatus());
      expect(result.current).toBe('disabled');
    });
  });

  describe('isEnabled', () => {
    it('should return the flag state when present and the default when missing', () => {
      featureFlagsStore.setState({
        flags: { [FeatureFlagKeys.ChatSystem]: { enabled: true, value: null } },
      });

      expect(featureFlagsStore.getState().isEnabled(FeatureFlagKeys.ChatSystem)).toBe(true);
      expect(featureFlagsStore.getState().isEnabled('Unknown.Flag')).toBe(false);
      expect(featureFlagsStore.getState().isEnabled('Unknown.Flag', true)).toBe(true);
    });
  });
});
