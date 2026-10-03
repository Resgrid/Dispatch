import { base64UrlToBytes, bytesToBase64Url } from './base64url';
import { PasskeyCeremonyError } from './passkey-errors';
import type { WebAuthnOptions } from './types';

// ---------------------------------------------------------------------------
// Passkeys in the browser build (passkey workbook section 3: a small shim over navigator.credentials). WebAuthn needs a
// secure https (or localhost) page; a packaged desktop shell's custom scheme is not one, so passkeys are unavailable
// there and the other methods are offered instead.
// ---------------------------------------------------------------------------

type Descriptor = { id: string; type: string; transports?: string[] };

const secureWebPage = (): boolean => {
  if (typeof window === 'undefined' || !window.isSecureContext) {
    return false;
  }
  const { protocol, hostname } = window.location;
  return protocol === 'https:' || (protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1'));
};

export const passkeysSupported = (): boolean => secureWebPage() && typeof window.PublicKeyCredential !== 'undefined' && typeof navigator !== 'undefined' && !!navigator.credentials;

const descriptors = (list: unknown): PublicKeyCredentialDescriptor[] | undefined =>
  Array.isArray(list) ? (list as Descriptor[]).map((d) => ({ id: base64UrlToBytes(d.id), type: 'public-key', ...(d.transports ? { transports: d.transports as AuthenticatorTransport[] } : {}) })) : undefined;

const failure = (error: unknown): PasskeyCeremonyError => {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'AbortError') {
    // The browser uses NotAllowedError for both a cancelled prompt and a timeout; neither is a failed signature.
    return new PasskeyCeremonyError('cancelled');
  }
  if (name === 'NotSupportedError' || name === 'SecurityError') {
    return new PasskeyCeremonyError('not_supported');
  }
  return new PasskeyCeremonyError('failed');
};

const credentialJson = (credential: PublicKeyCredential, assertion: boolean): Record<string, unknown> => {
  const toJson = (credential as unknown as { toJSON?: () => Record<string, unknown> }).toJSON;
  if (typeof toJson === 'function') {
    return toJson.call(credential);
  }

  const response = credential.response as AuthenticatorAssertionResponse & AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? null,
    response: assertion
      ? {
          authenticatorData: bytesToBase64Url(response.authenticatorData),
          clientDataJSON: bytesToBase64Url(response.clientDataJSON),
          signature: bytesToBase64Url(response.signature),
          userHandle: response.userHandle ? bytesToBase64Url(response.userHandle) : null,
        }
      : {
          clientDataJSON: bytesToBase64Url(response.clientDataJSON),
          attestationObject: bytesToBase64Url(response.attestationObject),
          transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
        },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
};

export const getPasskeyAssertion = async (options: WebAuthnOptions): Promise<Record<string, unknown>> => {
  if (!passkeysSupported()) {
    throw new PasskeyCeremonyError('not_supported');
  }
  const publicKey: PublicKeyCredentialRequestOptions = {
    ...(options as unknown as PublicKeyCredentialRequestOptions),
    challenge: base64UrlToBytes(String(options.challenge)),
    allowCredentials: descriptors(options.allowCredentials),
  };
  try {
    const credential = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
    if (!credential) {
      throw new PasskeyCeremonyError('cancelled');
    }
    return credentialJson(credential, true);
  } catch (error) {
    throw error instanceof PasskeyCeremonyError ? error : failure(error);
  }
};

export const createPasskeyCredential = async (options: WebAuthnOptions): Promise<Record<string, unknown>> => {
  if (!passkeysSupported()) {
    throw new PasskeyCeremonyError('not_supported');
  }
  const user = options.user as { id: string; name: string; displayName: string };
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...(options as unknown as PublicKeyCredentialCreationOptions),
    challenge: base64UrlToBytes(String(options.challenge)),
    user: { ...user, id: base64UrlToBytes(user.id) },
    excludeCredentials: descriptors(options.excludeCredentials),
  };
  try {
    const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
    if (!credential) {
      throw new PasskeyCeremonyError('cancelled');
    }
    return credentialJson(credential, false);
  } catch (error) {
    throw error instanceof PasskeyCeremonyError ? error : failure(error);
  }
};
