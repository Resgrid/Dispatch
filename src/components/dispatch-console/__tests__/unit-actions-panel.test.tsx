import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { getSetUnitStatusData } from '@/api/dispatch/dispatch';
import { saveUnitStatus } from '@/api/units/unitStatuses';
import { CustomStateDetailType, DestinationEntityType } from '@/lib/destination-helpers';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type StatusesResultData } from '@/models/v4/statuses/statusesResultData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';
import { useDispatchConsoleStore } from '@/stores/dispatch/dispatch-console-store';
import { useUnitActionsStore } from '@/stores/dispatch/unit-actions-store';

import { UnitActionsPanel } from '../unit-actions-panel';

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

jest.mock('@/components/calls/udf-fields-renderer', () => ({
  UdfFieldsRenderer: () => null,
}));

// Calls store: a stable array so the panel's memoised active-call list does not churn between renders
const mockCalls: CallResultData[] = [
  { CallId: 'A', Number: '26-A', Name: 'Structure Fire', State: 0 } as CallResultData,
  { CallId: 'B', Number: '26-B', Name: 'Medical Aid', State: 0 } as CallResultData,
  { CallId: 'CLOSED', Number: '26-C', Name: 'Old Call', State: 4 } as CallResultData,
];
const mockFetchCalls = jest.fn();
jest.mock('@/stores/calls/store', () => ({
  useCallsStore: (selector: (state: { calls: CallResultData[]; fetchCalls: () => void }) => unknown) => selector({ calls: mockCalls, fetchCalls: mockFetchCalls }),
}));

jest.mock('@/stores/units/store', () => ({
  useUnitsStore: {
    getState: () => ({ unitStatuses: [], fetchUnits: jest.fn() }),
  },
}));

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
      <TouchableOpacity onPress={isDisabled ? undefined : onPress} testID="update-status-button">
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

const status = (Id: number, Text: string, Detail: number): StatusesResultData => ({ Id, Type: 3, StateId: 0, Text, BColor: '#123456', Color: '', Gps: false, Note: 0, Detail }) as StatusesResultData;
const statuses = [status(0, 'Available', CustomStateDetailType.Stations), status(3, 'Responding', CustomStateDetailType.Calls), status(6, 'On Scene', CustomStateDetailType.Calls), status(8, 'Out of Service', CustomStateDetailType.None)];

const unit = (UnitId: string, CurrentDestinationId = ''): UnitInfoResultData => ({ UnitId, Name: `Unit ${UnitId}`, Type: 'Engine', CustomStatusSetId: '', CurrentDestinationId }) as UnitInfoResultData;

const selectedCallInStore = () => useUnitActionsStore.getState().statusSelectedCall?.CallId ?? null;

const renderOpenPanel = async (target: UnitInfoResultData) => {
  act(() => {
    useUnitActionsStore.getState().openActions(target);
  });
  const view = render(<UnitActionsPanel unit={target} />);
  await waitFor(() => expect(useUnitActionsStore.getState().isLoadingOptions).toBe(false));
  return view;
};

const pickStatus = async (text: string) => {
  fireEvent.press(screen.getByText('dispatch.unit_actions_panel.select_status'));
  fireEvent.press(await screen.findByText(text));
};

