import { act, renderHook } from '@testing-library/react-native';

import { type DepartmentRightsResultData } from '@/models/v4/security/departmentRightsResultData';

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  init: jest.fn(),
  withScope: jest.fn((callback) => callback({ setExtra: jest.fn() })),
}));

// Mock logging
jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock the API
jest.mock('@/api/security/security', () => ({
  getCurrentUsersRights: jest.fn(),
}));

// Mock storage
jest.mock('@/lib/storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  zustandStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

// Mock MMKV
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn(),
    getBoolean: jest.fn(),
    getNumber: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

// Import after mocks
import { securityStore, useSecurityStore } from '../store';
import { getCurrentUsersRights } from '@/api/security/security';

const mockGetCurrentUsersRights = getCurrentUsersRights as jest.MockedFunction<typeof getCurrentUsersRights>;


describe('useSecurityStore', () => {
  const mockRightsData: DepartmentRightsResultData = {
    DepartmentName: 'Test Department',
    DepartmentCode: 'TEST',
    FullName: 'Test User',
    EmailAddress: 'test@example.com',
    DepartmentId: 'dept-123',
    IsAdmin: true,
    CanViewPII: true,
    CanCreateCalls: true,
    CanAddNote: true,
    CanCreateMessage: true,
        CanLoginToDispatchApp: true,
        CanLoginToCommandApp: true,
    Groups: [
      {
        GroupId: 1,
        IsGroupAdmin: true,
      },
      {
        GroupId: 2,
        IsGroupAdmin: false,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the store before each test
    act(() => {
      securityStore.setState({
        error: null,
        rights: null,
      });
    });
  });

  describe('getRights', () => {
    it('successfully fetches and stores user rights', async () => {
      const mockApiResponse = {
        Data: mockRightsData,
        PageSize: 0,
        Timestamp: '',
        Version: '',
        Node: '',
        RequestId: '',
        Status: '',
        Environment: '',
      };

      mockGetCurrentUsersRights.mockResolvedValue(mockApiResponse);

      const { result } = renderHook(() => useSecurityStore());

      await act(async () => {
        await result.current.getRights();
      });

      expect(mockGetCurrentUsersRights).toHaveBeenCalledTimes(1);
      
      // Check that the store was updated
      const storeState = securityStore.getState();
      expect(storeState.rights).toEqual(mockRightsData);
    });

    it('handles API errors gracefully', async () => {
      const mockError = new Error('API Error');
      mockGetCurrentUsersRights.mockRejectedValue(mockError);

      const { result } = renderHook(() => useSecurityStore());

      await act(async () => {
        await result.current.getRights();
      });

      expect(mockGetCurrentUsersRights).toHaveBeenCalledTimes(1);
      
      // Store should not be updated on error
      const storeState = securityStore.getState();
      expect(storeState.rights).toBeNull();
    });
  });

  describe('permission checks', () => {
    beforeEach(() => {
      // Set up the store with mock data
      act(() => {
        securityStore.setState({
          rights: mockRightsData,
          error: null,
        });
      });
    });

    it('returns correct department admin status', () => {
      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.isUserDepartmentAdmin).toBe(true);
    });

    it('returns correct create calls permission', () => {
      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.canUserCreateCalls).toBe(true);
    });

    it('returns correct create notes permission', () => {
      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.canUserCreateNotes).toBe(true);
    });

    it('returns correct create messages permission', () => {
      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.canUserCreateMessages).toBe(true);
    });

    it('returns correct view PII permission', () => {
      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.canUserViewPII).toBe(true);
    });

    it('returns correct department code', () => {
      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.departmentCode).toBe('TEST');
    });

    it('correctly identifies group admin status', () => {
      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.isUserGroupAdmin(1)).toBe(true);
      expect(result.current.isUserGroupAdmin(2)).toBe(false);
      expect(result.current.isUserGroupAdmin(999)).toBe(false);
    });
  });

  describe('when no rights data is available', () => {
    beforeEach(() => {
      act(() => {
        securityStore.setState({
          rights: null,
          error: null,
        });
      });
    });

    it('returns undefined for all permission checks', () => {
      const { result } = renderHook(() => useSecurityStore());
      
      expect(result.current.isUserDepartmentAdmin).toBeUndefined();
      expect(result.current.canUserCreateCalls).toBeUndefined();
      expect(result.current.canUserCreateNotes).toBeUndefined();
      expect(result.current.canUserCreateMessages).toBeUndefined();
      expect(result.current.canUserViewPII).toBeUndefined();
      expect(result.current.departmentCode).toBeUndefined();
    });

    it('returns false for group admin checks', () => {
      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.isUserGroupAdmin(1)).toBe(false);
      expect(result.current.isUserGroupAdmin(999)).toBe(false);
    });
  });

  describe('edge cases for canUserCreateCalls', () => {
    it('handles false permission correctly', () => {
      const restrictedRights: DepartmentRightsResultData = {
        ...mockRightsData,
        CanCreateCalls: false,
      };

      act(() => {
        securityStore.setState({
          rights: restrictedRights,
          error: null,
        });
      });

      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.canUserCreateCalls).toBe(false);
    });

    it('handles null rights gracefully for canUserCreateCalls', () => {
      act(() => {
        securityStore.setState({
          rights: null,
          error: null,
        });
      });

      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.canUserCreateCalls).toBeUndefined();
    });

    it('handles empty groups array', () => {
      const rightsWithNoGroups: DepartmentRightsResultData = {
        ...mockRightsData,
        Groups: [],
      };

      act(() => {
        securityStore.setState({
          rights: rightsWithNoGroups,
          error: null,
        });
      });

      const { result } = renderHook(() => useSecurityStore());
      expect(result.current.isUserGroupAdmin(1)).toBe(false);
    });
  });
});
