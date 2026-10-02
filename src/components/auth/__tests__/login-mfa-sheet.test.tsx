import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import type { MfaChallenge } from '@/lib/mfa/types';
import useAuthStore from '@/stores/auth/store';

import { LoginMfaSheet } from '../login-mfa-sheet';

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
jest.mock('@/lib/mfa/passkey', () => ({ passkeysSupported: jest.fn(() => true) }));
jest.mock('expo-linking', () => ({ openURL: jest.fn() }));

const challenge = (overrides: Partial<MfaChallenge> = {}): MfaChallenge => ({
  kind: 'verify',
  methods: ['totp', 'passkey', 'passkey_approval', 'federated'],
  enrolled: ['totp', 'passkey', 'passkey_approval', 'federated'],
  preferred: 'totp',
  expiresAt: null,
  source: 'password',
  ...overrides,
});

describe('LoginMfaSheet', () => {
  const verifyLoginMfa = jest.fn();
  const requestLoginApproval = jest.fn();
  const waitForLoginApproval = jest.fn();
  const cancelLoginApproval = jest.fn();
  const cancelLoginMfa = jest.fn();
  const loginSetupOptions = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    verifyLoginMfa.mockResolvedValue({ ok: true, recovery: false });
    useAuthStore.setState({ mfaChallenge: challenge(), verifyLoginMfa, requestLoginApproval, waitForLoginApproval, cancelLoginApproval, cancelLoginMfa, loginSetupOptions });
  });

  it('offers every method this sign-in accepts and submits a code', async () => {
    const { getByTestId } = render(<LoginMfaSheet isOpen onLostFactor={jest.fn()} />);
    expect(getByTestId('login-mfa-passkey')).toBeTruthy();
    expect(getByTestId('login-mfa-approval')).toBeTruthy();
    expect(getByTestId('login-mfa-provider')).toBeTruthy();

    fireEvent.changeText(getByTestId('login-mfa-code'), '123456');
    await act(async () => fireEvent.press(getByTestId('login-mfa-submit')));
    expect(verifyLoginMfa).toHaveBeenCalledWith({ method: 'totp', code: '123456' });
  });

  it('offers only the accepted methods the member has', () => {
    useAuthStore.setState({ mfaChallenge: challenge({ enrolled: ['totp', 'passkey'] }) });
    const { getByTestId, queryByTestId } = render(<LoginMfaSheet isOpen onLostFactor={jest.fn()} />);
    expect(getByTestId('login-mfa-code')).toBeTruthy();
    expect(getByTestId('login-mfa-passkey')).toBeTruthy();
    expect(queryByTestId('login-mfa-approval')).toBeNull();
    expect(queryByTestId('login-mfa-provider')).toBeNull();
  });

  it('shows a member who signs in only through the provider no code box', () => {
    useAuthStore.setState({ mfaChallenge: challenge({ methods: ['totp', 'federated'], enrolled: ['federated'], preferred: 'federated' }) });
    const { getByTestId, queryByTestId } = render(<LoginMfaSheet isOpen onLostFactor={jest.fn()} />);
    expect(getByTestId('login-mfa-provider')).toBeTruthy();
    expect(queryByTestId('login-mfa-code')).toBeNull();
    expect(queryByTestId('login-mfa-recovery-toggle')).toBeNull();
  });

  it('keeps every accepted method from a server that sends no member list', () => {
    useAuthStore.setState({ mfaChallenge: challenge({ enrolled: [] }) });
    const { getByTestId } = render(<LoginMfaSheet isOpen onLostFactor={jest.fn()} />);
    expect(getByTestId('login-mfa-approval')).toBeTruthy();
    expect(getByTestId('login-mfa-provider')).toBeTruthy();
  });

  it('offers only what the server lists, and uses a recovery code on request', async () => {
    useAuthStore.setState({ mfaChallenge: challenge({ methods: ['totp'] }) });
    const { queryByTestId, getByTestId } = render(<LoginMfaSheet isOpen onLostFactor={jest.fn()} />);
    expect(queryByTestId('login-mfa-passkey')).toBeNull();
    expect(queryByTestId('login-mfa-approval')).toBeNull();

    fireEvent.press(getByTestId('login-mfa-recovery-toggle'));
    fireEvent.changeText(getByTestId('login-mfa-code'), 'ABCD-EFGH');
    await act(async () => fireEvent.press(getByTestId('login-mfa-submit')));
    expect(verifyLoginMfa).toHaveBeenCalledWith({ method: 'recovery_code', code: 'ABCD-EFGH' });
  });

  it('shows why a code failed, in the member\'s language', async () => {
    verifyLoginMfa.mockResolvedValue({ ok: false, code: 'invalid_totp', restart: false });
    const { getByTestId } = render(<LoginMfaSheet isOpen onLostFactor={jest.fn()} />);
    fireEvent.changeText(getByTestId('login-mfa-code'), '000000');
    await act(async () => fireEvent.press(getByTestId('login-mfa-submit')));
    expect(getByTestId('login-mfa-error').props.children).toBe('mfa.errors.invalid_totp');
  });

  it('shows the approval number on this screen and finishes once Responder approves', async () => {
    requestLoginApproval.mockResolvedValue({ ApprovalRequestId: 'ap-1', MatchNumber: '42', ExpiresIn: 120 });
    let decide: (value: string) => void = () => undefined;
    waitForLoginApproval.mockReturnValue(new Promise((resolve) => (decide = resolve)));

    const { getByTestId, queryByTestId } = render(<LoginMfaSheet isOpen onLostFactor={jest.fn()} />);
    await act(async () => fireEvent.press(getByTestId('login-mfa-approval')));
    expect(getByTestId('mfa-approval-number').props.children).toBe('42');
    expect(queryByTestId('login-mfa-code')).toBeNull();

    await act(async () => decide('approved'));
    await waitFor(() => expect(verifyLoginMfa).toHaveBeenCalledWith({ method: 'passkey_approval', approvalRequestId: 'ap-1' }));
  });

  it('stops waiting and cancels the request when the member stops', async () => {
    requestLoginApproval.mockResolvedValue({ ApprovalRequestId: 'ap-1', MatchNumber: '42', ExpiresIn: 120 });
    waitForLoginApproval.mockReturnValue(new Promise(() => undefined));
    const { getByTestId, queryByTestId } = render(<LoginMfaSheet isOpen onLostFactor={jest.fn()} />);
    await act(async () => fireEvent.press(getByTestId('login-mfa-approval')));
    await act(async () => fireEvent.press(getByTestId('mfa-approval-cancel')));
    expect(cancelLoginApproval).toHaveBeenCalledWith('ap-1');
    expect(queryByTestId('mfa-approval-panel')).toBeNull();
  });

  it('sets up the required authenticator with a new key before signing in', async () => {
    useAuthStore.setState({ mfaChallenge: challenge({ kind: 'setup', methods: ['totp'], enrolled: [] }) });
    loginSetupOptions.mockResolvedValue({ SharedKey: 'ABCD EFGH', AuthenticatorUri: 'otpauth://totp/x', ExpiresIn: 600 });
    const { getByTestId, queryByTestId } = render(<LoginMfaSheet isOpen onLostFactor={jest.fn()} />);
    await waitFor(() => expect(getByTestId('mfa-setup-shared-key').props.children).toBe('ABCD EFGH'));
    expect(queryByTestId('login-mfa-lost')).toBeNull();

    fireEvent.changeText(getByTestId('login-mfa-code'), '123456');
    await act(async () => fireEvent.press(getByTestId('login-mfa-submit')));
    expect(verifyLoginMfa).toHaveBeenCalledWith({ method: 'setup', code: '123456' });
  });

  it('cancels the sign-in and offers the lost-authenticator path', async () => {
    const onLostFactor = jest.fn();
    const { getByTestId } = render(<LoginMfaSheet isOpen onLostFactor={onLostFactor} />);
    fireEvent.press(getByTestId('login-mfa-lost'));
    expect(onLostFactor).toHaveBeenCalled();
    await act(async () => fireEvent.press(getByTestId('login-mfa-cancel')));
    expect(cancelLoginMfa).toHaveBeenCalled();
  });
});
