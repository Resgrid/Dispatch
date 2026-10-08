import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createCall } from '@/api/calls/calls';
import { getNewCallFieldPolicy } from '@/api/calls/newCallFieldPolicy';
import { NewCallFieldKeys } from '@/models/v4/calls/newCallFieldPolicyResultData';

import NewCall from '../../../app/call/new';

const mockToastError = jest.fn();
let mockTemplatesModalProps: { onSelect: (template: { name?: string; nature?: string; type?: string; priority?: number }) => void } | null = null;
let mockDispatchModalProps: { onConfirm: (selection: { everyone: boolean; users: string[]; groups: string[]; roles: string[]; units: string[] }) => void } | null = null;

jest.mock('@/api/calls/calls', () => ({ createCall: jest.fn() }));
jest.mock('@/api/calls/newCallFieldPolicy', () => ({ getNewCallFieldPolicy: jest.fn() }));
jest.mock('@/api/dispatch/dispatch', () => ({ getNewCallData: jest.fn(() => Promise.resolve({ Data: { DestinationPois: [] } })) }));
jest.mock('@/api/geocoding/geocoding', () => ({ forwardGeocode: jest.fn(), plusCodeLookup: jest.fn(), reverseGeocode: jest.fn(), what3WordsLookup: jest.fn() }));
jest.mock('@/api/userDefinedFields/userDefinedFields', () => ({ saveUdfValues: jest.fn() }));
jest.mock('@/lib/logging', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() } }));
jest.mock('@/hooks/use-analytics', () => ({ useAnalytics: () => ({ trackEvent: jest.fn() }) }));
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ error: (...args: unknown[]) => mockToastError(...args), success: jest.fn(), warning: jest.fn(), info: jest.fn(), show: jest.fn() }),
}));
jest.mock('expo-location', () => ({}));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() }, Stack: { Screen: () => null } }));
jest.mock('nativewind', () => ({ useColorScheme: () => ({ colorScheme: 'light' }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: unknown) => (options && typeof options === 'object' && 'fields' in options ? `${key}|${String((options as { fields: unknown }).fields)}` : key),
  }),
}));

