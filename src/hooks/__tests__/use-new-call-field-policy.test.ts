import { renderHook, waitFor } from '@testing-library/react-native';

import { getNewCallFieldPolicy } from '@/api/calls/newCallFieldPolicy';
import { useNewCallFieldPolicy } from '@/hooks/use-new-call-field-policy';
import { NewCallFieldKeys } from '@/models/v4/calls/newCallFieldPolicyResultData';

jest.mock('@/api/calls/newCallFieldPolicy', () => ({
  getNewCallFieldPolicy: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const mockedGetPolicy = getNewCallFieldPolicy as jest.Mock;

const renderPolicy = async (rules: { Key: string; Visible: boolean; Required: boolean }[]) => {
  mockedGetPolicy.mockResolvedValue({ Rules: rules });

  const { result } = renderHook(() => useNewCallFieldPolicy());
  await waitFor(() => expect(result.current.isLoaded).toBe(true));

  return result;
};

describe('useNewCallFieldPolicy', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows everything and requires nothing for an unconfigured department', async () => {
    const result = await renderPolicy([]);

    expect(result.current.isVisible(NewCallFieldKeys.ContactInfo)).toBe(true);
    expect(result.current.isRequired(NewCallFieldKeys.ContactInfo)).toBe(false);
    expect(result.current.missingRequired({})).toEqual([]);
  });

  it('hides fields the department turned off', async () => {
    const result = await renderPolicy([{ Key: NewCallFieldKeys.IncidentId, Visible: false, Required: false }]);

    expect(result.current.isVisible(NewCallFieldKeys.IncidentId)).toBe(false);
    // Untouched fields keep the default.
    expect(result.current.isVisible(NewCallFieldKeys.Address)).toBe(true);
  });

  it('reports required fields that are blank', async () => {
    const result = await renderPolicy([
      { Key: NewCallFieldKeys.Address, Visible: true, Required: true },
      { Key: NewCallFieldKeys.ContactInfo, Visible: true, Required: true },
    ]);

    expect(result.current.missingRequired({ [NewCallFieldKeys.Address]: 'Nieuwstraat 14' })).toEqual([NewCallFieldKeys.ContactInfo]);
  });

  it('treats whitespace and empty collections as missing', async () => {
    const result = await renderPolicy([
      { Key: NewCallFieldKeys.Note, Visible: true, Required: true },
      { Key: NewCallFieldKeys.Protocols, Visible: true, Required: true },
    ]);

    const missing = result.current.missingRequired({
      [NewCallFieldKeys.Note]: '   ',
      [NewCallFieldKeys.Protocols]: [],
    });

    expect(missing).toEqual([NewCallFieldKeys.Note, NewCallFieldKeys.Protocols]);
  });

  it('never requires a hidden field', async () => {
    // Requiring something nobody can fill in would make call creation impossible; the server takes
    // the same stance, so the two cannot disagree.
    const result = await renderPolicy([{ Key: NewCallFieldKeys.Address, Visible: false, Required: true }]);

    expect(result.current.isRequired(NewCallFieldKeys.Address)).toBe(false);
    expect(result.current.missingRequired({})).toEqual([]);
  });

  it('falls open when the policy cannot be loaded', async () => {
    // Hiding fields a dispatcher needs is far worse than showing one they were told to hide, and the
    // server enforces the real policy on save regardless.
    mockedGetPolicy.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useNewCallFieldPolicy());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(result.current.isVisible(NewCallFieldKeys.ContactInfo)).toBe(true);
    expect(result.current.missingRequired({})).toEqual([]);
  });
});
