import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import * as loginMfa from '@/stores/auth/login-mfa';
import useAuthStore from '@/stores/auth/store';

import FactorRecovery from '../recovery';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, useRouter: () => ({ replace: mockReplace }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/ui', () => ({ FocusAwareStatusBar: () => null }));
jest.mock('expo-linking', () => ({ openURL: jest.fn() }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('@/stores/auth/login-mfa', () => ({
  abandonFactorRecovery: jest.fn(),
  finishFactorRecovery: jest.fn(),
  hasLoginTransaction: jest.fn(() => true),
  recoveryReplacementKey: jest.fn(),
}));

const mocked = loginMfa as jest.Mocked<typeof loginMfa>;

describe('"I lost my authenticator"', () => {
  const beginFactorRecovery = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mocked.hasLoginTransaction.mockReturnValue(true);
    useAuthStore.setState({ beginFactorRecovery });
  });

  it('spends a recovery code, stages a new authenticator, removes the chosen passkeys, and shows the new codes once', async () => {
    beginFactorRecovery.mockResolvedValue({ passkeys: [{ PasskeyId: 'pk-lost', DisplayName: 'Old phone' }], expiresAt: null });
    mocked.recoveryReplacementKey.mockResolvedValue({ SharedKey: 'NEW KEY', AuthenticatorUri: 'otpauth://x', ExpiresIn: 600 });
    mocked.finishFactorRecovery.mockResolvedValue({ recoveryCodes: ['n1', 'n2'] });

    const { getByTestId, getAllByTestId } = render(<FactorRecovery />);
    fireEvent.changeText(getByTestId('recovery-code-input'), 'RC-1111');
    await act(async () => fireEvent.press(getByTestId('recovery-begin')));
    expect(beginFactorRecovery).toHaveBeenCalledWith('RC-1111');

    await waitFor(() => expect(getByTestId('recovery-shared-key').props.children).toBe('NEW KEY'));
    fireEvent.press(getByTestId('recovery-passkey-pk-lost'));
    fireEvent.changeText(getByTestId('recovery-new-code'), '123456');
    await act(async () => fireEvent.press(getByTestId('recovery-finish')));
    expect(mocked.finishFactorRecovery).toHaveBeenCalledWith('123456', ['pk-lost']);
    expect(getAllByTestId('mfa-recovery-code').map((n) => n.props.children)).toEqual(['n1', 'n2']);

    fireEvent.press(getByTestId('recovery-sign-in'));
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('says who can help without a sign-in or a recovery code, and never waives anything', async () => {
    mocked.hasLoginTransaction.mockReturnValue(false);
    const { getByTestId, queryByTestId } = render(<FactorRecovery />);
    expect(queryByTestId('recovery-code-input')).toBeNull();
    fireEvent.press(getByTestId('recovery-back'));
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('shows a wrong code and lets the member cancel the recovery', async () => {
    beginFactorRecovery.mockResolvedValue({ passkeys: [], expiresAt: null });
    mocked.recoveryReplacementKey.mockResolvedValue({ SharedKey: 'K', AuthenticatorUri: 'otpauth://x', ExpiresIn: 600 });
    mocked.finishFactorRecovery.mockResolvedValue({ code: 'invalid_totp', ended: false });
    const { getByTestId } = render(<FactorRecovery />);
    fireEvent.changeText(getByTestId('recovery-code-input'), 'RC-1111');
    await act(async () => fireEvent.press(getByTestId('recovery-begin')));
    await waitFor(() => expect(getByTestId('recovery-shared-key')).toBeTruthy());
    fireEvent.changeText(getByTestId('recovery-new-code'), '000000');
    await act(async () => fireEvent.press(getByTestId('recovery-finish')));
    expect(getByTestId('recovery-error').props.children).toBe('mfa.errors.invalid_totp');

    await act(async () => fireEvent.press(getByTestId('recovery-cancel')));
    expect(mocked.abandonFactorRecovery).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });
});
