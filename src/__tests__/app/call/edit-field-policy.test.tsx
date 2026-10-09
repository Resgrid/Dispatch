import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { getNewCallFieldPolicy } from '@/api/calls/newCallFieldPolicy';
import { CallResultData } from '@/models/v4/calls/callResultData';
import { NewCallFieldKeys } from '@/models/v4/calls/newCallFieldPolicyResultData';

import EditCall from '../../../app/call/[id]/edit';

const mockUpdateCall = jest.fn();
const mockToastShow = jest.fn();
const mockRouterBack = jest.fn();
let mockDetailState: Record<string, unknown> = {};
let mockProtocolModalProps: { onConfirm: (selected: { protocolId: string; answers: Record<string, string> }[]) => void } | null = null;
let mockLinkedCallsModalProps: { onSelect: (call: CallResultData) => void; excludeCallId?: string } | null = null;

jest.mock('@/api/calls/newCallFieldPolicy', () => ({ getNewCallFieldPolicy: jest.fn() }));
jest.mock('@/api/dispatch/dispatch', () => ({ getNewCallData: jest.fn(() => Promise.resolve({ Data: { DestinationPois: [] } })) }));
jest.mock('@/api/geocoding/geocoding', () => ({ forwardGeocode: jest.fn(), plusCodeLookup: jest.fn(), what3WordsLookup: jest.fn() }));
jest.mock('@/api/userDefinedFields/userDefinedFields', () => ({ saveUdfValues: jest.fn() }));
jest.mock('@/lib/logging', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() } }));
jest.mock('@/hooks/use-analytics', () => ({ useAnalytics: () => ({ trackEvent: jest.fn() }) }));

jest.mock('expo-router', () => ({
  router: { back: (...args: unknown[]) => mockRouterBack(...args), push: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: '42' }),
}));

jest.mock('nativewind', () => ({ useColorScheme: () => ({ colorScheme: 'light' }) }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options && typeof options === 'object' && 'fields' in options ? `${key}|${String(options.fields)}` : key),
  }),
}));

jest.mock('lucide-react-native', () => ({
  BookOpenIcon: () => null,
  ChevronDownIcon: () => null,
  ChevronUpIcon: () => null,
  LinkIcon: () => null,
  PlusIcon: () => null,
  SearchIcon: () => null,
}));

jest.mock('@/stores/app/core-store', () => ({ useCoreStore: () => ({ config: {} }) }));

jest.mock('@/stores/calls/store', () => {
  // One state object for every render, as zustand hands back: the screen's pre-fill effect depends on these lists.
  const state = {
    callPriorities: [{ Id: 1, Name: 'High', Color: '#f00' }],
    callTypes: [{ Id: 1, Name: 'Fire' }],
    isLoadingPriorities: false,
    isLoadingTypes: false,
    prioritiesError: null,
    typesError: null,
    fetchCallPriorities: jest.fn(),
    fetchCallTypes: jest.fn(),
  };
  return { useCallsStore: () => state };
});

jest.mock('@/stores/calls/detail-store', () => {
  const useCallDetailStore = () => mockDetailState;
  useCallDetailStore.getState = () => ({ updateCall: (...args: unknown[]) => mockUpdateCall(...args) });
  return { useCallDetailStore };
});

jest.mock('@/components/ui/toast', () => ({ useToast: () => ({ show: (...args: unknown[]) => mockToastShow(...args) }) }));

