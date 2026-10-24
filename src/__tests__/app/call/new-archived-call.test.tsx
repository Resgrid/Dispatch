import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createArchivedCall } from '@/api/calls/calls';

import NewArchivedCall from '../../../app/call/new/archived';

const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();
const mockShowYear = jest.fn();
let mockDispatchModalProps: { onConfirm: (selection: { everyone: boolean; users: string[]; groups: string[]; roles: string[]; units: string[] }) => void } | null = null;

jest.mock('@/api/calls/calls', () => ({ createArchivedCall: jest.fn() }));
jest.mock('@/hooks/use-analytics', () => ({ useAnalytics: () => ({ trackEvent: jest.fn() }) }));
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ error: (...args: unknown[]) => mockToastError(...args), success: (...args: unknown[]) => mockToastSuccess(...args), warning: jest.fn(), info: jest.fn(), show: jest.fn() }),
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) }, Stack: { Screen: () => null } }));
jest.mock('nativewind', () => ({ useColorScheme: () => ({ colorScheme: 'light' }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: unknown) => (options && typeof options === 'object' && 'fields' in options ? `${key}|${String((options as { fields: unknown }).fields)}` : key),
  }),
}));

jest.mock('@/stores/calls/store', () => {
  const state = {
    callPriorities: [
      { Id: 1, Name: 'Low', Color: '#0f0', IsDefault: false },
      { Id: 3, Name: 'High', Color: '#f00', IsDefault: true },
    ],
    callTypes: [{ Id: '1', Name: 'Fire' }],
    fetchCallPriorities: jest.fn(),
    fetchCallTypes: jest.fn(),
  };
  return { useCallsStore: (selector: (s: typeof state) => unknown) => selector(state) };
});
jest.mock('@/stores/calls/archived-store', () => ({
  useArchivedCallsStore: { getState: () => ({ showYear: (...args: unknown[]) => mockShowYear(...args) }) },
}));

