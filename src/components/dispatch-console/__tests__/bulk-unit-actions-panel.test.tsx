import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { getSetUnitStatusData } from '@/api/dispatch/dispatch';
import { saveUnitStatus } from '@/api/units/unitStatuses';
import { CustomStateDetailType, DestinationEntityType } from '@/lib/destination-helpers';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type StatusesResultData } from '@/models/v4/statuses/statusesResultData';
import { type UnitTypeStatusResultData } from '@/models/v4/statuses/unitTypeStatusResultData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';
import { useDispatchConsoleStore } from '@/stores/dispatch/dispatch-console-store';
import { useUnitBulkActionsStore } from '@/stores/dispatch/unit-bulk-actions-store';

import { BulkUnitActionsPanel } from '../bulk-unit-actions-panel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

jest.mock('@/api/dispatch/dispatch', () => ({
  getSetUnitStatusData: jest.fn(),
}));

jest.mock('@/api/units/unitStatuses', () => ({
  saveUnitStatus: jest.fn(),
}));

const mockCalls: CallResultData[] = [
  { CallId: 'A', Number: '20-10-2026-4', Name: 'Agressie', State: 0 } as CallResultData,
  { CallId: 'B', Number: '20-10-2026-3', Name: 'Verkeersongeval', State: 0 } as CallResultData,
];
const mockFetchCalls = jest.fn(() => Promise.resolve());
jest.mock('@/stores/calls/store', () => ({
  useCallsStore: (selector: (state: { calls: CallResultData[]; fetchCalls: () => Promise<void> }) => unknown) => selector({ calls: mockCalls, fetchCalls: mockFetchCalls }),
}));

const status = (Id: number, Text: string, Detail: number): StatusesResultData => ({ Id, Type: 3, StateId: 0, Text, BColor: '#123456', Color: '', Gps: false, Note: 0, Detail }) as StatusesResultData;
const mockGroups: UnitTypeStatusResultData[] = [
  { UnitType: 'Ziekenwagen', StatusId: '10', Statuses: [status(200, 'Ter Plaatse', CustomStateDetailType.Calls), status(201, 'Vertrek naar ziekenhuis', CustomStateDetailType.CallsAndPois), status(205, 'ZW Only', 0)] },
  { UnitType: 'MUG', StatusId: '11', Statuses: [status(300, 'Ter Plaatse', CustomStateDetailType.Calls), status(301, 'Vertrek naar ziekenhuis', CustomStateDetailType.CallsAndPois)] },
];
const unit = (UnitId: string, Name: string, Type: string, CustomStatusSetId: string, ActiveCallId = ''): UnitInfoResultData => ({ UnitId, Name, Type, CustomStatusSetId, ActiveCallId, CurrentDestinationId: '' }) as UnitInfoResultData;
let mockUnits: UnitInfoResultData[] = [];
jest.mock('@/stores/units/store', () => {
  const state = () => ({ units: mockUnits, unitStatuses: mockGroups, fetchUnits: jest.fn() });
  const useUnitsStore = (selector: (s: ReturnType<typeof state>) => unknown) => selector(state());
  useUnitsStore.getState = state;
  return { useUnitsStore };
});

jest.mock('@/components/ui/actionsheet', () => {
  const { View } = require('react-native');
  return {
    Actionsheet: ({ children, isOpen }: any) => (isOpen ? <View testID="actionsheet">{children}</View> : null),
    ActionsheetBackdrop: () => null,
    ActionsheetContent: ({ children }: any) => <View>{children}</View>,
    ActionsheetDragIndicator: () => null,
    ActionsheetDragIndicatorWrapper: ({ children }: any) => children,
  };
});

jest.mock('@/components/ui/button', () => {
  const { Text, TouchableOpacity } = require('react-native');
  return {
    Button: ({ children, onPress, isDisabled }: any) => (
      <TouchableOpacity onPress={onPress} disabled={!!isDisabled} testID="bulk-update-status-button">
        {children}
      </TouchableOpacity>
    ),
    ButtonText: ({ children }: any) => <Text>{children}</Text>,
    ButtonSpinner: () => null,
  };
});

jest.mock('@/components/ui/icon', () => ({
  Icon: () => null,
}));

jest.mock('@/components/ui/spinner', () => ({
  Spinner: () => null,
}));

const mockGetSetUnitStatusData = getSetUnitStatusData as jest.MockedFunction<typeof getSetUnitStatusData>;
const mockSaveUnitStatus = saveUnitStatus as jest.MockedFunction<typeof saveUnitStatus>;

const ambulance = unit('zw', 'ZW Herzele', 'Ziekenwagen', '10', 'A');
const mug = unit('mug', 'MUG Oudenaarde', 'MUG', '11', 'A');

