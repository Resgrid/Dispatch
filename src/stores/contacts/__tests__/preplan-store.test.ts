import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { getContactFiles } from '@/api/contacts/contactFiles';
import { getContactPreplan } from '@/api/contacts/contactPreplans';

import { useContactPreplanStore } from '../preplan-store';

jest.mock('@/api/contacts/contactFiles', () => ({ getContactFiles: jest.fn() }));
jest.mock('@/api/contacts/contactPreplans', () => ({ getContactPreplan: jest.fn() }));
jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockGetContactPreplan = getContactPreplan as jest.MockedFunction<typeof getContactPreplan>;
const mockGetContactFiles = getContactFiles as jest.MockedFunction<typeof getContactFiles>;

describe('useContactPreplanStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useContactPreplanStore.getState().reset();
  });

  it('keeps a failed pre-plan read apart from "the contact has none"', async () => {
    // Writing nothing on failure would let the panel show the "no pre-plan" empty state for a
    // contact whose plan exists but could not be reached.
    mockGetContactPreplan.mockRejectedValue(new Error('offline'));

    await useContactPreplanStore.getState().fetchPreplan('c1');

    const state = useContactPreplanStore.getState();
    expect(Object.prototype.hasOwnProperty.call(state.preplans, 'c1')).toBe(false);
    expect(state.preplanErrors.c1).toBe('offline');
    expect(state.loadingPreplan.c1).toBe(false);
  });

  it('clears the pre-plan failure once a fetch gets through', async () => {
    mockGetContactPreplan.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ Data: null } as never);

    await useContactPreplanStore.getState().fetchPreplan('c1');
    await useContactPreplanStore.getState().fetchPreplan('c1', true);

    const state = useContactPreplanStore.getState();
    expect(state.preplanErrors.c1).toBeUndefined();
    expect(state.preplans.c1).toBeNull();
  });

  it('records a files failure per contact and clears it on success', async () => {
    mockGetContactFiles.mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce({ Data: [] } as never);

    await useContactPreplanStore.getState().fetchFiles('c1');
    expect(useContactPreplanStore.getState().fileErrors.c1).toBe('503');
    expect(Object.prototype.hasOwnProperty.call(useContactPreplanStore.getState().files, 'c1')).toBe(false);

    await useContactPreplanStore.getState().fetchFiles('c1', true);
    expect(useContactPreplanStore.getState().fileErrors.c1).toBeUndefined();
    expect(useContactPreplanStore.getState().files.c1).toEqual([]);
  });

  it('does not let one contact’s failure touch another’s state', async () => {
    mockGetContactPreplan.mockResolvedValueOnce({ Data: null } as never).mockRejectedValueOnce(new Error('offline'));

    await useContactPreplanStore.getState().fetchPreplan('c1');
    await useContactPreplanStore.getState().fetchPreplan('c2');

    const state = useContactPreplanStore.getState();
    expect(state.preplans.c1).toBeNull();
    expect(state.preplanErrors.c1).toBeUndefined();
    expect(state.preplanErrors.c2).toBe('offline');
  });

  it('invalidate drops the cached entries and the failures for a contact', async () => {
    mockGetContactPreplan.mockRejectedValue(new Error('offline'));
    mockGetContactFiles.mockResolvedValue({ Data: [] } as never);

    await useContactPreplanStore.getState().fetchPreplan('c1');
    await useContactPreplanStore.getState().fetchFiles('c1');
    useContactPreplanStore.getState().invalidate('c1');

    const state = useContactPreplanStore.getState();
    expect(state.preplanErrors.c1).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(state.files, 'c1')).toBe(false);
  });
});
