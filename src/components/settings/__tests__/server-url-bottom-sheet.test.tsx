import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { ServerUrlBottomSheet } from '../server-url-bottom-sheet';

const mockGetSystemConfig = jest.fn();
const mockGetUrl = jest.fn();
const mockSetUrl = jest.fn();
let mockOnValueChange: ((value: string) => void) | undefined;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));
jest.mock('@/api/config', () => ({
  getSystemConfig: () => mockGetSystemConfig(),
}));
jest.mock('@/stores/app/server-url-store', () => ({
  useServerUrlStore: () => ({ getUrl: mockGetUrl, setUrl: mockSetUrl }),
}));
jest.mock('@/lib/env', () => ({ Env: { API_VERSION: 'v4' } }));
jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('lucide-react-native', () => ({ ChevronDownIcon: 'ChevronDownIcon' }));

jest.mock('../../ui/actionsheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Passthrough = ({ children }: any) => React.createElement(View, {}, children);
  return {
    Actionsheet: ({ children, isOpen }: any) => (isOpen ? React.createElement(View, { testID: 'actionsheet' }, children) : null),
    ActionsheetBackdrop: Passthrough,
    ActionsheetContent: Passthrough,
    ActionsheetDragIndicator: Passthrough,
    ActionsheetDragIndicatorWrapper: Passthrough,
  };
});
jest.mock('../../ui/button', () => {
  const React = require('react');
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    Button: ({ children, onPress, disabled }: any) => React.createElement(TouchableOpacity, { onPress, disabled }, children),
    ButtonText: ({ children }: any) => React.createElement(Text, {}, children),
    ButtonSpinner: () => React.createElement(View, { testID: 'button-spinner' }),
  };
});
jest.mock('../../ui/form-control', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  const Passthrough = ({ children }: any) => React.createElement(View, {}, children);
  return {
    FormControl: Passthrough,
    FormControlLabel: Passthrough,
    FormControlLabelText: ({ children }: any) => React.createElement(Text, {}, children),
    FormControlHelperText: Passthrough,
    FormControlError: Passthrough,
    FormControlErrorText: ({ children }: any) => React.createElement(Text, {}, children),
  };
});
jest.mock('../../ui/select', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  const Passthrough = ({ children }: any) => React.createElement(View, {}, children);
  return {
    Select: ({ children, onValueChange }: any) => {
      mockOnValueChange = onValueChange;
      return React.createElement(View, {}, children);
    },
    SelectBackdrop: Passthrough,
    SelectContent: Passthrough,
    SelectDragIndicator: Passthrough,
    SelectDragIndicatorWrapper: Passthrough,
    SelectIcon: Passthrough,
    SelectInput: ({ value }: any) => React.createElement(Text, { testID: 'select-input' }, value),
    SelectItem: ({ label, value }: any) => React.createElement(Text, { testID: `select-item-${value}` }, label),
    SelectPortal: Passthrough,
    SelectTrigger: Passthrough,
  };
});
jest.mock('../../ui/input', () => {
  const React = require('react');
  const { TextInput, View } = require('react-native');
  return {
    Input: ({ children }: any) => React.createElement(View, {}, children),
    InputField: (props: any) => React.createElement(TextInput, { testID: 'server-url-input', ...props }),
  };
});
jest.mock('../../ui/center', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { Center: ({ children }: any) => React.createElement(View, {}, children) };
});
jest.mock('../../ui/hstack', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { HStack: ({ children }: any) => React.createElement(View, {}, children) };
});
jest.mock('../../ui/vstack', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { VStack: ({ children }: any) => React.createElement(View, {}, children) };
});
jest.mock('../../ui/text', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Text: ({ children }: any) => React.createElement(Text, {}, children) };
});
jest.mock('../../ui/spinner', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { Spinner: () => React.createElement(View, { testID: 'spinner' }) };
});

const hostedConfig = {
  Data: {
    Locations: [
      { Name: 'US-West', DisplayName: 'Resgrid North America (Global)', LocationInfo: '', IsDefault: true, ApiUrl: 'https://api.resgrid.com', AllowsFreeAccounts: true },
      { Name: 'EU-Central', DisplayName: 'Resgrid Europe', LocationInfo: '', IsDefault: false, ApiUrl: 'https://api-eu-central.resgrid.com', AllowsFreeAccounts: false },
    ],
  },
};