const renderPanel = async (selected: UnitInfoResultData[], onStatusUpdated = jest.fn()) => {
  act(() => {
    useUnitBulkActionsStore.getState().startSelection(selected.map((u) => u.UnitId));
  });
  render(<BulkUnitActionsPanel onStatusUpdated={onStatusUpdated} />);
  await waitFor(() => expect(mockGetSetUnitStatusData).toHaveBeenCalled());
  await screen.findByTestId('bulk-unit-status-button');
  return onStatusUpdated;
};

const pickStatus = async (text: string) => {
  fireEvent.press(screen.getByTestId('bulk-unit-status-button'));
  fireEvent.press(await screen.findByText(text));
};

describe('BulkUnitActionsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSetUnitStatusData.mockResolvedValue({ Data: { Statuses: [], Calls: [], Stations: [], DestinationPois: [] } } as any);
    mockSaveUnitStatus.mockResolvedValue({} as any);
    useUnitBulkActionsStore.getState().reset();
    useDispatchConsoleStore.setState({ selectedCallId: null, isCallFilterActive: false });
    mockUnits = [ambulance, mug, unit('brw', 'BRW Zottegem', 'Ziekenwagen', '10', 'B')];
  });

  it('lists the selected units and only the statuses they all have', async () => {
    await renderPanel([ambulance, mug]);

    expect(screen.getByText('ZW Herzele')).toBeTruthy();
    expect(screen.getByText('MUG Oudenaarde')).toBeTruthy();

    fireEvent.press(screen.getByTestId('bulk-unit-status-button'));
    expect(await screen.findByText('Ter Plaatse')).toBeTruthy();
    expect(screen.getByText('Vertrek naar ziekenhuis')).toBeTruthy();
    expect(screen.queryByText('ZW Only')).toBeNull();
  });

  it('sets the status for every selected unit with its own status id, defaulting to the call they share', async () => {
    const onStatusUpdated = await renderPanel([ambulance, mug]);
    await waitFor(() => expect(useUnitBulkActionsStore.getState().statusSelectedCall?.CallId).toBe('A'));

    await pickStatus('Ter Plaatse');
    fireEvent.press(screen.getByTestId('bulk-update-status-button'));

    await waitFor(() => expect(mockSaveUnitStatus).toHaveBeenCalledTimes(2));
    const payloads = mockSaveUnitStatus.mock.calls.map(([input]) => input);
    expect(payloads.find((p) => p.Id === 'zw')).toMatchObject({ Type: '200', RespondingTo: 'A', RespondingToType: DestinationEntityType.Call });
    expect(payloads.find((p) => p.Id === 'mug')).toMatchObject({ Type: '300', RespondingTo: 'A', RespondingToType: DestinationEntityType.Call });
    await waitFor(() => expect(onStatusUpdated).toHaveBeenCalled());
    expect(await screen.findByTestId('bulk-unit-actions-success')).toBeTruthy();
    // The units stay selected for their next status
    expect(useUnitBulkActionsStore.getState().selectedUnitIds).toEqual(['zw', 'mug']);
  });

  it('has no default destination when the units are on different calls', async () => {
    await renderPanel([ambulance, mockUnits[2]]);

    await pickStatus('Ter Plaatse');

    expect(useUnitBulkActionsStore.getState().statusDestinationType).toBe('none');
    // The status takes a call and none applies, so the destination sheet opens for the dispatcher to pick one
    expect(await screen.findByText('#20-10-2026-4 - Agressie')).toBeTruthy();
  });

  it('removes a unit from the selection from its chip', async () => {
    await renderPanel([ambulance, mug]);

    fireEvent.press(screen.getByTestId('bulk-unit-chip-mug'));

    expect(useUnitBulkActionsStore.getState().selectedUnitIds).toEqual(['zw']);
  });

  it('names the units whose status change failed and retries only those', async () => {
    mockSaveUnitStatus.mockImplementation(async (input) => {
      if (input.Id === 'mug') throw new Error('Network error');
      return {} as any;
    });
    await renderPanel([ambulance, mug]);

    await pickStatus('Ter Plaatse');
    fireEvent.press(screen.getByTestId('bulk-update-status-button'));

    expect(await screen.findByTestId('bulk-unit-actions-failure')).toBeTruthy();
    expect(screen.getByText('dispatch.bulk_unit_actions.retry_failed')).toBeTruthy();

    mockSaveUnitStatus.mockClear();
    mockSaveUnitStatus.mockResolvedValue({} as any);
    fireEvent.press(screen.getByTestId('bulk-update-status-button'));

    await waitFor(() => expect(mockSaveUnitStatus).toHaveBeenCalledTimes(1));
    expect(mockSaveUnitStatus.mock.calls[0][0].Id).toBe('mug');
  });

  it('ends the multi-select from its close button', async () => {
    await renderPanel([ambulance, mug]);

    fireEvent.press(screen.getByTestId('bulk-unit-actions-close'));

    expect(useUnitBulkActionsStore.getState().isSelectionMode).toBe(false);
    expect(useUnitBulkActionsStore.getState().selectedUnitIds).toEqual([]);
  });
});
