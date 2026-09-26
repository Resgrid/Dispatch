import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';
import { useDashboardViewStore } from '@/stores/dispatch/dashboard-view-store';
import { useUnitActionsStore } from '@/stores/dispatch/unit-actions-store';

import { ActivityLogPanel } from '../activity-log-panel';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/stores/dispatch/dashboard-view-store', () => {
  const { create } = require('zustand');
  const useDashboardViewStore = create((set: any) => ({
    collapsedCards: {},
    setCardCollapsed: (card: string, collapsed: boolean) => set((state: any) => ({ collapsedCards: { ...state.collapsedCards, [card]: collapsed } })),
  }));
  return { useDashboardViewStore, selectCardCollapsed: (card: string) => (state: any) => state.collapsedCards[card] ?? false };
});

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

jest.mock('../panel-header', () => ({
  PanelHeader: ({ title }: { title: string }) => {
    const { Text } = require('react-native');
    return <Text>{title}</Text>;
  },
}));

// The actions panels themselves are covered by their own tests; here only which one is shown matters
jest.mock('../unit-actions-panel', () => ({
  UnitActionsPanel: ({ unit }: { unit: UnitInfoResultData }) => {
    const { Text } = require('react-native');
    return <Text>{`unit-actions:${unit.UnitId}`}</Text>;
  },
}));

jest.mock('../personnel-actions-panel', () => ({
  PersonnelActionsPanel: () => null,
}));

const call = { CallId: '777', Number: '26-777', Name: 'MVA', State: 0 } as CallResultData;
const engine = { UnitId: 'e1', Name: 'Engine 1' } as UnitInfoResultData;

const baseProps = { entries: [], isLoading: false, isCallFilterActive: true, selectedCallId: '777' };

describe('ActivityLogPanel actions for "+" set-status-for-call', () => {
  beforeEach(() => {
    useUnitActionsStore.getState().reset();
    useDashboardViewStore.setState({ collapsedCards: {} } as any);
  });

  it('keeps the call context when the unit selection arrives after "+" opened the panel', () => {
    const view = render(<ActivityLogPanel {...baseProps} />);

    // What the "+" handler does: open the store with the call context, then select the unit
    act(() => {
      useUnitActionsStore.getState().openActions(engine, { callContext: call });
    });
    view.rerender(<ActivityLogPanel {...baseProps} selectedUnitId="e1" selectedUnit={engine} />);

    expect(useUnitActionsStore.getState().callContext).toBe(call);
    expect(useUnitActionsStore.getState().statusSelectedCall).toBe(call);
    expect(screen.getByText('unit-actions:e1')).toBeTruthy();
  });

  it('surfaces the actions tab (and expands the card) when "+" re-targets the already-selected unit', () => {
    const view = render(<ActivityLogPanel {...baseProps} selectedUnitId="e1" selectedUnit={engine} />);
    expect(screen.getByText('unit-actions:e1')).toBeTruthy();
    const session = useUnitActionsStore.getState().actionsSessionId;

    // Dispatcher goes back to the activity tab, then presses "+" on the same unit
    fireEvent.press(screen.getByText('dispatch.activity'));
    expect(screen.queryByText('unit-actions:e1')).toBeNull();
    act(() => {
      useDashboardViewStore.getState().setCardCollapsed('activity-log', true);
    });
    act(() => {
      useUnitActionsStore.getState().openActions(engine, { callContext: call });
    });
    view.rerender(<ActivityLogPanel {...baseProps} selectedUnitId="e1" selectedUnit={engine} />);

    expect(useUnitActionsStore.getState().actionsSessionId).toBe(session + 1);
    expect(useDashboardViewStore.getState().collapsedCards['activity-log']).toBe(false);
    expect(screen.getByText('unit-actions:e1')).toBeTruthy();
  });

  it('still opens the unit actions (without a call context) on a plain unit selection', () => {
    const view = render(<ActivityLogPanel {...baseProps} />);
    view.rerender(<ActivityLogPanel {...baseProps} selectedUnitId="e1" selectedUnit={engine} />);

    const state = useUnitActionsStore.getState();
    expect(state.isActionsOpen).toBe(true);
    expect(state.selectedUnit).toBe(engine);
    expect(state.callContext).toBeNull();
    expect(screen.getByText('unit-actions:e1')).toBeTruthy();
  });
});