jest.mock('@/components/calls/dispatch-selection-modal', () => ({ DispatchSelectionModal: () => null }));
jest.mock('@/components/calls/udf-fields-renderer', () => ({ UdfFieldsRenderer: () => null }));
jest.mock('@/components/calls/protocol-selector-modal', () => ({
  ProtocolSelectorModal: (props: unknown) => {
    mockProtocolModalProps = props as typeof mockProtocolModalProps;
    return null;
  },
}));
jest.mock('@/components/calls/linked-calls-modal', () => ({
  LinkedCallsModal: (props: unknown) => {
    mockLinkedCallsModalProps = props as typeof mockLinkedCallsModalProps;
    return null;
  },
}));
jest.mock('@/components/common/loading', () => ({ Loading: () => null }));
// The shared date + time picker, reduced to its value: a text box holding the ISO UTC instant.
jest.mock('@/components/common/date-time-field', () => {
  const { TextInput } = require('react-native');
  const react = require('react');
  return {
    DateTimeField: ({ value, onChange, testID, clearable = true }: { value: string; onChange: (value: string) => void; testID?: string; clearable?: boolean }) =>
      react.createElement(TextInput, { testID, value, onChangeText: onChange, clearable }),
  };
});
jest.mock('@/components/maps/full-screen-location-picker', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/maps/location-picker', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/ui/bottom-sheet', () => ({ CustomBottomSheet: () => null }));

jest.mock('@/components/ui/box', () => {
  const { View } = require('react-native');
  return { Box: ({ children }: { children?: React.ReactNode }) => require('react').createElement(View, null, children) };
});
jest.mock('@/components/ui/card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: { children?: React.ReactNode }) => require('react').createElement(View, null, children) };
});
jest.mock('@/components/ui/text', () => {
  const { Text } = require('react-native');
  return { Text: ({ children }: { children?: React.ReactNode }) => require('react').createElement(Text, null, children) };
});
jest.mock('@/components/ui/button', () => {
  const { Pressable, Text } = require('react-native');
  const react = require('react');
  return {
    Button: ({ children, onPress, isDisabled }: { children?: React.ReactNode; onPress?: () => void; isDisabled?: boolean }) =>
      react.createElement(Pressable, { onPress, disabled: !!isDisabled, accessibilityState: { disabled: !!isDisabled } }, children),
    ButtonText: ({ children }: { children?: React.ReactNode }) => react.createElement(Text, null, children),
  };
});
jest.mock('@/components/ui/form-control', () => {
  const { Text, View } = require('react-native');
  const react = require('react');
  const passthrough = ({ children }: { children?: React.ReactNode }) => react.createElement(View, null, children);
  return {
    // Renders a marker for a required control, standing in for the label asterisk gluestack adds.
    FormControl: ({ children, isRequired }: { children?: React.ReactNode; isRequired?: boolean }) => react.createElement(View, null, children, isRequired ? react.createElement(Text, null, 'required-marker') : null),
    FormControlError: passthrough,
    FormControlLabel: passthrough,
    FormControlLabelText: ({ children }: { children?: React.ReactNode }) => react.createElement(Text, null, children),
  };
});
jest.mock('@/components/ui/input', () => {
  const { TextInput, View } = require('react-native');
  const react = require('react');
  return {
    Input: ({ children }: { children?: React.ReactNode }) => react.createElement(View, null, children),
    InputField: (props: Record<string, unknown>) => react.createElement(TextInput, props),
  };
});
jest.mock('@/components/ui/textarea', () => {
  const { TextInput, View } = require('react-native');
  const react = require('react');
  return {
    Textarea: ({ children }: { children?: React.ReactNode }) => react.createElement(View, null, children),
    TextareaInput: (props: Record<string, unknown>) => react.createElement(TextInput, props),
  };
});
jest.mock('@/components/ui/select', () => ({
  Select: () => null,
  SelectBackdrop: () => null,
  SelectContent: () => null,
  SelectIcon: () => null,
  SelectInput: () => null,
  SelectItem: () => null,
  SelectPortal: () => null,
  SelectTrigger: () => null,
}));
jest.mock('@/components/ui/switch', () => ({ Switch: () => null }));

const mockedGetPolicy = getNewCallFieldPolicy as jest.Mock;

