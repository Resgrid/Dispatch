import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';

import { getSetUnitStatusData } from '@/api/dispatch/dispatch';
import { saveUnitStatus } from '@/api/units/unitStatuses';
import { ActionBaseTypes } from '@/lib/base-types';
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
const mockCallsWithD: CallResultData[] = [...mockCalls, { CallId: 'D', Number: '26-D', Name: 'Traffic Collision', State: 0 } as CallResultData];
// A call logged with its receiving hospital (destination POI 11)
const mockCallsWithHospital: CallResultData[] = [...mockCalls, { CallId: 'H', Number: '20-10-2026-4', Name: 'AGRESSIE', State: 0, DestinationPoiId: 11, DestinationName: 'AZ Zottegem' } as CallResultData];
let mockCallList = mockCalls;
let mockIsLoadingCalls = false;
const mockFetchCalls = jest.fn(() => Promise.resolve());
jest.mock('@/stores/calls/store', () => ({
  useCallsStore: (selector: (state: { calls: CallResultData[]; isLoadingCalls: boolean; fetchCalls: () => void }) => unknown) =>
    selector({ calls: mockCallList, isLoadingCalls: mockIsLoadingCalls, fetchCalls: mockFetchCalls }),
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
    // `disabled` (not a dropped onPress): fireEvent would otherwise bubble the press up to this mock's own onPress prop
    Button: ({ children, onPress, isDisabled }: any) => (
      <TouchableOpacity onPress={onPress} disabled={!!isDisabled} testID="update-status-button">
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
const statuses = [
  status(0, 'Available', CustomStateDetailType.Stations),
  status(3, 'Responding', CustomStateDetailType.Calls),
  status(6, 'On Scene', CustomStateDetailType.Calls),
  status(8, 'Out of Service', CustomStateDetailType.None),
];

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
    mockCallList = mockCalls;
    mockIsLoadingCalls = false;
  });

  it("defaults to the unit's current destination when it is an active call", async () => {
    useDispatchConsoleStore.setState({ selectedCallId: 'B', isCallFilterActive: true });
    await renderOpenPanel(unit('u1', 'A'));

    await waitFor(() => expect(selectedCallInStore()).toBe('A'));
  });

  // Belgian EMS, 2026-10-07: the dispatcher had to pick the unit's incident for every status entered.
  it('defaults to the call the server says the unit is working, even when its last status went to the hospital', async () => {
    useDispatchConsoleStore.setState({ selectedCallId: 'A', isCallFilterActive: true });
    await renderOpenPanel({ ...unit('u1', '9'), CurrentDestinationType: DestinationEntityType.Poi, ActiveCallId: 'B' } as UnitInfoResultData);

    await waitFor(() => expect(selectedCallInStore()).toBe('B'));
  });

  it('waits for a working call the calls list is still loading instead of settling on the selected call', async () => {
    useDispatchConsoleStore.setState({ selectedCallId: 'A', isCallFilterActive: true });
    mockIsLoadingCalls = true;
    const target = { ...unit('u1', 'A'), CurrentDestinationType: DestinationEntityType.Call, ActiveCallId: 'D' } as UnitInfoResultData;
    const view = await renderOpenPanel(target);

    expect(useUnitActionsStore.getState().destinationInitializedSessionId).not.toBe(useUnitActionsStore.getState().actionsSessionId);
    expect(selectedCallInStore()).toBeNull();

    mockCallList = mockCallsWithD;
    mockIsLoadingCalls = false;
    view.rerender(<UnitActionsPanel unit={target} />);

    await waitFor(() => expect(selectedCallInStore()).toBe('D'));
  });

  describe('when the working call is missing from a loaded calls list', () => {
    let finishLookup: () => void;
    const target = { ...unit('u1'), ActiveCallId: 'D' } as UnitInfoResultData;

    beforeEach(() => {
      useDispatchConsoleStore.setState({ selectedCallId: 'A', isCallFilterActive: true });
      mockFetchCalls.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishLookup = resolve;
          })
      );
    });

    it('looks the call up once before settling on the selected call', async () => {
      await renderOpenPanel(target);

      expect(mockFetchCalls).toHaveBeenCalledTimes(1);
      expect(useUnitActionsStore.getState().destinationInitializedSessionId).not.toBe(useUnitActionsStore.getState().actionsSessionId);
      expect(selectedCallInStore()).toBeNull();

      mockCallList = mockCallsWithD;
      await act(async () => finishLookup());

      await waitFor(() => expect(selectedCallInStore()).toBe('D'));
      expect(mockFetchCalls).toHaveBeenCalledTimes(1);
    });

    it('falls back once the lookup settles without it', async () => {
      await renderOpenPanel(target);
      expect(selectedCallInStore()).toBeNull();

      await act(async () => finishLookup());

      await waitFor(() => expect(selectedCallInStore()).toBe('A'));
      expect(mockFetchCalls).toHaveBeenCalledTimes(1);
    });

    it('holds a status that takes a call until the lookup lands, then sends it to the working call', async () => {
      await renderOpenPanel(target);
      await pickStatus('Responding');

      fireEvent.press(screen.getByTestId('update-status-button'));
      expect(mockSaveUnitStatus).not.toHaveBeenCalled();

      mockCallList = mockCallsWithD;
      await act(async () => finishLookup());
      await waitFor(() => expect(selectedCallInStore()).toBe('D'));

      fireEvent.press(screen.getByTestId('update-status-button'));
      await waitFor(() => expect(mockSaveUnitStatus).toHaveBeenCalledTimes(1));
      expect(mockSaveUnitStatus.mock.calls[0][0]).toMatchObject({ Id: 'u1', Type: '3', RespondingTo: 'D', RespondingToType: DestinationEntityType.Call });
    });

    it("holds a station status too, then sends it to the unit's station when the lookup finds no call", async () => {
      useDispatchConsoleStore.setState({ selectedCallId: null, isCallFilterActive: false });
      mockGetSetUnitStatusData.mockResolvedValue({ Data: { Statuses: statuses, Calls: [], Stations: [{ GroupId: 'S1', Name: 'Station 1' }], DestinationPois: [] } } as any);
      await renderOpenPanel({ ...unit('u1', 'S1'), CurrentDestinationType: DestinationEntityType.Station, ActiveCallId: 'D' } as UnitInfoResultData);
      await pickStatus('Available');

      fireEvent.press(screen.getByTestId('update-status-button'));
      expect(mockSaveUnitStatus).not.toHaveBeenCalled();

      await act(async () => finishLookup());
      await waitFor(() => expect(useUnitActionsStore.getState().statusSelectedStation?.GroupId).toBe('S1'));

      fireEvent.press(screen.getByTestId('update-status-button'));
      await waitFor(() => expect(mockSaveUnitStatus).toHaveBeenCalledTimes(1));
      expect(mockSaveUnitStatus.mock.calls[0][0]).toMatchObject({ Id: 'u1', Type: '0', RespondingTo: 'S1', RespondingToType: DestinationEntityType.Station });
    });

    it('does not hold a status that takes no destination', async () => {
      await renderOpenPanel(target);
      await pickStatus('Out of Service');

      fireEvent.press(screen.getByTestId('update-status-button'));
      await waitFor(() => expect(mockSaveUnitStatus).toHaveBeenCalledTimes(1));
      expect(mockSaveUnitStatus.mock.calls[0][0]).toMatchObject({ Id: 'u1', Type: '8', RespondingTo: '' });
    });

    it("keeps the dispatcher's explicit No destination when the lookup lands", async () => {
      await renderOpenPanel(target);
      await pickStatus('Responding');

      // Nothing applies yet, so the destination sheet opens; the dispatcher sends this one without a destination
      fireEvent.press(within(await screen.findByTestId('actionsheet')).getByText('dispatch.unit_actions_panel.no_destination'));

      mockCallList = mockCallsWithD;
      await act(async () => finishLookup());
      expect(selectedCallInStore()).toBeNull();
      expect(useUnitActionsStore.getState().statusDestinationType).toBe('none');

      fireEvent.press(screen.getByTestId('update-status-button'));
      await waitFor(() => expect(mockSaveUnitStatus).toHaveBeenCalledTimes(1));
      expect(mockSaveUnitStatus.mock.calls[0][0]).toMatchObject({ Id: 'u1', Type: '3', RespondingTo: '' });
    });
  });

  it('never takes a station destination for the call with the same id', async () => {
    await renderOpenPanel({ ...unit('u1', 'A'), CurrentDestinationType: DestinationEntityType.Station } as UnitInfoResultData);

    await waitFor(() => expect(useUnitActionsStore.getState().destinationInitializedSessionId).toBe(useUnitActionsStore.getState().actionsSessionId));
    expect(selectedCallInStore()).toBeNull();
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

// Belgian EMS, 2026-10-21: "departing to hospital" should go to the hospital the call was logged with, without the
// dispatcher picking it, and a crew's change of hospital should stand out.
describe('UnitActionsPanel transport destination', () => {
  const withMeaning = (s: StatusesResultData, BaseType: number): StatusesResultData => ({ ...s, BaseType });
  const transportStatuses = [
    ...statuses,
    withMeaning(status(12, 'Vertrek ZH', CustomStateDetailType.CallsAndPois), ActionBaseTypes.Transporting),
    withMeaning(status(13, 'Aankomst ZH', CustomStateDetailType.Pois), ActionBaseTypes.AtHospital),
  ];
  const hospitals = [
    { PoiId: 11, Name: 'AZ Sint-Elisabeth Zottegem', Address: 'Godveerdegemstraat 69' },
    { PoiId: 12, Name: 'UZ Gent', Address: '' },
  ];
  const onCallH = (overrides: Partial<UnitInfoResultData> = {}) => ({ ...unit('u1'), ActiveCallId: 'H', ...overrides }) as UnitInfoResultData;
  const selectedPoiInStore = () => useUnitActionsStore.getState().statusSelectedPoi?.PoiId ?? null;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSetUnitStatusData.mockResolvedValue({ Data: { Statuses: transportStatuses, Calls: [], Stations: [], DestinationPois: hospitals } } as any);
    mockSaveUnitStatus.mockResolvedValue({} as any);
    useUnitActionsStore.getState().reset();
    useDispatchConsoleStore.setState({ selectedCallId: null, isCallFilterActive: false });
    mockCallList = mockCallsWithHospital;
    mockIsLoadingCalls = false;
  });

  it("defaults a Transporting status to the call's hospital and sends it without opening the destination picker", async () => {
    await renderOpenPanel(onCallH());
    await waitFor(() => expect(selectedCallInStore()).toBe('H'));

    await pickStatus('Vertrek ZH');

    expect(selectedPoiInStore()).toBe(11);
    expect(screen.getByText('AZ Sint-Elisabeth Zottegem - Godveerdegemstraat 69')).toBeTruthy();
    expect(screen.queryByText('dispatch.unit_actions_panel.differs_from_call_destination')).toBeNull();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    expect(screen.queryByTestId('actionsheet')).toBeNull();

    fireEvent.press(screen.getByTestId('update-status-button'));
    await waitFor(() => expect(mockSaveUnitStatus).toHaveBeenCalledTimes(1));
    expect(mockSaveUnitStatus.mock.calls[0][0]).toMatchObject({ Id: 'u1', Type: '12', RespondingTo: '11', RespondingToType: DestinationEntityType.Poi });
  });

  it("keeps the call for a status that is not a transport status", async () => {
    await renderOpenPanel(onCallH());
    await waitFor(() => expect(selectedCallInStore()).toBe('H'));

    await pickStatus('Responding');

    expect(selectedCallInStore()).toBe('H');
    expect(selectedPoiInStore()).toBeNull();
  });

  it("lists the call's hospital first, flags another hospital and keeps it for At Hospital", async () => {
    await renderOpenPanel(onCallH());
    await waitFor(() => expect(selectedCallInStore()).toBe('H'));
    await pickStatus('Vertrek ZH');

    // The crew asks for UZ Gent (e.g. a Cath Lab)
    fireEvent.press(screen.getByText('AZ Sint-Elisabeth Zottegem - Godveerdegemstraat 69'));
    const sheet = await screen.findByTestId('actionsheet');
    expect(within(sheet).getByText('dispatch.unit_actions_panel.call_destination')).toBeTruthy();
    fireEvent.press(within(sheet).getByText('UZ Gent'));

    expect(selectedPoiInStore()).toBe(12);
    expect(screen.getByText('dispatch.unit_actions_panel.differs_from_call_destination')).toBeTruthy();
    expect(screen.getByPlaceholderText('dispatch.unit_actions_panel.destination_change_reason (common.optional)')).toBeTruthy();

    fireEvent.press(screen.getByTestId('update-status-button'));
    await waitFor(() => expect(mockSaveUnitStatus).toHaveBeenCalledTimes(1));
    expect(mockSaveUnitStatus.mock.calls[0][0]).toMatchObject({ Type: '12', RespondingTo: '12', RespondingToType: DestinationEntityType.Poi });

    await waitFor(() => expect(useUnitActionsStore.getState().selectedStatus).toBeNull());
    await pickStatus('Aankomst ZH');
    expect(selectedPoiInStore()).toBe(12);
  });

  it('defaults At Hospital on a later open to the hospital the unit is transporting to', async () => {
    await renderOpenPanel(onCallH({ CurrentStatusBaseType: ActionBaseTypes.Transporting, CurrentDestinationType: DestinationEntityType.Poi, CurrentDestinationId: '12' }));
    await waitFor(() => expect(selectedCallInStore()).toBe('H'));

    await pickStatus('Aankomst ZH');

    expect(selectedPoiInStore()).toBe(12);
    expect(screen.getByText('dispatch.unit_actions_panel.differs_from_call_destination')).toBeTruthy();
  });

  // A crew asks to divert a STEMI: the dispatcher filters the hospitals to those with a Cath Lab
  it('filters the hospitals by capability and shows what each offers', async () => {
    mockGetSetUnitStatusData.mockResolvedValue({
      Data: {
        Statuses: transportStatuses,
        Calls: [],
        Stations: [],
        DestinationPois: [
          { ...hospitals[0], Capabilities: ['Stroke Center', 'Maternity'] },
          { ...hospitals[1], Capabilities: ['Cath Lab', 'Trauma Center'] },
          { PoiId: 13, Name: 'UZ Brussel', Address: '', Capabilities: ['Burn Center', 'Cath Lab'] },
        ],
      },
    } as any);
    await renderOpenPanel(onCallH());
    await waitFor(() => expect(selectedCallInStore()).toBe('H'));
    await pickStatus('Vertrek ZH');

    fireEvent.press(screen.getByText('AZ Sint-Elisabeth Zottegem - Godveerdegemstraat 69'));
    const sheet = await screen.findByTestId('actionsheet');
    expect(within(sheet).getByText('Stroke Center · Maternity')).toBeTruthy();

    fireEvent.press(within(sheet).getByTestId('capability-chip-Cath Lab'));
    expect(within(sheet).queryByText('AZ Sint-Elisabeth Zottegem - Godveerdegemstraat 69')).toBeNull();
    expect(within(sheet).getByText('UZ Gent')).toBeTruthy();
    expect(within(sheet).getByText('UZ Brussel')).toBeTruthy();

    fireEvent.press(within(sheet).getByTestId('capability-chip-Burn Center'));
    expect(within(sheet).queryByText('UZ Gent')).toBeNull();
    fireEvent.press(within(sheet).getByText('UZ Brussel'));

    expect(selectedPoiInStore()).toBe(13);
    expect(screen.getByText('dispatch.unit_actions_panel.differs_from_call_destination')).toBeTruthy();
  });

  it('offers a way back when no hospital offers every selected capability', async () => {
    mockGetSetUnitStatusData.mockResolvedValue({
      Data: {
        Statuses: transportStatuses,
        Calls: [],
        Stations: [],
        DestinationPois: [
          { ...hospitals[0], Capabilities: ['Stroke Center'] },
          { ...hospitals[1], Capabilities: ['Cath Lab'] },
        ],
      },
    } as any);
    await renderOpenPanel(onCallH());
    await waitFor(() => expect(selectedCallInStore()).toBe('H'));
    await pickStatus('Vertrek ZH');

    fireEvent.press(screen.getByText('AZ Sint-Elisabeth Zottegem - Godveerdegemstraat 69'));
    const sheet = await screen.findByTestId('actionsheet');
    fireEvent.press(within(sheet).getByTestId('capability-chip-Cath Lab'));
    fireEvent.press(within(sheet).getByTestId('capability-chip-Stroke Center'));
    expect(within(sheet).getByText('dispatch.unit_actions_panel.no_pois_match_capabilities')).toBeTruthy();

    fireEvent.press(within(sheet).getByText('dispatch.unit_actions_panel.clear_capability_filter'));
    expect(within(sheet).getByText('UZ Gent')).toBeTruthy();
    expect(within(sheet).getByText('AZ Sint-Elisabeth Zottegem - Godveerdegemstraat 69')).toBeTruthy();
  });
});
