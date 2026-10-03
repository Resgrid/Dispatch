import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import * as api from '@/api/mfa/account-security';
import { getPasskeyAssertion } from '@/lib/mfa/passkey';
import { PasskeyCeremonyError } from '@/lib/mfa/passkey-errors';

import { AccountVerifyModal } from '../account-verify-modal';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/api/mfa/account-security');
jest.mock('@/lib/mfa/passkey', () => ({ getPasskeyAssertion: jest.fn(), passkeysSupported: jest.fn(() => true) }));
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
const assertion = getPasskeyAssertion as jest.Mock;
const options = (requestId: string): api.StepUpOptionsData => ({
  Methods: ['totp', 'passkey'],
  Preferred: 'passkey',
  EnrollmentRequired: false,
  WindowMinutes: 5,
  Passkey: { RequestId: requestId, Options: { challenge: requestId } },
});

describe('AccountVerifyModal: a fresh second factor before an account change', () => {
  beforeEach(() => jest.clearAllMocks());

  it("verifies with this app's passkey on the ceremony the options started", async () => {
    mocked.getStepUpOptions.mockResolvedValue(options('req-1'));
    assertion.mockResolvedValue({ id: 'cred' });
    mocked.verifyStepUp.mockResolvedValue({ VerifiedAt: 'now', ExpiresAt: 'later' });
    const onDone = jest.fn();

    const { getByTestId } = render(<AccountVerifyModal proof="step_up" onDone={onDone} />);
    await waitFor(() => expect(getByTestId('account-verify-passkey')).toBeTruthy());
    await act(async () => fireEvent.press(getByTestId('account-verify-passkey')));

    expect(assertion).toHaveBeenCalledWith({ challenge: 'req-1' });
    expect(mocked.verifyStepUp).toHaveBeenCalledWith({ Operation: 'account_security', Method: 'passkey', RequestId: 'req-1', Credential: { id: 'cred' } });
    expect(onDone).toHaveBeenCalledWith(true);
    expect(mocked.getStepUpOptions).toHaveBeenCalledTimes(1);
  });

  it('asks for a fresh ceremony on a retry: the first one is spent whatever happened', async () => {
    mocked.getStepUpOptions.mockResolvedValueOnce(options('req-1')).mockResolvedValueOnce(options('req-2'));
    assertion.mockRejectedValueOnce(new PasskeyCeremonyError('failed')).mockResolvedValueOnce({ id: 'cred' });
    mocked.verifyStepUp.mockResolvedValue({ VerifiedAt: 'now', ExpiresAt: 'later' });
    const onDone = jest.fn();

    const { getByTestId } = render(<AccountVerifyModal proof="step_up" onDone={onDone} />);
    await waitFor(() => expect(getByTestId('account-verify-passkey')).toBeTruthy());
    await act(async () => fireEvent.press(getByTestId('account-verify-passkey')));
    expect(getByTestId('account-verify-error')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();

    await act(async () => fireEvent.press(getByTestId('account-verify-passkey')));
    expect(mocked.getStepUpOptions).toHaveBeenCalledTimes(2);
    expect(mocked.verifyStepUp).toHaveBeenCalledWith(expect.objectContaining({ Method: 'passkey', RequestId: 'req-2' }));
    expect(onDone).toHaveBeenCalledWith(true);
  });
});
