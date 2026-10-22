import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';
import { useUnitBulkActionsStore } from '@/stores/dispatch/unit-bulk-actions-store';

import { UnitsPanel } from '../units-panel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/components/ui/icon', () => ({
  Icon: () => null,
}));

jest.mock('../animated-refresh-icon', () => ({
  AnimatedRefreshIcon: () => null,
}));

jest.mock('../resources-panel', () => ({
  ResourcesPanel: () => null,
}));

const unit = (UnitId: string, Name: string): UnitInfoResultData => ({ UnitId, Name, Type: 'Ziekenwagen', CurrentStatus: 'Ter Plaatse', CurrentStatusId: '6', CurrentDestinationId: '' }) as UnitInfoResultData;
const units = [unit('zw', 'ZW Herzele'), unit('mug', 'MUG Oudenaarde'), unit('brw', 'BRW Zottegem')];

const renderPanel = (props: Partial<React.ComponentProps<typeof UnitsPanel>> = {}) => {
  const onSelectUnit = jest.fn();
  const onSetUnitStatusForCall = jest.fn();
  render(<UnitsPanel units={units} isLoading={false} onRefresh={jest.fn()} onSelectUnit={onSelectUnit} onSetUnitStatusForCall={onSetUnitStatusForCall} {...props} />);
  return { onSelectUnit, onSetUnitStatusForCall };
};

const selection = () => useUnitBulkActionsStore.getState().selectedUnitIds;

describe('UnitsPanel multi-select', () => {
  beforeEach(() => {
    useUnitBulkActionsStore.getState().reset();
  });

  it('selects a single unit on tap while multi-select is off', () => {
    const { onSelectUnit } = renderPanel();

    fireEvent.press(screen.getByTestId('unit-item-zw'));

    expect(onSelectUnit).toHaveBeenCalledWith('zw');
    expect(useUnitBulkActionsStore.getState().isSelectionMode).toBe(false);
  });

  it('toggles units into a multi-select instead of selecting one once multi-select is on', () => {
    const { onSelectUnit } = renderPanel();

    fireEvent.press(screen.getByTestId('unit-multi-select-toggle'));
    fireEvent.press(screen.getByTestId('unit-item-zw'));
    fireEvent.press(screen.getByTestId('unit-item-mug'));

    expect(selection()).toEqual(['zw', 'mug']);
    expect(onSelectUnit).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('unit-item-zw'));
    expect(selection()).toEqual(['mug']);
  });

  it('starts a multi-select on long press, taking along the unit whose actions are open', () => {
    const { onSelectUnit } = renderPanel({ selectedUnitId: 'zw' });

    fireEvent(screen.getByTestId('unit-item-mug'), 'longPress');

    expect(selection()).toEqual(['zw', 'mug']);
    // The single-unit selection is toggled off so its own actions close
    expect(onSelectUnit).toHaveBeenCalledWith('zw');
  });

  it('selects every unit the list shows with select all', () => {
    renderPanel();

    fireEvent.press(screen.getByTestId('unit-multi-select-toggle'));
    fireEvent.press(screen.getByTestId('unit-select-all'));

    expect(selection()).toEqual(['zw', 'mug', 'brw']);
  });

  it('hides the per-unit set-status-for-call button while multi-select is on', () => {
    renderPanel({ isCallFilterActive: true, callDispatches: [] });
    expect(screen.queryAllByTestId('unit-set-status-for-call')).toHaveLength(units.length);

    fireEvent.press(screen.getByTestId('unit-multi-select-toggle'));

    expect(screen.queryAllByTestId('unit-set-status-for-call')).toHaveLength(0);
  });

  it('ends the multi-select with done', () => {
    renderPanel();
    fireEvent.press(screen.getByTestId('unit-multi-select-toggle'));
    fireEvent.press(screen.getByTestId('unit-item-zw'));

    act(() => {
      fireEvent.press(screen.getByTestId('unit-select-done'));
    });

    expect(useUnitBulkActionsStore.getState().isSelectionMode).toBe(false);
    expect(selection()).toEqual([]);
  });
});
