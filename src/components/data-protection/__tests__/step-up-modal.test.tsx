import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { dataProtectionStore } from '@/stores/data-protection/store';

import { StepUpModal } from '../step-up-modal';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/ui/modal', () => {
  const { View } = require('react-native');
  return {
    Modal: ({ isOpen, children, ...props }: any) => (isOpen ? <View {...props}>{children}</View> : null),
    ModalBackdrop: () => null,
    ModalBody: ({ children }: any) => <View>{children}</View>,
    ModalContent: ({ children }: any) => <View>{children}</View>,
    ModalFooter: ({ children }: any) => <View>{children}</View>,
    ModalHeader: ({ children }: any) => <View>{children}</View>,
  };
});

describe('StepUpModal with every method', () => {
  const store = {
    loadStepUpMethods: jest.fn(),
    verifyOtp: jest.fn(),
    verifyPasskey: jest.fn(),
    verifyFederated: jest.fn(),
    requestApproval: jest.fn(),
    waitForApproval: jest.fn(),
    completeApproval: jest.fn(),
    cancelApproval: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    dataProtectionStore.setState({ ...store, stepUpMethods: ['totp', 'passkey', 'passkey_approval', 'federated'], lastError: null, isVerifying: false });
  });

  it('loads the methods on open and offers each', () => {
    const { getByTestId } = render(<StepUpModal isOpen onClose={jest.fn()} />);
    expect(store.loadStepUpMethods).toHaveBeenCalled();
    expect(getByTestId('step-up-code-input')).toBeTruthy();
    expect(getByTestId('step-up-passkey')).toBeTruthy();
    expect(getByTestId('step-up-approval')).toBeTruthy();
    expect(getByTestId('step-up-provider')).toBeTruthy();
  });

  it('closes after a passkey or the provider verifies', async () => {
    store.verifyPasskey.mockResolvedValue(true);
    const onVerified = jest.fn();
    const onClose = jest.fn();
    const { getByTestId } = render(<StepUpModal isOpen onClose={onClose} onVerified={onVerified} />);
    await act(async () => fireEvent.press(getByTestId('step-up-passkey')));
    expect(onVerified).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();

    store.verifyFederated.mockResolvedValue(false);
    onClose.mockClear();
    await act(async () => fireEvent.press(getByTestId('step-up-provider')));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the approval number and finishes when Responder approves', async () => {
    store.requestApproval.mockResolvedValue({ id: 'ap-1', number: '42' });
    store.waitForApproval.mockResolvedValue('approved');
    store.completeApproval.mockResolvedValue(true);
    const onClose = jest.fn();
    const { getByTestId } = render(<StepUpModal isOpen onClose={onClose} />);
    await act(async () => fireEvent.press(getByTestId('step-up-approval')));
    await waitFor(() => expect(store.completeApproval).toHaveBeenCalledWith('ap-1'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a method\'s refusal in the member\'s language', () => {
    dataProtectionStore.setState({ lastError: 'passkey_cancelled' });
    const { getByTestId } = render(<StepUpModal isOpen onClose={jest.fn()} />);
    expect(getByTestId('step-up-error').props.children).toBe('mfa.errors.passkey_cancelled');
  });

  it('offers only the code on an older server', () => {
    dataProtectionStore.setState({ stepUpMethods: ['totp'] });
    const { queryByTestId, getByTestId } = render(<StepUpModal isOpen onClose={jest.fn()} />);
    expect(getByTestId('step-up-code-input')).toBeTruthy();
    expect(queryByTestId('step-up-passkey')).toBeNull();
    expect(queryByTestId('step-up-approval')).toBeNull();
  });
});
