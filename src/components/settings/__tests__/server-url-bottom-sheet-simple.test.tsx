import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { ServerUrlBottomSheet } from '../server-url-bottom-sheet';

// Mock all dependencies with minimal implementations
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn().mockImplementation((obj) => obj.ios || obj.default),
  },
  ScrollView: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('View', { testID: 'scroll-view', ...props }, children);
  },
}));

jest.mock('react-hook-form', () => ({
  useForm: () => ({
    control: {},
    handleSubmit: jest.fn(),
    setValue: jest.fn(),
    formState: { errors: {} },
  }),
  Controller: ({ render }: any) => render({ field: { onChange: jest.fn(), value: '' } }),
}));

jest.mock('@/stores/app/server-url-store', () => ({
  useServerUrlStore: () => ({
    getUrl: jest.fn().mockResolvedValue('https://example.com/api/v4'),
    setUrl: jest.fn(),
  }),
}));

jest.mock('@/lib/env', () => ({ Env: { API_VERSION: 'v4' } }));
jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));
jest.mock('@/api/config', () => ({
  getSystemConfig: jest.fn().mockResolvedValue({ Data: { Locations: [] } }),
}));
jest.mock('lucide-react-native', () => ({ ChevronDownIcon: 'ChevronDownIcon' }));

// Create mock UI component factory functions
const createMockUIComponent = (displayName: string) => ({ children, testID, ...props }: any) => {
  const React = require('react');
  return React.createElement('View', { testID: testID || displayName.toLowerCase(), ...props }, children);
};

const createMockTextComponent = (displayName: string) => ({ children, testID, ...props }: any) => {
  const React = require('react');
  return React.createElement('Text', { testID: testID || displayName.toLowerCase(), ...props }, children);
};

const createMockInputComponent = ({ testID, ...props }: any) => {
  const React = require('react');
  return React.createElement('TextInput', { testID: testID || 'input-field', ...props });
};

jest.mock('../../ui/actionsheet', () => ({
  Actionsheet: ({ children, isOpen }: any) => isOpen ? createMockUIComponent('Actionsheet')({ children }) : null,
  ActionsheetBackdrop: createMockUIComponent('ActionsheetBackdrop'),
  ActionsheetContent: createMockUIComponent('ActionsheetContent'),
  ActionsheetDragIndicator: createMockUIComponent('ActionsheetDragIndicator'),
  ActionsheetDragIndicatorWrapper: createMockUIComponent('ActionsheetDragIndicatorWrapper'),
}));

jest.mock('../../ui/button', () => ({
  Button: createMockUIComponent('Button'),
  ButtonText: createMockTextComponent('ButtonText'),
  ButtonSpinner: createMockUIComponent('ButtonSpinner'),
}));

jest.mock('../../ui/form-control', () => ({
  FormControl: createMockUIComponent('FormControl'),
  FormControlLabel: createMockUIComponent('FormControlLabel'),
  FormControlLabelText: createMockTextComponent('FormControlLabelText'),
  FormControlHelperText: createMockUIComponent('FormControlHelperText'),
  FormControlError: createMockUIComponent('FormControlError'),
  FormControlErrorText: createMockTextComponent('FormControlErrorText'),
}));

jest.mock('../../ui/center', () => ({ Center: createMockUIComponent('Center') }));
jest.mock('../../ui/hstack', () => ({ HStack: createMockUIComponent('HStack') }));
jest.mock('../../ui/input', () => ({
  Input: createMockUIComponent('Input'),
  InputField: createMockInputComponent,
}));
jest.mock('../../ui/text', () => ({ Text: createMockTextComponent('Text') }));
jest.mock('../../ui/vstack', () => ({ VStack: createMockUIComponent('VStack') }));
jest.mock('../../ui/select', () => ({
  Select: createMockUIComponent('Select'),
  SelectBackdrop: createMockUIComponent('SelectBackdrop'),
  SelectContent: createMockUIComponent('SelectContent'),
  SelectDragIndicator: createMockUIComponent('SelectDragIndicator'),
  SelectDragIndicatorWrapper: createMockUIComponent('SelectDragIndicatorWrapper'),
  SelectIcon: createMockUIComponent('SelectIcon'),
  SelectInput: createMockUIComponent('SelectInput'),
  SelectItem: createMockUIComponent('SelectItem'),
  SelectPortal: createMockUIComponent('SelectPortal'),
  SelectTrigger: createMockUIComponent('SelectTrigger'),
}));
jest.mock('../../ui/spinner', () => ({ Spinner: createMockUIComponent('Spinner') }));

describe('ServerUrlBottomSheet - Simple', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
  };

  it('renders when open', () => {
    render(<ServerUrlBottomSheet {...defaultProps} />);
    expect(screen.getByTestId('actionsheet')).toBeTruthy();
  });

  it('does not render when closed', () => {
    render(<ServerUrlBottomSheet {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('actionsheet')).toBeNull();
  });

  it('renders input field with correct keyboard properties', () => {
    render(<ServerUrlBottomSheet {...defaultProps} />);

    const inputField = screen.getByTestId('input-field');
    expect(inputField.props.autoCapitalize).toBe('none');
    expect(inputField.props.autoCorrect).toBe(false);
    expect(inputField.props.keyboardType).toBe('url');
  });
});
