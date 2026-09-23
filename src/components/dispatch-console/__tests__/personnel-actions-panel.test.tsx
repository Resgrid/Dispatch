import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { getAllGroups } from '@/api/groups/groups';
import { getPois } from '@/api/mapping/mapping';
import { savePersonsStatuses } from '@/api/personnel/personnelStatuses';
import { getAllPersonnelStaffings, getAllPersonnelStatuses } from '@/api/satuses';
import { CustomStateDetailType, DestinationEntityType } from '@/lib/destination-helpers';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import { type StatusesResultData } from '@/models/v4/statuses/statusesResultData';
import { useDispatchConsoleStore } from '@/stores/dispatch/dispatch-console-store';
import { usePersonnelActionsStore } from '@/stores/dispatch/personnel-actions-store';

import { PersonnelActionsPanel } from '../personnel-actions-panel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

jest.mock('@/api/groups/groups', () => ({ getAllGroups: jest.fn() }));
jest.mock('@/api/mapping/mapping', () => ({ getPois: jest.fn() }));
jest.mock('@/api/satuses', () => ({ getAllPersonnelStatuses: jest.fn(), getAllPersonnelStaffings: jest.fn() }));
jest.mock('@/api/personnel/personnelStatuses', () => ({ savePersonsStatuses: jest.fn() }));
jest.mock('@/api/personnel/personnelStaffing', () => ({ savePersonsStaffings: jest.fn() }));

jest.mock('@/components/calls/udf-fields-renderer', () => ({
  UdfFieldsRenderer: () => null,
}));

const mockCalls: CallResultData[] = [
  { CallId: 'A', Number: '26-A', Name: 'Structure Fire', State: 0 } as CallResultData,
  { CallId: 'B', Number: '26-B', Name: 'Medical Aid', State: 0 } as CallResultData,
];
const mockFetchCalls = jest.fn();
jest.mock('@/stores/calls/store', () => ({
  useCallsStore: (selector: (state: { calls: CallResultData[]; fetchCalls: () => void }) => unknown) => selector({ calls: mockCalls, fetchCalls: mockFetchCalls }),
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
      <TouchableOpacity onPress={isDisabled ? undefined : onPress} testID="update-button">
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

const mockSavePersonsStatuses = savePersonsStatuses as jest.MockedFunction<typeof savePersonsStatuses>;

const status = (Id: number, Text: string, Detail: number): StatusesResultData => ({ Id, Type: 1, StateId: 0, Text, BColor: '#123456', Color: '', Gps: false, Note: 0, Detail }) as StatusesResultData;
const statuses = [status(1, 'Not Responding', CustomStateDetailType.None), status(2, 'Responding', CustomStateDetailType.CallsAndStations), status(3, 'On Scene', CustomStateDetailType.Calls)];

const person = (UserId: string, StatusDestinationId = ''): PersonnelInfoResultData => ({ UserId, FirstName: 'Pat', LastName: UserId, GroupName: 'Station 1', StatusDestinationId }) as PersonnelInfoResultData;

const selectedCallInStore = () => usePersonnelActionsStore.getState().statusSelectedCall?.CallId ?? null;

const pickStatus = async (text: string) => {
  fireEvent.press(screen.getByText('dispatch.personnel_actions.select_status'));
  fireEvent.press(await screen.findByText(text));
};

describe('PersonnelActionsPanel destination defaults', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAllPersonnelStatuses as jest.Mock).mockResolvedValue({ Data: statuses });
    (getAllPersonnelStaffings as jest.Mock).mockResolvedValue({ Data: [] });
    (getAllGroups as jest.Mock).mockResolvedValue({ Data: [] });
    (getPois as jest.Mock).mockResolvedValue({ Data: [] });
    mockSavePersonsStatuses.mockResolvedValue({} as any);
    usePersonnelActionsStore.getState().reset();
    useDispatchConsoleStore.setState({ selectedCallId: null, isCallFilterActive: false });
  });

  it("uses the console's selected call and keeps it sticky across submits", async () => {
    useDispatchConsoleStore.setState({ selectedCallId: 'B', isCallFilterActive: true });
    const target = person('p1');
    act(() => {
      usePersonnelActionsStore.getState().openActions(target);
    });
    render(<PersonnelActionsPanel personnel={target} />);
    await waitFor(() => expect(usePersonnelActionsStore.getState().isLoadingOptions).toBe(false));
    await waitFor(() => expect(selectedCallInStore()).toBe('B'));

    await pickStatus('Responding');
    expect(screen.getByText('#26-B - Medical Aid')).toBeTruthy();
    fireEvent.press(screen.getByTestId('update-button'));
    await waitFor(() => expect(mockSavePersonsStatuses).toHaveBeenCalledTimes(1));
    expect(mockSavePersonsStatuses.mock.calls[0][0]).toMatchObject({ UserIds: ['p1'], Type: '2', RespondingTo: 'B', RespondingToType: DestinationEntityType.Call });

    await waitFor(() => expect(usePersonnelActionsStore.getState().selectedStatus).toBeNull());
    await pickStatus('On Scene');
    fireEvent.press(screen.getByTestId('update-button'));
    await waitFor(() => expect(mockSavePersonsStatuses).toHaveBeenCalledTimes(2));
    expect(mockSavePersonsStatuses.mock.calls[1][0]).toMatchObject({ Type: '3', RespondingTo: 'B', RespondingToType: DestinationEntityType.Call });
  });

  it("prefers the person's current destination call and re-initialises for the next person", async () => {
    useDispatchConsoleStore.setState({ selectedCallId: 'B', isCallFilterActive: true });
    const first = person('p1', 'A');
    const second = person('p2');
    act(() => {
      usePersonnelActionsStore.getState().openActions(first);
    });
    const view = render(<PersonnelActionsPanel personnel={first} />);
    await waitFor(() => expect(selectedCallInStore()).toBe('A'));

    view.rerender(<PersonnelActionsPanel personnel={second} />);
    act(() => {
      usePersonnelActionsStore.getState().openActions(second);
    });
    await waitFor(() => expect(selectedCallInStore()).toBe('B'));
  });

  it('does not send a leftover call with a status that does not support calls', async () => {
    const target = person('p1', 'A');
    act(() => {
      usePersonnelActionsStore.getState().openActions(target);
    });
    render(<PersonnelActionsPanel personnel={target} />);
    await waitFor(() => expect(selectedCallInStore()).toBe('A'));

    await pickStatus('Not Responding');
    fireEvent.press(screen.getByTestId('update-button'));
    await waitFor(() => expect(mockSavePersonsStatuses).toHaveBeenCalledTimes(1));
    expect(mockSavePersonsStatuses.mock.calls[0][0]).toMatchObject({ Type: '1', RespondingTo: '', RespondingToType: null });
  });
});
