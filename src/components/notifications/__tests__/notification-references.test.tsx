/**
 * The real inbox and detail with their data sources mocked (the sibling NotificationInbox.test mocks
 * the inbox itself). Covers the Novu v2 -> v3 field fix (the inbox read `title`/`read`/`payload`, so rows
 * had no title, all looked read and never carried a reference), the inbox opening for a dispatcher who
 * has no active unit, and call/chat links derived from the push event code the Novu bridge puts in `data`.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@novu/react-native', () => ({ useNotifications: jest.fn() }));
jest.mock('@/stores/app/core-store', () => ({ useCoreStore: jest.fn() }));
jest.mock('@/stores/toast/store', () => ({ useToastStore: jest.fn() }));
jest.mock('@/lib/auth', () => ({ useAuthStore: jest.fn() }));
jest.mock('@/api/novu/inbox', () => ({ deleteMessage: jest.fn().mockResolvedValue(undefined) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({ 'notifications.view_call': 'View Call', 'notifications.view_chat': 'View Chat', 'notifications.open_reference': 'Open', 'notifications.detail_title': 'Notification' })[key] ?? key,
  }),
}));

import { useNotifications } from '@novu/react-native';

import { useAuthStore } from '@/lib/auth';
import { useCoreStore } from '@/stores/app/core-store';
import { useToastStore } from '@/stores/toast/store';

import { NotificationDetail } from '../NotificationDetail';
import { mapNovuNotification, NotificationInbox } from '../NotificationInbox';

type NovuItem = Parameters<typeof mapNovuNotification>[0];
// `read` is a method on a real @novu/js v3 Notification; the old mapping read it as the flag.
const item = (data: Record<string, unknown> | undefined, id = 'n-1', isRead = false) =>
  ({ id, subject: 'Structure Fire', body: 'Engine 6 respond', createdAt: '2026-09-22T10:00:00Z', isRead, read: () => undefined, data }) as unknown as NovuItem;

const withItems = (items: NovuItem[]) => (useNotifications as jest.Mock).mockReturnValue({ notifications: items, isLoading: false, fetchMore: jest.fn(), hasMore: false, refetch: jest.fn() });

beforeEach(() => {
  jest.clearAllMocks();
  // A dispatcher: signed in, no active unit.
  (useCoreStore as unknown as jest.Mock).mockImplementation((selector: (state: unknown) => unknown) =>
    selector({ activeUnitId: null, config: { NovuApplicationId: 'app', NovuBackendApiUrl: 'api', NovuSocketUrl: 'socket' } })
  );
  (useAuthStore as unknown as jest.Mock).mockImplementation((selector: (state: unknown) => unknown) => selector({ userId: 'dispatcher-1' }));
  (useToastStore as unknown as jest.Mock).mockImplementation((selector: (state: unknown) => unknown) => selector({ showToast: jest.fn() }));
});

describe('mapNovuNotification', () => {
  it('reads the v3 fields and derives call and chat links from the event code', () => {
    expect(mapNovuNotification(item({ eventCode: 'C1234' }))).toEqual(expect.objectContaining({ title: 'Structure Fire', read: false, referenceType: 'call', referenceId: '1234', metadata: {} }));
    expect(mapNovuNotification(item({ eventCode: 'g:7f1c' }, 'n-2', true))).toEqual(expect.objectContaining({ read: true, referenceType: 'chat', referenceId: '7f1c' }));
    // Work orders open only in the Responder app.
    expect(mapNovuNotification(item({ eventCode: 'NWO:0b7c3e52-2f4a-4d0e-9a57-1f7a0c9d6e11' })).referenceType).toBeUndefined();
  });
});

describe('NotificationInbox', () => {
  it('opens for a signed-in dispatcher without an active unit', () => {
    withItems([item({ eventCode: '' }, 'plain-1')]);

    render(<NotificationInbox isOpen onClose={jest.fn()} />);

    expect(screen.getByText('Engine 6 respond')).toBeTruthy();
    expect(screen.queryByTestId('notification-reference-plain-1')).toBeNull();
  });

  it('opens the dispatched call and closes the inbox', () => {
    withItems([item({ eventCode: 'C1234' }, 'call-1')]);
    const onClose = jest.fn();

    render(<NotificationInbox isOpen onClose={onClose} />);
    fireEvent.press(screen.getByTestId('notification-reference-call-1'));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/call/[id]', params: { id: '1234' } });
    expect(onClose).toHaveBeenCalled();
  });

  it('opens the chat conversation', () => {
    withItems([item({ eventCode: 't:9a2b' }, 'chat-1')]);

    render(<NotificationInbox isOpen onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('notification-reference-chat-1'));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/chat/[channelId]', params: { channelId: '9a2b' } });
  });
});

describe('NotificationDetail reference button', () => {
  const base = { id: 'n-1', title: 'Structure Fire', body: 'Engine 6 respond', createdAt: '2026-09-22T10:00:00Z', read: true };

  it.each([
    ['call', 'View Call'],
    ['chat', 'View Chat'],
    ['note', 'Open'],
  ])('labels a %s reference as %s', (referenceType, label) => {
    withItems([]);
    const onNavigateToReference = jest.fn();
    render(<NotificationDetail notification={{ ...base, referenceType: referenceType as 'call', referenceId: 'ref-1' }} onClose={jest.fn()} onDelete={jest.fn()} onNavigateToReference={onNavigateToReference} />);

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText('Notification')).toBeTruthy();
    fireEvent.press(screen.getByTestId('notification-detail-reference'));
    expect(onNavigateToReference).toHaveBeenCalledWith(referenceType, 'ref-1');
  });
});
