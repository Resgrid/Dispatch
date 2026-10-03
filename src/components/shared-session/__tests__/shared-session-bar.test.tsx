import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { endSharedShift, lockSharedSession, reportOperatorActivity } from '@/lib/shared-session/controller';
import useAuthStore from '@/stores/auth/store';
import { resetSharedSession, useSharedSessionStore } from '@/stores/shared-session/store';

import { SharedSessionBar } from '../shared-session-bar';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key) }) }));
jest.mock('@/lib/shared-session/controller', () => ({
  IDLE_WARNING_SECONDS: 60,
  SHIFT_NOTICE_SECONDS: 600,
  endSharedShift: jest.fn(async () => undefined),
  lockSharedSession: jest.fn(async () => undefined),
  reportOperatorActivity: jest.fn(),
}));
jest.mock('@/stores/auth/store', () => {
  const { create } = require('zustand');
  return { __esModule: true, default: create(() => ({ status: 'signedIn' })) };
});

describe('SharedSessionBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-29T12:00:00Z'));
    resetSharedSession();
    useAuthStore.setState({ status: 'signedIn' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows nothing for a personal or locked session', () => {
    const { queryByTestId } = render(<SharedSessionBar />);
    expect(queryByTestId('shared-session-bar')).toBeNull();

    act(() => useSharedSessionStore.setState({ shared: true, locked: true }));
    expect(queryByTestId('shared-session-bar')).toBeNull();
  });

  it('counts down to the idle lock, and locks on request', () => {
    const { getByTestId, getByText, queryByTestId } = render(<SharedSessionBar />);
    act(() => useSharedSessionStore.setState({ shared: true, locked: false, installationLabel: 'Engine 12', idleLocksAt: Date.now() + 5 * 60 * 1000 }));

    expect(getByText(/shared_session\.bar_label.*Engine 12.*shared_session\.locks_in.*5:00/)).toBeTruthy();
    expect(queryByTestId('shared-session-warning')).toBeNull();

    fireEvent.press(getByTestId('shared-bar-lock'));
    expect(lockSharedSession).toHaveBeenCalledWith('explicit');
  });

  it('warns a minute before the idle lock and offers to stay', () => {
    const { getByTestId } = render(<SharedSessionBar />);
    act(() => useSharedSessionStore.setState({ shared: true, locked: false, idleLocksAt: Date.now() + 90 * 1000 }));
    expect(() => getByTestId('shared-session-warning')).toThrow();

    act(() => {
      jest.advanceTimersByTime(31 * 1000);
    });
    expect(getByTestId('shared-session-warning')).toBeTruthy();

    fireEvent.press(getByTestId('shared-bar-stay'));
    expect(reportOperatorActivity).toHaveBeenCalledWith(true);
  });

  it('says when the shift ends in the last ten minutes', () => {
    const { getByTestId, queryByTestId } = render(<SharedSessionBar />);
    act(() => useSharedSessionStore.setState({ shared: true, locked: false, idleLocksAt: Date.now() + 15 * 60 * 1000, shiftEndsAt: Date.now() + 9 * 60 * 1000 }));
    expect(getByTestId('shared-session-warning')).toBeTruthy();
    expect(queryByTestId('shared-bar-stay')).toBeNull();
  });

  it('asks before ending the shift, and can hand over to the next operator', async () => {
    const { getByTestId, queryByTestId } = render(<SharedSessionBar />);
    act(() => useSharedSessionStore.setState({ shared: true, locked: false }));

    fireEvent.press(getByTestId('shared-bar-end'));
    expect(endSharedShift).not.toHaveBeenCalled();
    fireEvent.press(getByTestId('shared-bar-end-cancel'));
    expect(queryByTestId('shared-bar-end-confirm')).toBeNull();

    fireEvent.press(getByTestId('shared-bar-end'));
    await act(async () => fireEvent.press(getByTestId('shared-bar-switch')));
    expect(endSharedShift).toHaveBeenCalledWith(true);

    await act(async () => fireEvent.press(getByTestId('shared-bar-end-confirm')));
    expect(endSharedShift).toHaveBeenCalledWith(false);
  });
});