jest.mock('@/components/calls/dispatch-selection-modal', () => ({
  DispatchSelectionModal: (props: unknown) => {
    mockDispatchModalProps = props as typeof mockDispatchModalProps;
    return null;
  },
}));
jest.mock('@/components/common/date-time-field', () => {
  const { TextInput } = require('react-native');
  const react = require('react');
  return {
    DateTimeField: ({ value, onChange, testID }: { value: string; onChange: (value: string) => void; testID?: string }) => react.createElement(TextInput, { testID, value, onChangeText: onChange }),
  };
});
jest.mock('@/components/operations/option-select', () => {
  const { Pressable, Text, View } = require('react-native');
  const react = require('react');
  return {
    OptionSelect: ({ value, options, onChange, testID }: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; testID?: string }) =>
      react.createElement(
        View,
        { testID },
        react.createElement(Text, { testID: `${testID}-value` }, value),
        ...options.map((option) => react.createElement(Pressable, { key: option.value, testID: `${testID}-${option.value}`, onPress: () => onChange(option.value) }, react.createElement(Text, null, option.label)))
      ),
  };
});
jest.mock('@/components/ui/focus-aware-status-bar', () => ({ FocusAwareStatusBar: () => null }));
jest.mock('@/components/ui/lucide-icons', () => ({ UsersIcon: () => null }));
jest.mock('@/components/ui/card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: { children?: React.ReactNode }) => require('react').createElement(View, null, children) };
});
jest.mock('@/components/ui/button', () => {
  const { Pressable, Text } = require('react-native');
  const react = require('react');
  return {
    Button: ({ children, onPress, isDisabled, testID }: { children?: React.ReactNode; onPress?: () => void; isDisabled?: boolean; testID?: string }) => react.createElement(Pressable, { onPress, disabled: !!isDisabled, testID }, children),
    ButtonText: ({ children }: { children?: React.ReactNode }) => react.createElement(Text, null, children),
  };
});
jest.mock('@/components/ui/box', () => {
  const { View } = require('react-native');
  return { Box: ({ children }: { children?: React.ReactNode }) => require('react').createElement(View, null, children) };
});
jest.mock('@/components/ui/text', () => {
  const { Text } = require('react-native');
  return { Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => require('react').createElement(Text, { testID }, children) };
});
jest.mock('@/components/ui/form-control', () => {
  const { Text, View } = require('react-native');
  const react = require('react');
  const passthrough = ({ children }: { children?: React.ReactNode }) => react.createElement(View, null, children);
  return {
    FormControl: passthrough,
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
jest.mock('@/components/ui/switch', () => {
  const { Switch } = require('react-native');
  return { Switch };
});

const mockCreateArchivedCall = createArchivedCall as jest.MockedFunction<typeof createArchivedCall>;

const fillRequired = () => {
  fireEvent.changeText(screen.getByTestId('archived-call-name'), 'Structure Fire');
  fireEvent.changeText(screen.getByTestId('archived-call-nature'), 'Smoke showing');
  fireEvent.changeText(screen.getByTestId('archived-call-logged-on'), '2025-06-01T10:00:00.000Z');
};

describe('Add Archived Call', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDispatchModalProps = null;
    mockCreateArchivedCall.mockResolvedValue({ Id: '99' } as never);
  });

  it("starts on the department's default priority and the Closed close type", () => {
    render(<NewArchivedCall />);

    expect(screen.getByTestId('archived-call-priority-value').props.children).toBe('3');
    expect(screen.getByTestId('archived-call-state-value').props.children).toBe('1');
  });

  it('says what is missing instead of saving', async () => {
    render(<NewArchivedCall />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('archived-call-save'));
    });

    expect(mockToastError).toHaveBeenCalledWith('archived_calls.name_required');
    expect(mockCreateArchivedCall).not.toHaveBeenCalled();
  });

  it('refuses a call logged in the future', async () => {
    render(<NewArchivedCall />);
    fillRequired();
    fireEvent.changeText(screen.getByTestId('archived-call-logged-on'), new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

    await act(async () => {
      fireEvent.press(screen.getByTestId('archived-call-save'));
    });

    expect(mockToastError).toHaveBeenCalledWith('archived_calls.logged_on_future');
    expect(mockCreateArchivedCall).not.toHaveBeenCalled();
  });

  it('saves the call closed, with who it went to recorded, and opens the list on its year', async () => {
    const { router } = require('expo-router');
    render(<NewArchivedCall />);
    fillRequired();
    fireEvent.press(screen.getByTestId('archived-call-type-Fire'));
    fireEvent.press(screen.getByTestId('archived-call-state-7'));
    fireEvent.changeText(screen.getByTestId('archived-call-closed-on'), '2025-06-01T11:00:00.000Z');
    fireEvent.changeText(screen.getByTestId('archived-call-closed-notes'), 'Detector fault');
    fireEvent(screen.getByTestId('archived-call-recalculate'), 'valueChange', true);
    act(() => {
      mockDispatchModalProps?.onConfirm({ everyone: false, users: ['u1'], groups: [], roles: [], units: ['5'] });
    });

    expect(screen.getByTestId('archived-call-dispatched-summary').props.children).toBe('archived_calls.dispatched_summary');

    await act(async () => {
      fireEvent.press(screen.getByTestId('archived-call-save'));
    });

    expect(mockCreateArchivedCall).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Structure Fire',
        nature: 'Smoke showing',
        priority: 3,
        type: 'Fire',
        state: 7,
        loggedOnUtc: '2025-06-01T10:00:00.000Z',
        closedOnUtc: '2025-06-01T11:00:00.000Z',
        closedNotes: 'Detector fault',
        recalculateCallNumbers: true,
        dispatchUsers: ['u1'],
        dispatchUnits: ['5'],
      })
    );
    expect(mockToastSuccess).toHaveBeenCalledWith('archived_calls.save_success');
    expect(mockShowYear).toHaveBeenCalledWith('2025');
    expect(router.back).toHaveBeenCalled();
  });

  it("shows the department's missing required fields when the server refuses the call", async () => {
    mockCreateArchivedCall.mockRejectedValueOnce({ isAxiosError: true, response: { status: 400, data: 'Required call fields are missing: Address' } });
    render(<NewArchivedCall />);
    fillRequired();

    await act(async () => {
      fireEvent.press(screen.getByTestId('archived-call-save'));
    });

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('calls.required_fields_missing')));
  });

  it('falls back to its own message when the server gives no reason', async () => {
    mockCreateArchivedCall.mockRejectedValueOnce(new Error('Network Error'));
    render(<NewArchivedCall />);
    fillRequired();

    await act(async () => {
      fireEvent.press(screen.getByTestId('archived-call-save'));
    });

    expect(mockToastError).toHaveBeenCalledWith('archived_calls.save_error');
  });
});
