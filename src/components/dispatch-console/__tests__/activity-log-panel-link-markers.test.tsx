import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { type DispatchedEventResultData } from '@/models/v4/calls/dispatchedEventResultData';

import { ActivityLogPanel } from '../activity-log-panel';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/stores/dispatch/dashboard-view-store', () => ({
  useDashboardViewStore: (selector: (state: unknown) => unknown) => selector({ collapsedCards: {}, setCardCollapsed: jest.fn() }),
  selectCardCollapsed: () => () => false,
}));

jest.mock('@/stores/checkIn/store', () => ({
  useCheckInStore: (selector: (state: unknown) => unknown) => selector({ timerStatuses: [], isLoadingStatuses: false }),
}));

jest.mock('@/stores/weatherAlerts/store', () => ({
  useWeatherAlertsStore: (selector: (state: unknown) => unknown) => selector({ alerts: [], settings: null }),
}));

jest.mock('@/hooks/use-check-in-timer-polling', () => ({ useCheckInTimerPolling: jest.fn() }));
jest.mock('@/components/checkIn/check-in-bottom-sheet', () => ({ CheckInBottomSheet: () => null }));
jest.mock('@/components/checkIn/check-in-timer-card', () => ({ CheckInTimerCard: () => null }));
jest.mock('@/components/ui/icon', () => ({ Icon: () => null }));
jest.mock('../panel-header', () => ({ PanelHeader: () => null }));
jest.mock('../unit-actions-panel', () => ({ UnitActionsPanel: () => null }));
jest.mock('../personnel-actions-panel', () => ({ PersonnelActionsPanel: () => null }));

const activity = (Id: string, StatusText: string, DestinationSource?: number | null): DispatchedEventResultData => ({
  Id,
  Timestamp: '2026-09-23 10:00',
  Type: 'Unit',
  Name: `Engine ${Id}`,
  GroupId: '1',
  Group: 'Station 1',
  Note: '',
  StatusId: 2,
  Location: '',
  StatusText,
  StatusColor: '#3b82f6',
  DestinationSource,
});

const renderPanel = (callActivity: DispatchedEventResultData[]) => {
  const view = render(<ActivityLogPanel entries={[]} isLoading={false} isCallFilterActive selectedCallId="777" callActivity={callActivity} />);
  // Selecting a call jumps the panel to its actions tab; the call's activity lives on the activity tab
  fireEvent.press(screen.getByText('dispatch.activity'));
  return view;
};

describe('ActivityLogPanel call activity link markers', () => {
  it.each([2, 3, 4])('marks an entry auto-linked for source %p', (source) => {
    renderPanel([activity('1', 'Responding', source)]);

    expect(screen.getByText('Responding')).toBeTruthy();
    expect(screen.getByTestId('activity-link-marker-auto')).toBeTruthy();
    expect(screen.queryByTestId('activity-link-marker-inferred')).toBeNull();
    expect(screen.getByTestId('activity-link-legend')).toBeTruthy();
  });

  it('marks an entry inferred for source 5', () => {
    renderPanel([activity('1', 'On Scene', 5)]);

    expect(screen.getByTestId('activity-link-marker-inferred')).toBeTruthy();
    expect(screen.queryByTestId('activity-link-marker-auto')).toBeNull();
  });

  it.each([[1], [null], [undefined]])('shows no marker or legend for source %p', (source) => {
    renderPanel([activity('1', 'Available', source)]);

    expect(screen.getByText('Available')).toBeTruthy();
    expect(screen.queryByTestId('activity-link-marker-auto')).toBeNull();
    expect(screen.queryByTestId('activity-link-marker-inferred')).toBeNull();
    expect(screen.queryByTestId('activity-link-legend')).toBeNull();
  });

  it('marks only the entries the server linked or inferred in a mixed list', () => {
    renderPanel([activity('1', 'Dispatched', 1), activity('2', 'Responding', 3), activity('3', 'On Scene', 5), activity('4', 'Available', null)]);

    expect(screen.getAllByTestId('activity-link-marker-auto')).toHaveLength(1);
    expect(screen.getAllByTestId('activity-link-marker-inferred')).toHaveLength(1);
  });
});
