import { renderHook } from '@testing-library/react-native';

import { definitionTermKey, getTerm, recordTypeTermKey, terminologyStore, TermKeys, useDefinitionTerm, useRecordTypeTerm, useTerm } from '../store';

jest.mock('@/api/config/terminology', () => ({
  getTerminology: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../lib/storage', () => ({
  zustandStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

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

const { getTerminology } = require('@/api/config/terminology');
const useAuthStore = require('../../auth/store').default;
const { securityStore } = require('../../security/store');

const setIdentity = (userId: string | null, departmentId: string | null) => {
  useAuthStore.getState.mockReturnValue({ userId });
  securityStore.getState.mockReturnValue({
    rights: departmentId ? { DepartmentId: departmentId } : null,
  });
};

describe('Terminology store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    terminologyStore.setState({ names: {}, isLoaded: false, error: null, identityKey: null });
    setIdentity('user-1', 'dept-1');
  });

  it('keeps only the terms the department renamed', async () => {
    getTerminology.mockResolvedValue({
      Data: [
        { Key: 'record-type.run', Category: 'RecordType', DefaultName: 'Run', Name: 'Incident' },
        { Key: TermKeys.Units, Category: 'Module', DefaultName: 'Units', Name: ' Apparatus ' },
        { Key: TermKeys.Calls, Category: 'Module', DefaultName: 'Calls', Name: null },
        { Key: TermKeys.Notes, Category: 'Module', DefaultName: 'Notes', Name: '   ' },
      ],
    });

    await terminologyStore.getState().fetchTerminology();

    const state = terminologyStore.getState();
    expect(state.names).toEqual({ 'record-type.run': 'Incident', [TermKeys.Units]: 'Apparatus' });
    expect(state.isLoaded).toBe(true);
    expect(state.identityKey).toBe('user-1:dept-1');
  });

  it('keeps the persisted names when the server cannot be reached', async () => {
    terminologyStore.setState({ names: { [TermKeys.Records]: 'Reports' }, identityKey: 'user-1:dept-1' });
    getTerminology.mockRejectedValue(new Error('offline'));

    await terminologyStore.getState().fetchTerminology();

    expect(terminologyStore.getState().names).toEqual({ [TermKeys.Records]: 'Reports' });
    expect(terminologyStore.getState().error).toBe('offline');
  });

  it("drops another department's names before fetching", async () => {
    terminologyStore.setState({ names: { [TermKeys.Records]: 'Reports' }, identityKey: 'user-1:dept-9' });
    getTerminology.mockRejectedValue(new Error('offline'));

    await terminologyStore.getState().fetchTerminology();

    expect(terminologyStore.getState().names).toEqual({});
  });

  it('maps record type numbers and built-in definition keys to term keys', () => {
    expect(recordTypeTermKey(1)).toBe('record-type.run');
    expect(recordTypeTermKey(8)).toBe('record-type.unit-activity');
    expect(recordTypeTermKey(3)).toBeNull();
    expect(recordTypeTermKey(null)).toBeNull();
    expect(definitionTermKey('system.work')).toBe('record-type.work');
    expect(definitionTermKey('system.neris-incident')).toBe('record-type.neris-incident');
    expect(definitionTermKey('dept.public-education')).toBeNull();
    expect(definitionTermKey(undefined)).toBeNull();
  });

  it('falls back to the app name for anything not renamed', () => {
    terminologyStore.setState({ names: { 'record-type.work': 'Shift On Duty', [TermKeys.Contacts]: 'Preplans' } });

    expect(renderHook(() => useTerm(TermKeys.Contacts, 'Contacts')).result.current).toBe('Preplans');
    expect(renderHook(() => useTerm(TermKeys.Calls, 'Calls')).result.current).toBe('Calls');
    expect(renderHook(() => useRecordTypeTerm(4, 'Work')).result.current).toBe('Shift On Duty');
    expect(renderHook(() => useDefinitionTerm('system.work', 'Work')).result.current).toBe('Shift On Duty');
    expect(renderHook(() => useDefinitionTerm('dept.public-education', 'Public Education')).result.current).toBe('Public Education');
    expect(getTerm(TermKeys.Contacts, 'Contacts')).toBe('Preplans');
    expect(getTerm(null, 'Contacts')).toBe('Contacts');
  });
});
