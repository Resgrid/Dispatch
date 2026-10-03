import * as Crypto from 'expo-crypto';

import { base64ToBase64Url, bytesToBase64Url } from './base64url';

/** A fresh random value for a PKCE verifier (43 chars from 32 bytes) or an SSO state. */
export const randomBase64Url = (bytes = 32): string => bytesToBase64Url(Crypto.getRandomBytes(bytes));

/** The S256 challenge the broker sees; the verifier stays in this app's memory until redemption. */
export const s256Challenge = async (verifier: string): Promise<string> => base64ToBase64Url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }));
