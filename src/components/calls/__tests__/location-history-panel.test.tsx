import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';

import { getCallLocationHistory } from '@/api/calls/callLocationHistory';
import { getContactCallHistory } from '@/api/contacts/contactCallHistory';
import { formatDateForDisplay } from '@/lib/utils';
import { type LocationHistoryData } from '@/models/v4/calls/locationHistoryResult';
import { useLocationHistoryStore } from '@/stores/calls/location-history-store';
import { dataProtectionStore } from '@/stores/data-protection/store';

import { LocationHistoryPanel } from '../location-history-panel';

jest.mock('@/api/calls/callLocationHistory', () => ({ getCallLocationHistory: jest.fn() }));
jest.mock('@/api/contacts/contactCallHistory', () => ({ getContactCallHistory: jest.fn() }));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

jest.mock('@/stores/data-protection/store', () => {
  const { create } = jest.requireActual('zustand');
  return { dataProtectionStore: create(() => ({ grantToken: null })) };
});

const mockTrackEvent = jest.fn();
jest.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({ trackEvent: mockTrackEvent }),
}));

jest.mock('lucide-react-native', () => {
  const { View } = jest.requireActual('react-native');
  return { ChevronDownIcon: View, ChevronUpIcon: View, HistoryIcon: View, InfoIcon: View, LockIcon: View, MapPinIcon: View };
});

jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: unknown) => {
      if (typeof options === 'string') return options;
      if (options && typeof options === 'object') return `${key}:${JSON.stringify(options)}`;
      return key;
    },
  }),
}));

const mockCallHistory = getCallLocationHistory as jest.MockedFunction<typeof getCallLocationHistory>;
const mockContactHistory = getContactCallHistory as jest.MockedFunction<typeof getContactCallHistory>;

const baseHistory: LocationHistoryData = {
  AddressMatchingAvailable: true,
  IndexComplete: true,
  HasMore: false,
  InterpretedAddress: '110 S MAIN ST',
  IsProtected: false,
  Calls: [
    {
      CallId: '9012',
      Number: '26-1188',
      Name: 'Structure fire',
      Nature: 'Smoke from 2nd floor',
      Address: '110 South Main',
      Priority: 3,
      PriorityText: 'Emergency',
      PriorityColor: '#d9534f',
      State: 1,
      LoggedOnUtc: '2026-10-01T14:14:09Z',
      LoggedOn: '10/01/2026 2:14:09 PM',
      CompletedNotes: 'Knox box key missing - owner notified.',
      Matches: ['SameAddress', 'SameContact'],
      DistanceMeters: 12.4,
      Notes: [{ CallNoteId: '1', FullName: 'Taylor Reed', Note: 'Gate code changed, use 4471.', TimestampUtc: '2026-10-01T14:20:00Z' }],
    },
    {
      CallId: '8800',
      Number: '26-0904',
      Name: 'REDACTED',
      Address: null,
      Priority: 1,
      State: 0,
      LoggedOnUtc: '2026-08-14T09:02:11Z',
      Matches: ['Nearby'],
      Notes: [],
    },
  ],
};