jest.mock('@/stores/app/core-store', () => ({ useCoreStore: () => ({ config: {} }) }));
jest.mock('@/stores/calls/store', () => {
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
jest.mock('@/components/runcards/use-call-recommendation', () => ({
  useCallRecommendation: () => ({ isRunCardsEnabled: false, applyToSelection: (selection: unknown) => selection }),
}));
jest.mock('@/components/runcards/recommendation-panel', () => ({ RecommendationPanel: () => null }));

jest.mock('@/components/calls/call-templates-modal', () => ({
  CallTemplatesModal: (props: unknown) => {
    mockTemplatesModalProps = props as typeof mockTemplatesModalProps;
    return null;
  },
}));
jest.mock('@/components/calls/dispatch-selection-modal', () => ({
  DispatchSelectionModal: (props: unknown) => {
    mockDispatchModalProps = props as typeof mockDispatchModalProps;
    return null;
  },
}));
jest.mock('@/components/calls/contact-picker-modal', () => ({ ContactPickerModal: () => null }));
jest.mock('@/components/calls/linked-calls-modal', () => ({ LinkedCallsModal: () => null }));
jest.mock('@/components/calls/protocol-selector-modal', () => ({ ProtocolSelectorModal: () => null }));
jest.mock('@/components/calls/udf-fields-renderer', () => ({ UdfFieldsRenderer: () => null }));
jest.mock('@/components/common/loading', () => ({ Loading: () => null }));
jest.mock('@/components/common/date-time-field', () => {
  const { TextInput } = require('react-native');
  const react = require('react');
  return {
    DateTimeField: ({ value, onChange, testID }: { value: string; onChange: (value: string) => void; testID?: string }) => react.createElement(TextInput, { testID, value, onChangeText: onChange }),
  };
});
jest.mock('@/components/maps/full-screen-location-picker', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/maps/location-picker', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/ui/bottom-sheet', () => ({ CustomBottomSheet: () => null }));
jest.mock('@/components/ui/focus-aware-status-bar', () => ({ FocusAwareStatusBar: () => null }));
jest.mock('@/components/ui/lucide-icons', () => {
  const icon = () => null;
  return { BookOpenIcon: icon, ChevronDownIcon: icon, ChevronUpIcon: icon, FileTextIcon: icon, LinkIcon: icon, PlusIcon: icon, SearchIcon: icon, UserIcon: icon };
});
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
    Button: ({ children, onPress, isDisabled }: { children?: React.ReactNode; onPress?: () => void; isDisabled?: boolean }) => react.createElement(Pressable, { onPress, disabled: !!isDisabled }, children),
    ButtonText: ({ children }: { children?: React.ReactNode }) => react.createElement(Text, null, children),
  };
});
jest.mock('@/components/ui/form-control', () => {
  const { Text, View } = require('react-native');
  const react = require('react');
  const passthrough = ({ children }: { children?: React.ReactNode }) => react.createElement(View, null, children);
  return {
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
jest.mock('@/components/ui/switch', () => {
  const { Pressable } = require('react-native');
  const react = require('react');
  return {
    Switch: ({ value, onValueChange, testID }: { value: boolean; onValueChange: (value: boolean) => void; testID?: string }) => react.createElement(Pressable, { testID, onPress: () => onValueChange(!value) }),
  };
});

const mockedGetPolicy = getNewCallFieldPolicy as jest.Mock;
const mockedCreateCall = createCall as jest.Mock;

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60 * 1000).toISOString();

const renderNewCall = async (rules: { Key: string; Visible: boolean; Required: boolean }[]) => {
  mockedGetPolicy.mockResolvedValue({ Rules: rules });

  const screen = render(<NewCall />);
  await waitFor(() => expect(mockedGetPolicy).toHaveBeenCalled());
  await act(async () => {
    await Promise.resolve();
  });

  // Name, nature, priority and type are always required; a template fills them in.
  act(() => {
    mockTemplatesModalProps?.onSelect({ name: 'Structure Fire', nature: 'Smoke showing', type: 'Fire', priority: 1 });
  });

  return screen;
};

const pickUnit = () =>
  act(() => {
    mockDispatchModalProps?.onConfirm({ everyone: false, users: [], groups: [], roles: [], units: ['5'] });
  });

describe('New call screen and the call field policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTemplatesModalProps = null;
    mockDispatchModalProps = null;
    mockedCreateCall.mockResolvedValue({ Id: '101' });
  });

  it('offers the identifiers, gated by the policy', async () => {
    const { getByText, getByTestId, queryByTestId } = await renderNewCall([{ Key: NewCallFieldKeys.ReferenceId, Visible: false, Required: false }]);

    // The identifiers sit in the (collapsed) contact section, as on the web form.
    fireEvent.press(getByText('calls.contact_information'));

    await waitFor(() => expect(getByTestId('incident-id-input')).toBeTruthy());
    expect(getByTestId('external-id-input')).toBeTruthy();
    expect(queryByTestId('reference-id-input')).toBeNull();
  });

  it('sends the identifiers, contact fields, link and protocol pickers and dispatch time', async () => {
    const { getByText, getByTestId, getByPlaceholderText } = await renderNewCall([]);
    const pickedTime = minutesFromNow(60);

    fireEvent.press(getByText('calls.contact_information'));
    await waitFor(() => expect(getByTestId('incident-id-input')).toBeTruthy());
    fireEvent.changeText(getByTestId('incident-id-input'), 'INC-2026-12');
    fireEvent.changeText(getByTestId('external-id-input'), 'CAD-77');
    fireEvent.changeText(getByPlaceholderText('calls.contact_name_placeholder'), 'Ann Caller');
    fireEvent.changeText(getByPlaceholderText('calls.contact_info_placeholder'), '555-0100');
    fireEvent.changeText(getByTestId('scheduled-on-input'), pickedTime);
    pickUnit();

    fireEvent.press(getByText('calls.create'));

    await waitFor(() => expect(mockedCreateCall).toHaveBeenCalledTimes(1));
    const request = mockedCreateCall.mock.calls[0][0];

    expect(request.incidentId).toBe('INC-2026-12');
    expect(request.externalId).toBe('CAD-77');
    expect(request.contactName).toBe('Ann Caller');
    expect(request.contactInfo).toBe('555-0100');
    expect(request.dispatchOnUtc).toBe(pickedTime);
    // The pickers are on screen, so both go up (blank / empty) and the server enforces them.
    expect(request.linkedCallId).toBe('');
    expect(request.protocolIds).toEqual([]);
    expect(request.dispatchUnits).toEqual(['5']);
  });

  it('sends no dispatch time when none was picked', async () => {
    const { getByText } = await renderNewCall([]);
    pickUnit();

    fireEvent.press(getByText('calls.create'));

    await waitFor(() => expect(mockedCreateCall).toHaveBeenCalledTimes(1));
    expect(mockedCreateCall.mock.calls[0][0].dispatchOnUtc).toBeUndefined();
  });

  it('refuses a dispatch time less than 15 minutes ahead', async () => {
    const { getByText, getByTestId } = await renderNewCall([]);

    fireEvent.changeText(getByTestId('scheduled-on-input'), minutesFromNow(5));
    pickUnit();
    fireEvent.press(getByText('calls.create'));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('calls.scheduled_on_too_soon'));
    expect(mockedCreateCall).not.toHaveBeenCalled();
  });

  it('marks and requires the dispatch time when the department does', async () => {
    const { getByText, getAllByText } = await renderNewCall([{ Key: NewCallFieldKeys.DispatchOn, Visible: true, Required: true }]);
    pickUnit();

    expect(getAllByText('required-marker').length).toBeGreaterThan(0);
    fireEvent.press(getByText('calls.create'));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('calls.required_fields_missing|calls.scheduled_on'));
    expect(mockedCreateCall).not.toHaveBeenCalled();
  });

  it('does not require (or send) a dispatch time for a pending call, and hides the picker', async () => {
    const { getByText, getByTestId, queryByTestId } = await renderNewCall([{ Key: NewCallFieldKeys.DispatchOn, Visible: true, Required: true }]);

    fireEvent.changeText(getByTestId('scheduled-on-input'), minutesFromNow(5));
    fireEvent.press(getByTestId('save-as-pending-switch'));

    await waitFor(() => expect(queryByTestId('scheduled-on-input')).toBeNull());
    fireEvent.press(getByText('calls.save_pending_call'));

    await waitFor(() => expect(mockedCreateCall).toHaveBeenCalledTimes(1));
    expect(mockedCreateCall.mock.calls[0][0].isPending).toBe(true);
    expect(mockedCreateCall.mock.calls[0][0].dispatchOnUtc).toBeUndefined();
  });

  it('hides the dispatch time when the department turned it off', async () => {
    const { queryByTestId } = await renderNewCall([{ Key: NewCallFieldKeys.DispatchOn, Visible: false, Required: false }]);

    await waitFor(() => expect(queryByTestId('scheduled-on-input')).toBeNull());
  });

  it('does not hold a call back for an indoor location it has no picker for', async () => {
    const { getByText } = await renderNewCall([{ Key: NewCallFieldKeys.IndoorLocation, Visible: true, Required: true }]);
    pickUnit();

    fireEvent.press(getByText('calls.create'));

    await waitFor(() => expect(mockedCreateCall).toHaveBeenCalledTimes(1));
  });

  it('names the fields the server refused the call for', async () => {
    mockedCreateCall.mockRejectedValue(Object.assign(new Error('Request failed with status code 400'), { response: { status: 400, data: 'Required call fields are missing: indoorLocation' } }));
    const { getByText } = await renderNewCall([]);
    pickUnit();

    fireEvent.press(getByText('calls.create'));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('calls.required_fields_missing|calls.indoor_location'));
  });
});
