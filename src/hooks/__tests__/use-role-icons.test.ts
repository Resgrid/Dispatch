import { renderHook, waitFor } from '@testing-library/react-native';

import { getRecipients } from '@/api/messaging/messages';

import { useRoleIcons } from '../use-role-icons';

jest.mock('@/api/messaging/messages', () => ({ getRecipients: jest.fn() }));
jest.mock('@/lib/logging', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() } }));

const ROLE_ICON_URL = 'https://api.resgrid.dev/api/v4/TypeIcons/0123456789abcdef0123456789abcdef';

describe('useRoleIcons', () => {
  it('maps each role with an uploaded icon by its lowercase name, from the same recipients call the dispatch store makes', async () => {
    (getRecipients as jest.Mock).mockResolvedValue({
      Data: [
        { Id: 'R:7', Type: 'Roles', Name: 'Paramedic ', TypeIconUrl: ROLE_ICON_URL },
        { Id: 'R:8', Type: 'Roles', Name: 'Driver', TypeIconUrl: null },
        { Id: 'U:1', Type: 'Unit', Name: 'Medic 1', TypeIconUrl: 'https://api.resgrid.dev/api/v4/TypeIcons/unit' },
      ],
    });

    const { result } = renderHook(() => useRoleIcons());

    await waitFor(() => expect(result.current.size).toBe(1));
    expect(result.current.get('paramedic')).toBe(ROLE_ICON_URL);
    expect(result.current.has('driver')).toBe(false);
    expect(result.current.has('medic 1')).toBe(false);
    expect(getRecipients).toHaveBeenCalledWith(true, false);
  });

  it('stays empty when the recipients call fails', async () => {
    (getRecipients as jest.Mock).mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useRoleIcons());

    await waitFor(() => expect(getRecipients).toHaveBeenCalled());
    expect(result.current.size).toBe(0);
  });
});
