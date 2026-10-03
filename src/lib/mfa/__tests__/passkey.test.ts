import { Passkey } from 'react-native-passkey';

import { createPasskeyCredential, getPasskeyAssertion, passkeysSupported } from '../passkey';
import { PasskeyCeremonyError } from '../passkey-errors';

const passkey = Passkey as unknown as { isSupported: jest.Mock; get: jest.Mock; create: jest.Mock };

describe('native passkeys', () => {
  beforeEach(() => jest.clearAllMocks());

  it('hands the server its own options and returns the assertion as WebAuthn JSON', async () => {
    const options = { challenge: 'abc', rpId: 'responder.resgrid.com', allowCredentials: [{ id: 'cred', type: 'public-key' }] };
    passkey.get.mockResolvedValue({
      id: 'cred',
      rawId: 'cred',
      type: 'public-key',
      response: { authenticatorData: 'ad', clientDataJSON: 'cd', signature: 'sig', userHandle: 'uh' },
    });

    const credential = await getPasskeyAssertion(options);

    expect(passkey.get).toHaveBeenCalledWith(options);
    expect(credential).toEqual({
      id: 'cred',
      rawId: 'cred',
      type: 'public-key',
      authenticatorAttachment: null,
      response: { authenticatorData: 'ad', clientDataJSON: 'cd', signature: 'sig', userHandle: 'uh' },
      clientExtensionResults: {},
    });
  });

  it('returns a new credential as WebAuthn JSON', async () => {
    passkey.create.mockResolvedValue({ id: 'new', rawId: 'new', response: { clientDataJSON: 'cd', attestationObject: 'ao' } });
    expect(await createPasskeyCredential({ challenge: 'abc' })).toMatchObject({
      id: 'new',
      type: 'public-key',
      response: { clientDataJSON: 'cd', attestationObject: 'ao', transports: [] },
    });
  });

  it('reports a closed prompt as cancelled, never as a failed signature', async () => {
    for (const [native, reason] of [
      ['UserCancelled', 'cancelled'],
      ['Interrupted', 'cancelled'],
      ['NotSupported', 'not_supported'],
      ['BadConfiguration', 'not_supported'],
      ['NoCredentials', 'no_credentials'],
      ['RequestFailed', 'failed'],
    ] as const) {
      passkey.get.mockRejectedValueOnce({ error: native, message: native });
      await expect(getPasskeyAssertion({ challenge: 'abc' })).rejects.toEqual(new PasskeyCeremonyError(reason));
    }
  });

  it('is unsupported when the platform says so or the module is missing', () => {
    passkey.isSupported.mockReturnValueOnce(false);
    expect(passkeysSupported()).toBe(false);
    passkey.isSupported.mockImplementationOnce(() => {
      throw new Error('no native module');
    });
    expect(passkeysSupported()).toBe(false);
  });
});
