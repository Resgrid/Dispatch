import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { LoginOtpModal } from '../login-otp-modal';

// The modal renders through gluestack's overlay primitives; the real ones need a provider and a
// portal host that the login screen supplies at runtime. Rendering plain views keeps this focused
// on the modal's own behaviour: what it submits, and when.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

jest.mock('@/components/ui/modal', () => {
  const { View } = require('react-native');
  return {
    Modal: ({ isOpen, children, ...props }: any) => (isOpen ? <View {...props}>{children}</View> : null),
    ModalBackdrop: ({ children }: any) => <View>{children}</View>,
    ModalBody: ({ children }: any) => <View>{children}</View>,
    ModalContent: ({ children }: any) => <View>{children}</View>,
    ModalFooter: ({ children }: any) => <View>{children}</View>,
    ModalHeader: ({ children }: any) => <View>{children}</View>,
  };
});

describe('LoginOtpModal', () => {
  // gluestack's Button surfaces its disabled state differently depending on how the design system
  // is wired up in each app: some expose accessibilityState, others pass isDisabled straight
  // through. Read whichever one is present so this test asserts intent, not plumbing.
  const isDisabled = (element: any): boolean => element.props.accessibilityState?.disabled ?? element.props.isDisabled ?? false;

  const renderModal = (overrides: Partial<React.ComponentProps<typeof LoginOtpModal>> = {}) => {
    const props = {
      isOpen: true,
      isSubmitting: false,
      invalidCode: false,
      onSubmit: jest.fn(),
      onClose: jest.fn(),
      ...overrides,
    };
    return { ...render(<LoginOtpModal {...props} />), props };
  };

  it('renders nothing while closed', () => {
    const { queryByTestId, unmount } = renderModal({ isOpen: false });

    expect(queryByTestId('login-otp-input')).toBeNull();

    unmount();
  });

  it('blocks submission while the code is empty', () => {
    const { getByTestId, props, unmount } = renderModal();

    fireEvent.press(getByTestId('login-otp-submit'));

    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(isDisabled(getByTestId('login-otp-submit'))).toBe(true);

    unmount();
  });

  it('blocks submission for whitespace only', () => {
    const { getByTestId, props, unmount } = renderModal();

    fireEvent.changeText(getByTestId('login-otp-input'), '   ');
    fireEvent.press(getByTestId('login-otp-submit'));

    expect(props.onSubmit).not.toHaveBeenCalled();

    unmount();
  });

  it('submits the trimmed code and clears the field', () => {
    const { getByTestId, props, unmount } = renderModal();

    const input = getByTestId('login-otp-input');
    fireEvent.changeText(input, ' 123456 ');
    fireEvent.press(getByTestId('login-otp-submit'));

    expect(props.onSubmit).toHaveBeenCalledWith('123456');
    // The code is a live second factor: it must not sit in state after being handed off.
    expect(getByTestId('login-otp-input').props.value).toBe('');

    unmount();
  });

  it('submits from the keyboard return key', () => {
    const { getByTestId, props, unmount } = renderModal();

    fireEvent.changeText(getByTestId('login-otp-input'), '654321');
    fireEvent(getByTestId('login-otp-input'), 'submitEditing');

    expect(props.onSubmit).toHaveBeenCalledWith('654321');

    unmount();
  });

  it('shows the rejected-code message only when invalidCode is set', () => {
    const { queryByTestId, unmount } = renderModal();
    expect(queryByTestId('login-otp-error')).toBeNull();
    unmount();

    const invalid = renderModal({ invalidCode: true });
    expect(invalid.queryByTestId('login-otp-error')).not.toBeNull();
    invalid.unmount();
  });

  it('disables both actions while submitting', () => {
    const { getByTestId, unmount } = renderModal({ isSubmitting: true });

    expect(isDisabled(getByTestId('login-otp-cancel'))).toBe(true);
    expect(isDisabled(getByTestId('login-otp-submit'))).toBe(true);

    unmount();
  });

  it('reports cancellation to the caller', () => {
    const { getByTestId, props, unmount } = renderModal();

    fireEvent.press(getByTestId('login-otp-cancel'));

    expect(props.onClose).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('drops a half-typed code when the modal closes', () => {
    const { getByTestId, rerender, unmount, props } = renderModal();

    fireEvent.changeText(getByTestId('login-otp-input'), '1234');
    rerender(<LoginOtpModal {...props} isOpen={false} />);
    rerender(<LoginOtpModal {...props} isOpen={true} />);

    expect(getByTestId('login-otp-input').props.value).toBe('');

    unmount();
  });
});