describe('LocationHistoryPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLocationHistoryStore.setState({ entries: {} });
    dataProtectionStore.setState({ grantToken: null });
  });

  it('lists previous calls with their match reasons and expands notes and closing notes', async () => {
    mockCallHistory.mockResolvedValueOnce({ Data: baseHistory } as never);

    render(<LocationHistoryPanel source={{ kind: 'call', id: '42' }} />);

    await waitFor(() => expect(screen.getByTestId('location-history-call-9012')).toBeTruthy());
    expect(mockCallHistory).toHaveBeenCalledWith('42');
    expect(screen.getByText('location_history.header_call')).toBeTruthy();
    expect(screen.getByText('location_history.matched_as:{"address":"110 S MAIN ST"}')).toBeTruthy();
    expect(screen.getByTestId('location-history-match-9012-SameAddress')).toBeTruthy();
    expect(screen.getByTestId('location-history-match-9012-SameContact')).toBeTruthy();
    expect(screen.getByText('location_history.meters_away:{"distance":12}')).toBeTruthy();
    expect(screen.getByText('Structure fire')).toBeTruthy();
    expect(screen.queryByText('Gate code changed, use 4471.')).toBeNull();

    fireEvent.press(screen.getByTestId('location-history-notes-toggle-9012'));

    expect(screen.getByText('Gate code changed, use 4471.')).toBeTruthy();
    expect(screen.getByText('Knox box key missing - owner notified.')).toBeTruthy();
    expect(screen.queryByTestId('location-history-notes-toggle-8800')).toBeNull();
    expect(mockTrackEvent).toHaveBeenCalledWith('location_history_viewed', expect.objectContaining({ kind: 'call', id: '42', callCount: 2 }));
  });

  it('shows a lock instead of the REDACTED sentinel for protected call text', async () => {
    mockCallHistory.mockResolvedValueOnce({ Data: baseHistory } as never);

    render(<LocationHistoryPanel source={{ kind: 'call', id: '42' }} />);

    await waitFor(() => expect(screen.getByTestId('location-history-call-8800')).toBeTruthy());
    expect(screen.queryByText('REDACTED')).toBeNull();
  });

  it('opens a call on the call detail route, or through onOpenCall when given', async () => {
    mockCallHistory.mockResolvedValueOnce({ Data: baseHistory } as never);
    const { unmount } = render(<LocationHistoryPanel source={{ kind: 'call', id: '42' }} />);
    await waitFor(() => expect(screen.getByTestId('location-history-open-9012')).toBeTruthy());

    fireEvent.press(screen.getByTestId('location-history-open-9012'));
    expect(router.push).toHaveBeenCalledWith('/call/9012');
    unmount();

    const onOpenCall = jest.fn();
    mockContactHistory.mockResolvedValueOnce({ Data: baseHistory } as never);
    render(<LocationHistoryPanel source={{ kind: 'contact', id: 'c1' }} onOpenCall={onOpenCall} />);
    await waitFor(() => expect(screen.getByTestId('location-history-open-8800')).toBeTruthy());

    fireEvent.press(screen.getByTestId('location-history-open-8800'));
    expect(onOpenCall).toHaveBeenCalledWith('8800');
    expect(screen.getByText('location_history.header_contact')).toBeTruthy();
  });

  it('explains that only contact links were searched while data protection is on', async () => {
    mockCallHistory.mockResolvedValueOnce({ Data: { ...baseHistory, AddressMatchingAvailable: false, InterpretedAddress: null, Calls: [] } } as never);

    render(<LocationHistoryPanel source={{ kind: 'call', id: '42' }} />);

    await waitFor(() => expect(screen.getByTestId('location-history-address-matching-off')).toBeTruthy());
    expect(screen.getByTestId('location-history-empty')).toBeTruthy();
  });

  it('shows UTC timestamps in local time, whether or not the server marks them with a Z', async () => {
    const unmarked = { ...baseHistory.Calls[1], LoggedOnUtc: '2026-08-14T09:02:11' };
    mockCallHistory.mockResolvedValueOnce({ Data: { ...baseHistory, Calls: [baseHistory.Calls[0], unmarked] } } as never);

    render(<LocationHistoryPanel source={{ kind: 'call', id: '42' }} />);
    await waitFor(() => expect(screen.getByTestId('location-history-call-8800')).toBeTruthy());

    expect(screen.getByText(formatDateForDisplay(new Date('2026-08-14T09:02:11Z'), 'yyyy-MM-dd HH:mm'))).toBeTruthy();

    fireEvent.press(screen.getByTestId('location-history-notes-toggle-9012'));
    expect(screen.getByText(`${formatDateForDisplay(new Date('2026-10-01T14:20:00Z'), 'yyyy-MM-dd HH:mm')} · Taylor Reed`)).toBeTruthy();
  });

  it('takes revealed text off screen as soon as the grant is gone, not when the redacted answer lands', async () => {
    dataProtectionStore.setState({ grantToken: 'grant-1' });
    mockCallHistory.mockResolvedValueOnce({ Data: baseHistory } as never);

    render(<LocationHistoryPanel source={{ kind: 'call', id: '42' }} />);
    await waitFor(() => expect(screen.getByText('Structure fire')).toBeTruthy());

    mockCallHistory.mockReturnValueOnce(new Promise(() => undefined) as never);
    act(() => {
      dataProtectionStore.setState({ grantToken: null });
    });

    expect(screen.getByTestId('location-history-loading')).toBeTruthy();
    expect(screen.queryByText('Structure fire')).toBeNull();
  });

  it('shows the load error when the request fails', async () => {
    mockCallHistory.mockRejectedValueOnce(new Error('offline'));

    render(<LocationHistoryPanel source={{ kind: 'call', id: '42' }} />);

    await waitFor(() => expect(screen.getByTestId('location-history-error')).toBeTruthy());
  });
});