const makeCall = (overrides: Partial<CallResultData> = {}): CallResultData =>
  Object.assign(new CallResultData(), {
    CallId: '42',
    Number: '26-42',
    Name: 'Structure Fire',
    Nature: 'Smoke showing',
    Priority: 1,
    Type: 'Fire',
    State: 0,
    Note: 'stored note',
    Address: '1 Main St',
    ContactName: 'Ann',
    ContactInfo: '',
    What3Words: 'filled.count.soap',
    ExternalId: 'EXT-1',
    IncidentId: 'INC-7',
    ReferenceId: 'REF-1',
    DestinationPoiId: 9,
    ...overrides,
  });

const renderEdit = async (rules: { Key: string; Visible: boolean; Required: boolean }[], call: CallResultData = makeCall(), extraData: Record<string, unknown> = { Dispatches: [{ Type: 'Unit', Id: '5' }], Protocols: [] }) => {
  mockedGetPolicy.mockResolvedValue({ Rules: rules });
  mockDetailState = { call, callExtraData: extraData, isLoading: false, error: null, fetchCallDetail: jest.fn() };

  const screen = render(<EditCall />);
  // Let the policy lookup and the destination list settle.
  await waitFor(() => expect(mockedGetPolicy).toHaveBeenCalled());
  await act(async () => {
    await Promise.resolve();
  });

  return screen;
};

/** All text in a React element tree, without rendering it (a second render would replace the screen's). */
const textOf = (node: unknown): string => {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return textOf((node as { props?: { children?: unknown } }).props?.children);
};

/** The text of the n-th toast the screen raised. */
const toastText = (index = 0): string => textOf(mockToastShow.mock.calls[index][0].render());

