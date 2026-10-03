// Mock for expo-crypto. The password-verifier helpers keep their fixed values ('mock-hash', 'mock-uuid-1234'); the
// sign-in code's PKCE (a base64 digest and random bytes) gets real values from Node's crypto, so its challenges are real.
import { createHash, randomBytes } from 'crypto';

const nodeAlgorithm = (algorithm: string) => algorithm.replace('-', '').toLowerCase();

export const digestStringAsync = jest.fn(async (algorithm: string, data: string, options?: { encoding?: string }) =>
  options?.encoding === 'base64' ? createHash(nodeAlgorithm(algorithm)).update(data).digest('base64') : 'mock-hash'
);

export const CryptoDigestAlgorithm = {
  SHA256: 'SHA-256',
  SHA512: 'SHA-512',
  SHA1: 'SHA-1',
  MD2: 'MD2',
  MD4: 'MD4',
  MD5: 'MD5',
};

export const CryptoEncoding = {
  HEX: 'hex',
  BASE64: 'base64',
};

export const getRandomBytes = (byteCount: number): Uint8Array => new Uint8Array(randomBytes(byteCount));

export const getRandomBytesAsync = jest.fn().mockResolvedValue(new Uint8Array(32));

export const randomUUID = jest.fn().mockReturnValue('mock-uuid-1234');
