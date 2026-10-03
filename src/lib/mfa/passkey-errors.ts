/** Why a passkey prompt did not produce a credential. Cancelling is the member's choice, never a failed verification. */
export type PasskeyCeremonyReason = 'cancelled' | 'not_supported' | 'no_credentials' | 'failed';

export class PasskeyCeremonyError extends Error {
  readonly reason: PasskeyCeremonyReason;

  constructor(reason: PasskeyCeremonyReason) {
    super(`passkey_${reason}`);
    this.name = 'PasskeyCeremonyError';
    this.reason = reason;
  }
}

export const isPasskeyCeremonyError = (error: unknown): error is PasskeyCeremonyError => error instanceof PasskeyCeremonyError;