describe('Edit call screen and the call field policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProtocolModalProps = null;
    mockLinkedCallsModalProps = null;
    mockUpdateCall.mockResolvedValue(undefined);
  });

  it('hides the fields the department turned off and offers protocols and linked call', async () => {
    const { queryByPlaceholderText, queryByText, getByPlaceholderText, getByText } = await renderEdit([
      { Key: NewCallFieldKeys.Note, Visible: false, Required: false },
      { Key: NewCallFieldKeys.ContactInfo, Visible: false, Required: false },
      { Key: NewCallFieldKeys.Protocols, Visible: false, Required: false },
    ]);

    await waitFor(() => expect(queryByPlaceholderText('calls.note_placeholder')).toBeNull());
    expect(queryByPlaceholderText('calls.contact_info_placeholder')).toBeNull();
    expect(getByPlaceholderText('calls.contact_name_placeholder')).toBeTruthy();
    expect(queryByText('calls.protocols.title')).toBeNull();
    expect(getByText('calls.linked_calls.title')).toBeTruthy();
    // The call being edited cannot be linked to itself.
    expect(mockLinkedCallsModalProps?.excludeCallId).toBe('42');
  });

  it('offers every field the new-call screen does, pre-filled from the call', async () => {
    const { getByTestId, getByPlaceholderText } = await renderEdit([]);

    await waitFor(() => expect(getByTestId('incident-id-input').props.value).toBe('INC-7'));
    expect(getByTestId('external-id-input').props.value).toBe('EXT-1');
    expect(getByTestId('reference-id-input').props.value).toBe('REF-1');
    expect(getByTestId('what3words-input').props.value).toBe('filled.count.soap');
    // A plus code is never stored, so it starts blank.
    expect(getByTestId('plus-code-input').props.value).toBe('');
    expect(getByPlaceholderText('calls.note_placeholder').props.value).toBe('stored note');
  });

  it('hides the identifier and lookup inputs the department turned off', async () => {
    const { queryByTestId, getByTestId } = await renderEdit([
      { Key: NewCallFieldKeys.IncidentId, Visible: false, Required: false },
      { Key: NewCallFieldKeys.PlusCode, Visible: false, Required: false },
    ]);

    await waitFor(() => expect(queryByTestId('incident-id-input')).toBeNull());
    expect(queryByTestId('plus-code-input')).toBeNull();
    expect(getByTestId('external-id-input')).toBeTruthy();
    expect(getByTestId('what3words-input')).toBeTruthy();
  });

  it('marks the fields the department requires', async () => {
    const { getAllByText } = await renderEdit([
      { Key: NewCallFieldKeys.Address, Visible: true, Required: true },
      { Key: NewCallFieldKeys.ContactName, Visible: true, Required: true },
    ]);

    await waitFor(() => expect(getAllByText('required-marker')).toHaveLength(2));
  });

  it('refuses a save that would leave a required field blank', async () => {
    const { getByText } = await renderEdit([{ Key: NewCallFieldKeys.ContactInfo, Visible: true, Required: true }]);

    fireEvent.press(getByText('common.save'));

    await waitFor(() => expect(mockToastShow).toHaveBeenCalled());
    expect(mockUpdateCall).not.toHaveBeenCalled();
    expect(toastText()).toBe('calls.required_fields_missing_edit|calls.contact_info');
  });

  it('lets a required identifier be filled in on the edit and sends it', async () => {
    const { getByText, getByTestId } = await renderEdit([{ Key: NewCallFieldKeys.IncidentId, Visible: true, Required: true }], makeCall({ IncidentId: '' }));

    fireEvent.press(getByText('common.save'));
    await waitFor(() => expect(mockToastShow).toHaveBeenCalled());
    expect(toastText()).toBe('calls.required_fields_missing_edit|calls.incident_id');
    expect(mockUpdateCall).not.toHaveBeenCalled();

    fireEvent.changeText(getByTestId('incident-id-input'), 'INC-2026-99');
    fireEvent.press(getByText('common.save'));

    await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));
    expect(mockUpdateCall.mock.calls[0][0].incidentId).toBe('INC-2026-99');
    // The incident number is never sent as a linked call.
    expect(mockUpdateCall.mock.calls[0][0].linkedCallId).toBe('');
  });

  it('keeps hidden fields as stored and sends the protocols and link it adds', async () => {
    const { getByText } = await renderEdit([
      { Key: NewCallFieldKeys.Note, Visible: false, Required: false },
      { Key: NewCallFieldKeys.DestinationPoi, Visible: false, Required: false },
      { Key: NewCallFieldKeys.ExternalId, Visible: false, Required: false },
      { Key: NewCallFieldKeys.DispatchList, Visible: false, Required: false },
    ]);

    act(() => {
      mockProtocolModalProps?.onConfirm([{ protocolId: '3', answers: {} }]);
      mockLinkedCallsModalProps?.onSelect(Object.assign(new CallResultData(), { CallId: '17', Number: '26-17', Name: 'Earlier call' }));
    });

    fireEvent.press(getByText('common.save'));

    await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));
    const request = mockUpdateCall.mock.calls[0][0];

    expect(request.callId).toBe('42');
    // Hidden: sent as unchanged, never as the (invisible) form value.
    expect(request.note).toBe('');
    expect(request.destinationPoiId).toBe(9);
    expect(request.externalId).toBe('');
    // A hidden dispatch list resends the recipients loaded from the call: blank means "everyone" to older servers.
    expect(request.dispatchUnits).toEqual(['5']);
    // Visible: sent as the form holds them.
    expect(request.address).toBe('1 Main St');
    expect(request.incidentId).toBe('INC-7');
    expect(request.referenceId).toBe('REF-1');
    expect(request.what3words).toBe('filled.count.soap');
    expect(request.protocolIds).toEqual([3]);
    expect(request.linkedCallId).toBe('17');
    expect(mockRouterBack).toHaveBeenCalled();
  });

  it('sends a blank link and no protocols when none are picked, so the server checks what the call has', async () => {
    const { getByText } = await renderEdit([]);

    fireEvent.press(getByText('common.save'));

    await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));
    expect(mockUpdateCall.mock.calls[0][0].linkedCallId).toBe('');
    expect(mockUpdateCall.mock.calls[0][0].protocolIds).toEqual([]);
  });

  it('does not require recipients on a pending call', async () => {
    const { getByText } = await renderEdit([{ Key: NewCallFieldKeys.DispatchList, Visible: true, Required: true }], makeCall({ State: 8 }), { Dispatches: [], Protocols: [] });

    fireEvent.press(getByText('common.save'));

    await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));
  });

  describe('scheduled dispatch', () => {
    const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60 * 1000).toISOString();
    // The API leaves the zone off; it is still UTC.
    const zoneless = (iso: string) => iso.replace('Z', '');

    it('starts with the stored dispatch time while the call is still scheduled', async () => {
      const scheduledFor = minutesFromNow(120);
      const { getByTestId } = await renderEdit([], makeCall({ DispatchedOnUtc: zoneless(scheduledFor) }));

      await waitFor(() => expect(getByTestId('scheduled-on-input').props.value).toBe(scheduledFor));
      // EditCall cannot remove a schedule, so the picker offers no clear that would only look like it worked.
      expect(getByTestId('scheduled-on-input').props.clearable).toBe(false);
    });

    it('starts blank (and clearable) for a call that already went out', async () => {
      const { getByTestId } = await renderEdit([], makeCall({ DispatchedOnUtc: zoneless(minutesFromNow(-30)) }));

      await waitFor(() => expect(getByTestId('scheduled-on-input').props.value).toBe(''));
      expect(getByTestId('scheduled-on-input').props.clearable).toBe(true);
    });

    it('is hidden when the department turned it off', async () => {
      const { queryByTestId } = await renderEdit([{ Key: NewCallFieldKeys.DispatchOn, Visible: false, Required: false }]);

      await waitFor(() => expect(queryByTestId('scheduled-on-input')).toBeNull());
    });

    it('refuses a new time less than 15 minutes ahead', async () => {
      const { getByTestId, getByText } = await renderEdit([]);

      fireEvent.changeText(getByTestId('scheduled-on-input'), minutesFromNow(10));
      fireEvent.press(getByText('common.save'));

      await waitFor(() => expect(mockToastShow).toHaveBeenCalled());
      expect(toastText()).toBe('calls.scheduled_on_too_soon');
      expect(mockUpdateCall).not.toHaveBeenCalled();
    });

    it('sends a newly picked time as DispatchOnUtc', async () => {
      const { getByTestId, getByText } = await renderEdit([]);
      const pickedTime = minutesFromNow(60);

      fireEvent.changeText(getByTestId('scheduled-on-input'), pickedTime);
      fireEvent.press(getByText('common.save'));

      await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));
      expect(mockUpdateCall.mock.calls[0][0].dispatchOnUtc).toBe(pickedTime);
    });

    it('does not resend (or re-check) an unchanged time, so the schedule stays as it is', async () => {
      // Ten minutes away: too soon to pick now, but it is the call's existing schedule.
      const { getByText } = await renderEdit([], makeCall({ DispatchedOnUtc: zoneless(minutesFromNow(10)) }));

      fireEvent.press(getByText('common.save'));

      await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));
      expect(mockUpdateCall.mock.calls[0][0].dispatchOnUtc).toBeUndefined();
    });

    it('is never required on an edit', async () => {
      const { getByText } = await renderEdit([{ Key: NewCallFieldKeys.DispatchOn, Visible: true, Required: true }]);

      fireEvent.press(getByText('common.save'));

      await waitFor(() => expect(mockUpdateCall).toHaveBeenCalledTimes(1));
      expect(mockUpdateCall.mock.calls[0][0].dispatchOnUtc).toBeUndefined();
    });
  });

  it('names the fields the server refused the edit for', async () => {
    mockUpdateCall.mockRejectedValue(Object.assign(new Error('Request failed with status code 400'), { response: { status: 400, data: 'Required call fields are missing: linkedCall' } }));
    const { getByText } = await renderEdit([{ Key: NewCallFieldKeys.LinkedCall, Visible: true, Required: true }]);

    fireEvent.press(getByText('common.save'));

    await waitFor(() => expect(mockToastShow).toHaveBeenCalled());
    expect(toastText()).toBe('calls.required_fields_missing_edit|calls.linked_calls.title');
    expect(mockRouterBack).not.toHaveBeenCalled();
  });
});