describe('UnitActionsPanel destination defaults', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSetUnitStatusData.mockResolvedValue({ Data: { Statuses: statuses, Calls: [], Stations: [], DestinationPois: [] } } as any);
    mockSaveUnitStatus.mockResolvedValue({} as any);
    useUnitActionsStore.getState().reset();
    useDispatchConsoleStore.setState({ selectedCallId: null, isCallFilterActive: false });
  });

  it("defaults to the unit's current destination when it is an active call", async () => {
    useDispatchConsoleStore.setState({ selectedCallId: 'B', isCallFilterActive: true });
    await renderOpenPanel(unit('u1', 'A'));

    await waitFor(() => expect(selectedCallInStore()).toBe('A'));
  });

  it("falls back to the console's selected call when the unit's destination is not an active call", async () => {
    useDispatchConsoleStore.setState({ selectedCallId: 'B', isCallFilterActive: true });
    await renderOpenPanel(unit('u1', 'CLOSED'));

    await waitFor(() => expect(selectedCallInStore()).toBe('B'));

    // The panel shows the defaulted call once a status that accepts calls is picked
    await pickStatus('Responding');
    expect(screen.getByText('#26-B - Medical Aid')).toBeTruthy();
  });

  it('defaults to no destination when neither the unit destination nor a selected call is active', async () => {
    await renderOpenPanel(unit('u1', 'CLOSED'));

    await waitFor(() => expect(useUnitActionsStore.getState().destinationInitializedSessionId).toBe(useUnitActionsStore.getState().actionsSessionId));
    expect(useUnitActionsStore.getState().statusDestinationType).toBe('none');
  });

  it('shows no destination for a status that does not support the defaulted call', async () => {
    useDispatchConsoleStore.setState({ selectedCallId: 'B', isCallFilterActive: true });
    await renderOpenPanel(unit('u1'));
    await waitFor(() => expect(selectedCallInStore()).toBe('B'));

    await pickStatus('Available');
    await waitFor(() => expect(screen.getAllByText('dispatch.unit_actions_panel.no_destination').length).toBeGreaterThan(0));
    expect(screen.queryByText('#26-B - Medical Aid')).toBeNull();
  });

  it('keeps the destination after a successful submit and does not re-apply the default', async () => {
    await renderOpenPanel(unit('u1', 'A'));
    await waitFor(() => expect(selectedCallInStore()).toBe('A'));

    await pickStatus('Responding');
    fireEvent.press(screen.getByTestId('update-status-button'));
    await waitFor(() => expect(mockSaveUnitStatus).toHaveBeenCalledTimes(1));
    expect(mockSaveUnitStatus.mock.calls[0][0]).toMatchObject({ Id: 'u1', Type: '3', RespondingTo: 'A', RespondingToType: DestinationEntityType.Call });

    // Follow-up status for the same unit still goes to call A
    await waitFor(() => expect(useUnitActionsStore.getState().selectedStatus).toBeNull());
    expect(selectedCallInStore()).toBe('A');
    await pickStatus('On Scene');
    expect(screen.getByText('#26-A - Structure Fire')).toBeTruthy();
    fireEvent.press(screen.getByTestId('update-status-button'));
    await waitFor(() => expect(mockSaveUnitStatus).toHaveBeenCalledTimes(2));
    expect(mockSaveUnitStatus.mock.calls[1][0]).toMatchObject({ Id: 'u1', Type: '6', RespondingTo: 'A', RespondingToType: DestinationEntityType.Call });
  });

  it('re-initialises the default destination when the selected unit changes', async () => {
    useDispatchConsoleStore.setState({ selectedCallId: 'B', isCallFilterActive: true });
    const first = unit('u1', 'A');
    const second = unit('u2');
    const view = await renderOpenPanel(first);
    await waitFor(() => expect(selectedCallInStore()).toBe('A'));

    // The dashboard re-renders the panel with the new unit before its parent re-opens the store for it
    view.rerender(<UnitActionsPanel unit={second} />);
    act(() => {
      useUnitActionsStore.getState().openActions(second);
    });

    await waitFor(() => expect(selectedCallInStore()).toBe('B'));
    expect(useUnitActionsStore.getState().selectedUnit?.UnitId).toBe('u2');
  });

  it('does not re-apply the default when the panel remounts within the same open session', async () => {
    useDispatchConsoleStore.setState({ selectedCallId: 'B', isCallFilterActive: true });
    const target = unit('u1', 'A');
    const view = await renderOpenPanel(target);
    await waitFor(() => expect(selectedCallInStore()).toBe('A'));

    // The dispatcher changes the destination, then switches tabs away and back (unmount/remount)
    act(() => {
      useUnitActionsStore.getState().setStatusDestinationType('none');
    });
    view.unmount();
    render(<UnitActionsPanel unit={target} />);
    await waitFor(() => expect(useUnitActionsStore.getState().isLoadingOptions).toBe(false));

    expect(useUnitActionsStore.getState().statusDestinationType).toBe('none');
  });

  it('shows and sends the explicit call context even for a status whose Detail lists no destinations', async () => {
    const target = unit('u1', 'A');
    act(() => {
      useUnitActionsStore.getState().openActions(target, { callContext: mockCalls[1] });
    });
    render(<UnitActionsPanel unit={target} />);
    await waitFor(() => expect(useUnitActionsStore.getState().isLoadingOptions).toBe(false));

    // The explicit context wins over the unit's current destination
    expect(selectedCallInStore()).toBe('B');

    await pickStatus('Out of Service');
    expect(screen.getByText('#26-B - Medical Aid')).toBeTruthy();

    fireEvent.press(screen.getByTestId('update-status-button'));
    await waitFor(() => expect(mockSaveUnitStatus).toHaveBeenCalledTimes(1));
    expect(mockSaveUnitStatus.mock.calls[0][0]).toMatchObject({ Id: 'u1', Type: '8', RespondingTo: 'B', RespondingToType: DestinationEntityType.Call });
  });
});