describe('ServerUrlBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnValueChange = undefined;
    mockGetSystemConfig.mockResolvedValue(hostedConfig);
    mockGetUrl.mockResolvedValue('https://api.resgrid.com/api/v4');
    mockSetUrl.mockResolvedValue(undefined);
  });

  const renderSheet = (props: Partial<React.ComponentProps<typeof ServerUrlBottomSheet>> = {}) => render(<ServerUrlBottomSheet isOpen onClose={jest.fn()} {...props} />);

  it('lists the US-West and EU-Central sites plus a Custom option', async () => {
    renderSheet();

    expect(await screen.findByTestId('select-item-US-West')).toHaveTextContent('US-West');
    expect(screen.getByTestId('select-item-EU-Central')).toHaveTextContent('EU-Central');
    expect(screen.getByTestId('select-item-__custom__')).toHaveTextContent('settings.custom');
  });

  it('still lists the hosted sites when the configured server is unreachable', async () => {
    mockGetSystemConfig.mockRejectedValue(new Error('Network Error'));
    mockGetUrl.mockResolvedValue('https://offline.example.org/api/v4');

    renderSheet();

    expect(await screen.findByTestId('select-item-US-West')).toBeTruthy();
    expect(screen.getByTestId('select-item-EU-Central')).toBeTruthy();
    expect(screen.getByTestId('select-input')).toHaveTextContent('settings.custom');
    expect(screen.getByTestId('server-url-input').props.value).toBe('https://offline.example.org');
  });

  it('preselects the hosted site matching the saved url', async () => {
    mockGetUrl.mockResolvedValue('https://api-eu-central.resgrid.com/api/v4');

    renderSheet();

    await waitFor(() => expect(screen.getByTestId('select-input')).toHaveTextContent('EU-Central'));
    expect(screen.getByTestId('server-url-input').props.value).toBe('https://api-eu-central.resgrid.com');
    expect(screen.getByTestId('server-url-input').props.editable).toBe(false);
  });

  it('saves the selected hosted site and reports the server change', async () => {
    const onClose = jest.fn();
    const onUrlChanged = jest.fn().mockResolvedValue(undefined);
    renderSheet({ onClose, onUrlChanged });
    await screen.findByTestId('select-item-EU-Central');

    act(() => mockOnValueChange?.('EU-Central'));
    fireEvent.press(screen.getByText('common.save'));

    await waitFor(() => expect(mockSetUrl).toHaveBeenCalledWith('https://api-eu-central.resgrid.com/api/v4'));
    await waitFor(() => expect(onUrlChanged).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not report a change when the same server is saved again', async () => {
    const onClose = jest.fn();
    const onUrlChanged = jest.fn();
    renderSheet({ onClose, onUrlChanged });
    await waitFor(() => expect(screen.getByTestId('select-input')).toHaveTextContent('US-West'));

    fireEvent.press(screen.getByText('common.save'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockSetUrl).toHaveBeenCalledWith('https://api.resgrid.com/api/v4');
    expect(onUrlChanged).not.toHaveBeenCalled();
  });

  it('saves a custom url with the api suffix', async () => {
    const onClose = jest.fn();
    renderSheet({ onClose });
    await screen.findByTestId('select-item-__custom__');

    act(() => mockOnValueChange?.('__custom__'));
    fireEvent.changeText(await screen.findByTestId('server-url-input'), 'https://resgrid.example.org/');
    fireEvent.press(screen.getByText('common.save'));

    await waitFor(() => expect(mockSetUrl).toHaveBeenCalledWith('https://resgrid.example.org/api/v4'));
    expect(onClose).toHaveBeenCalled();
  });

  it('rejects a non-https custom url', async () => {
    renderSheet();
    await screen.findByTestId('select-item-__custom__');

    act(() => mockOnValueChange?.('__custom__'));
    fireEvent.changeText(await screen.findByTestId('server-url-input'), 'http://resgrid.example.org');
    fireEvent.press(screen.getByText('common.save'));

    expect(await screen.findByText('form.invalid_url')).toBeTruthy();
    expect(mockSetUrl).not.toHaveBeenCalled();
  });
});
