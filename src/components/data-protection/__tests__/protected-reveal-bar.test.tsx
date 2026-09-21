import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';

import { useProtectedReveal } from '@/hooks/use-protected-reveal';
import { logger } from '@/lib/logging';

import { ProtectedRevealBar } from '../protected-reveal-bar';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/lib/logging', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() } }));
jest.mock('@/stores/auth/store', () => ({ __esModule: true, default: { getState: () => ({ status: 'signedIn' }), subscribe: () => () => {} } }));
jest.mock('@/stores/data-protection/store', () => ({ useIsProtectionEnabled: () => true }));
jest.mock('@/hooks/use-protected-reveal');

const mockUseProtectedReveal = useProtectedReveal as jest.MockedFunction<typeof useProtectedReveal>;

const reveal = jest.fn(async () => {});
const conceal = jest.fn();

const hookState = (isRevealed: boolean) => ({ isRevealed, isRequesting: false, reveal, conceal });

describe('ProtectedRevealBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('re-reads the screen when the grant lapses on its own', async () => {
    // The store's expiry timer drops the grant; nothing else on the screen re-fetches, so the bar
    // has to, otherwise the plaintext that was fetched under the grant stays put.
    const onRefresh = jest.fn(async () => {});
    mockUseProtectedReveal.mockReturnValue(hookState(true));
    const { rerender } = render(<ProtectedRevealBar onRefresh={onRefresh} />);
    expect(onRefresh).not.toHaveBeenCalled();

    mockUseProtectedReveal.mockReturnValue(hookState(false));
    rerender(<ProtectedRevealBar onRefresh={onRefresh} />);

    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
  });

  it('re-reads once, not twice, for a manual conceal', async () => {
    const onRefresh = jest.fn(async () => {});
    mockUseProtectedReveal.mockReturnValue(hookState(true));
    const { getByTestId, rerender } = render(<ProtectedRevealBar onRefresh={onRefresh} />);

    fireEvent.press(getByTestId('protected-conceal-button'));
    expect(conceal).toHaveBeenCalledTimes(1);

    // conceal() clears the grant in the store; the hook now reports the screen as not revealed.
    mockUseProtectedReveal.mockReturnValue(hookState(false));
    rerender(<ProtectedRevealBar onRefresh={onRefresh} />);

    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
  });

  it('does not re-read when the screen was never revealed', () => {
    const onRefresh = jest.fn(async () => {});
    mockUseProtectedReveal.mockReturnValue(hookState(false));
    const { rerender } = render(<ProtectedRevealBar onRefresh={onRefresh} />);
    rerender(<ProtectedRevealBar onRefresh={onRefresh} />);

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('logs a failed re-read with the operation and reason instead of dropping it', async () => {
    const onRefresh = jest.fn(async () => {
      throw new Error('network');
    });
    mockUseProtectedReveal.mockReturnValue(hookState(true));
    const { getByTestId } = render(<ProtectedRevealBar onRefresh={onRefresh} testID="call-reveal" />);

    await act(async () => {
      fireEvent.press(getByTestId('protected-conceal-button'));
    });

    await waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith({
        message: 'Protected data refresh failed',
        context: { op: 'protected_reveal_refresh', reason: 'concealed', testID: 'call-reveal', error: 'network' },
      })
    );
  });
});
