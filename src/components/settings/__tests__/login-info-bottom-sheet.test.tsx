// Mock Platform first, before any other imports
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn().mockImplementation((obj) => obj.ios || obj.default),
}));

import { render, screen, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { LoginInfoBottomSheet } from '../login-info-bottom-sheet';

// Mock dependencies
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: () => ({
    colorScheme: 'light',
  }),
}));

jest.mock('react-native', () => ({
  useWindowDimensions: () => ({
    width: 400,
    height: 800,
  }),
  Platform: {
    OS: 'ios',
    select: jest.fn().mockImplementation((obj) => obj.ios || obj.default),
  },
  KeyboardAvoidingView: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('View', { testID: 'keyboard-avoiding-view', ...props }, children);
  },
}));

jest.mock('react-hook-form', () => ({
  useForm: () => ({
    control: {},
    handleSubmit: (fn: any) => fn,
    formState: { errors: {} },
  }),
  Controller: ({ render, name }: any) => {
    const React = require('react');
    const field = { onChange: jest.fn(), value: '' };
    return render({ field });
  },
}));

// Mock UI components
jest.mock('../../ui/actionsheet', () => ({
  Actionsheet: ({ children, isOpen }: any) => {
    const React = require('react');
    return isOpen ? React.createElement('View', { testID: 'actionsheet' }, children) : null;
  },
  ActionsheetBackdrop: (props: any) => {
    const React = require('react');
    return React.createElement('View', { testID: 'actionsheet-backdrop' });
  },
  ActionsheetContent: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('View', { testID: 'actionsheet-content', ...props }, children);
  },
  ActionsheetDragIndicator: (props: any) => {
    const React = require('react');
    return React.createElement('View', { testID: 'actionsheet-drag-indicator' });
  },
  ActionsheetDragIndicatorWrapper: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('View', { testID: 'actionsheet-drag-indicator-wrapper', ...props }, children);
  },
}));

jest.mock('../../ui/button', () => ({
  Button: ({ children, onPress, disabled, ...props }: any) => {
    const React = require('react');
    return React.createElement('View', { onPress: disabled ? undefined : onPress, testID: 'button', ...props }, children);
  },
  ButtonText: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('Text', { testID: 'button-text', ...props }, children);
  },
  ButtonSpinner: (props: any) => {
    const React = require('react');
    return React.createElement('View', { testID: 'button-spinner' });
  },
}));

jest.mock('../../ui/form-control', () => ({
  FormControl: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('View', { testID: 'form-control', ...props }, children);
  },
  FormControlLabel: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('View', { testID: 'form-control-label', ...props }, children);
  },
  FormControlLabelText: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('Text', { testID: 'form-control-label-text', ...props }, children);
  },
}));

jest.mock('../../ui/hstack', () => ({
  HStack: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('View', { testID: 'hstack', ...props }, children);
  },
}));

jest.mock('../../ui/input', () => ({
  Input: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('View', { testID: 'input', ...props }, children);
  },
  InputField: ({ onChangeText, value, placeholder, autoCapitalize, autoCorrect, textContentType, autoComplete, type, ...props }: any) => {
    const React = require('react');
    return React.createElement('TextInput', {
      testID: 'input-field',
      onChangeText,
      value,
      placeholder,
      autoCapitalize,
      autoCorrect,
      textContentType,
      autoComplete,
      secureTextEntry: type === 'password',
      ...props,
    });
  },
}));

jest.mock('../../ui/vstack', () => ({
  VStack: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('View', { testID: 'vstack', ...props }, children);
  },
}));

describe('LoginInfoBottomSheet', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSubmit: mockOnSubmit,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly when open', () => {
    render(<LoginInfoBottomSheet {...defaultProps} />);

    expect(screen.getByTestId('actionsheet')).toBeTruthy();
    expect(screen.getByTestId('actionsheet-content')).toBeTruthy();
    expect(screen.getByTestId('keyboard-avoiding-view')).toBeTruthy();
    expect(screen.getByText('settings.username')).toBeTruthy();
    expect(screen.getByText('settings.password')).toBeTruthy();
  });

  it('does not render when closed', () => {
    render(<LoginInfoBottomSheet {...defaultProps} isOpen={false} />);

    expect(screen.queryByTestId('actionsheet')).toBeNull();
  });

  it('renders username field with correct properties', () => {
    render(<LoginInfoBottomSheet {...defaultProps} />);

    const usernameFields = screen.getAllByTestId('input-field');
    const usernameField = usernameFields[0]; // First input field is username

    expect(usernameField.props.autoCapitalize).toBe('none');
    expect(usernameField.props.autoCorrect).toBe(false);
    expect(usernameField.props.textContentType).toBe('username');
    expect(usernameField.props.autoComplete).toBe('username');
    expect(usernameField.props.placeholder).toBe('settings.enter_username');
  });

  it('renders password field with correct properties', () => {
    render(<LoginInfoBottomSheet {...defaultProps} />);

    const inputFields = screen.getAllByTestId('input-field');
    const passwordField = inputFields[1]; // Second input field is password

    expect(passwordField.props.autoCapitalize).toBe('none');
    expect(passwordField.props.autoCorrect).toBe(false);
    expect(passwordField.props.textContentType).toBe('password');
    expect(passwordField.props.autoComplete).toBe('password');
    expect(passwordField.props.secureTextEntry).toBe(true);
    expect(passwordField.props.placeholder).toBe('settings.enter_password');
  });

  it('uses KeyboardAvoidingView with correct behavior for iOS', () => {
    render(<LoginInfoBottomSheet {...defaultProps} />);

    const keyboardAvoidingView = screen.getByTestId('keyboard-avoiding-view');
    expect(keyboardAvoidingView.props.behavior).toBe('padding');
  });

  it('renders cancel and save buttons', () => {
    render(<LoginInfoBottomSheet {...defaultProps} />);

    expect(screen.getByText('common.cancel')).toBeTruthy();
    expect(screen.getByText('common.save')).toBeTruthy();
  });

  it('calls onClose when cancel button is pressed', () => {
    render(<LoginInfoBottomSheet {...defaultProps} />);

    const cancelButton = screen.getByText('common.cancel').parent;
    fireEvent.press(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
