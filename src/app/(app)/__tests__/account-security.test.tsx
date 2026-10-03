import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import * as api from '@/api/mfa/account-security';
import { createPasskeyCredential } from '@/lib/mfa/passkey';

import AccountSecurity from '../account-security';

jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/api/mfa/account-security');
jest.mock('@/lib/mfa/passkey', () => ({ createPasskeyCredential: jest.fn(), getPasskeyAssertion: jest.fn(), passkeysSupported: jest.fn(() => true) }));
jest.mock('@/lib/mfa/sso-browser', () => ({ runSsoRoundTrip: jest.fn() }));
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

const mocked = api as jest.Mocked<typeof api>;
const refusal = (status: number, type: string) => Object.assign(new Error(type), { response: { status, data: { type } } });
const methods: api.AccountMethodsData = {
  CurrentClient: 'dispatch',
  Totp: { Enrolled: true, EnrolledOn: '2026-09-01T00:00:00Z', LastUsedOn: null, RecoveryCodesRemaining: 8, RecoveryCodeWarning: false, SetUpOnSharedInstallation: false, CanTurnOff: true },
  PasskeyGroups: [
    { Client: 'dispatch', RegistrationAvailable: true, Passkeys: [] },
    { Client: 'web', RegistrationAvailable: false, Passkeys: [{ PasskeyId: 'pk-web', DisplayName: 'Laptop' } as never] },
  ],
  ApprovalInstallations: [],
  LinkedIdentities: [],
  RecentActivity: [{ ActivityId: 'act-1', OccurredOn: '2026-09-29T10:00:00Z', Method: 'totp', Purpose: 'login', Successful: true, Client: 'web', Installation: null, SharedInstallation: false, IsCurrentSession: false, ReportedOn: null }],
};

describe('AccountSecurity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked.getAccountMethods.mockResolvedValue(methods);
  });

  it('adds a passkey after the proof the server asks for, one step at a time', async () => {
    mocked.getPasskeyRegistrationOptions
      .mockRejectedValueOnce(refusal(401, 'reauthentication_required'))
      .mockRejectedValueOnce(refusal(401, 'step_up_required'))
      .mockResolvedValue({ RequestId: 'req-1', Options: { challenge: 'abc' } });
    mocked.reauthenticateWithPassword.mockResolvedValue({ VerifiedAt: 'now' });
    mocked.getStepUpOptions.mockResolvedValue({ Methods: ['totp'], Preferred: 'totp', EnrollmentRequired: false, WindowMinutes: 5, Passkey: null });
    mocked.verifyStepUp.mockResolvedValue({ VerifiedAt: 'now', ExpiresAt: 'later' });
    (createPasskeyCredential as jest.Mock).mockResolvedValue({ id: 'new' });
    mocked.completePasskeyRegistration.mockResolvedValue({ PasskeyId: 'pk-new' } as never);

    const { getByTestId, queryByTestId } = render(<AccountSecurity />);
    await waitFor(() => expect(getByTestId('account-add-passkey')).toBeTruthy());
    expect(getByTestId('account-passkeys-web')).toBeTruthy();

    await act(async () => fireEvent.press(getByTestId('account-add-passkey')));
    await waitFor(() => expect(getByTestId('account-verify-secret')).toBeTruthy());
    fireEvent.changeText(getByTestId('account-verify-secret'), 'pw');
    await act(async () => fireEvent.press(getByTestId('account-verify-submit')));
    expect(mocked.reauthenticateWithPassword).toHaveBeenCalledWith('pw');

    await waitFor(() => expect(mocked.getStepUpOptions).toHaveBeenCalledWith('account_security'));
    fireEvent.changeText(getByTestId('account-verify-secret'), '123456');
    await act(async () => fireEvent.press(getByTestId('account-verify-submit')));
    expect(mocked.verifyStepUp).toHaveBeenCalledWith({ Operation: 'account_security', Method: 'totp', Code: '123456' });

    await waitFor(() => expect(mocked.completePasskeyRegistration).toHaveBeenCalledWith('req-1', { id: 'new' }, ''));
    await waitFor(() => expect(queryByTestId('account-verify-modal')).toBeNull());
    expect(getByTestId('account-notice')).toBeTruthy();
  });

  it('stops when the member declines the proof', async () => {
    mocked.getPasskeyRegistrationOptions.mockRejectedValue(refusal(401, 'reauthentication_required'));
    const { getByTestId } = render(<AccountSecurity />);
    await waitFor(() => expect(getByTestId('account-add-passkey')).toBeTruthy());
    await act(async () => fireEvent.press(getByTestId('account-add-passkey')));
    await act(async () => fireEvent.press(getByTestId('account-verify-cancel')));
    expect(mocked.getPasskeyRegistrationOptions).toHaveBeenCalledTimes(1);
    expect(mocked.completePasskeyRegistration).not.toHaveBeenCalled();
  });

  it('reports a verification that was not the member', async () => {
    mocked.reportActivity.mockResolvedValue({ SessionEnded: true, NextSteps: [] });
    const { getByTestId } = render(<AccountSecurity />);
    await waitFor(() => expect(getByTestId('activity-report-act-1')).toBeTruthy());
    await act(async () => fireEvent.press(getByTestId('activity-report-act-1')));
    expect(mocked.reportActivity).toHaveBeenCalledWith('act-1');
  });
});
