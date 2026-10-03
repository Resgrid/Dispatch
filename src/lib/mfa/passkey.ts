import { Passkey, type PasskeyCreateRequest, type PasskeyGetRequest } from 'react-native-passkey';

import { PasskeyCeremonyError, type PasskeyCeremonyReason } from './passkey-errors';
import type { WebAuthnOptions } from './types';

// ---------------------------------------------------------------------------
// Passkeys on iOS and Android (passkey workbook section 3: react-native-passkey over Credential Manager and
// ASAuthorization). The server issues the options for this app's own relying party and verifies the result; this only
// runs the platform prompt. The options and results are WebAuthn JSON with base64url values on both sides.
// ---------------------------------------------------------------------------

const reasonFor = (error: unknown): PasskeyCeremonyReason => {
  const code = (error as { error?: string } | null)?.error;
  switch (code) {
    case 'UserCancelled':
    case 'Interrupted':
      return 'cancelled';
    case 'NotSupported':
    case 'BadConfiguration':
      return 'not_supported';
    case 'NoCredentials':
      return 'no_credentials';
    default:
      return 'failed';
  }
};

export const passkeysSupported = (): boolean => {
  try {
    return Passkey.isSupported();
  } catch {
    return false;
  }
};

/** Runs the sign-in prompt for the server's request options and returns the assertion as WebAuthn JSON. */
export const getPasskeyAssertion = async (options: WebAuthnOptions): Promise<Record<string, unknown>> => {
  try {
    const result = await Passkey.get(options as unknown as PasskeyGetRequest);
    return {
      id: result.id,
      rawId: result.rawId ?? result.id,
      type: result.type ?? 'public-key',
      authenticatorAttachment: result.authenticatorAttachment ?? null,
      response: {
        authenticatorData: result.response.authenticatorData,
        clientDataJSON: result.response.clientDataJSON,
        signature: result.response.signature,
        userHandle: result.response.userHandle ?? null,
      },
      clientExtensionResults: result.clientExtensionResults ?? {},
    };
  } catch (error) {
    throw new PasskeyCeremonyError(reasonFor(error));
  }
};

/** Runs the create prompt for the server's creation options and returns the attestation as WebAuthn JSON. */
export const createPasskeyCredential = async (options: WebAuthnOptions): Promise<Record<string, unknown>> => {
  try {
    const result = await Passkey.create(options as unknown as PasskeyCreateRequest);
    return {
      id: result.id,
      rawId: result.rawId ?? result.id,
      type: result.type ?? 'public-key',
      authenticatorAttachment: result.authenticatorAttachment ?? null,
      response: {
        clientDataJSON: result.response.clientDataJSON,
        attestationObject: result.response.attestationObject,
        transports: result.response.transports ?? [],
      },
      clientExtensionResults: result.clientExtensionResults ?? {},
    };
  } catch (error) {
    throw new PasskeyCeremonyError(reasonFor(error));
  }
};
