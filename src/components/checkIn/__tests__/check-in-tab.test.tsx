import { render } from '@testing-library/react-native';
import React from 'react';

import { CheckInTab } from '../check-in-tab';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  cssInterop: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

const mockStore = {
  timerStatuses: [],
  checkInHistory: [],
  callPersonnelStatuses: [],
  isLoadingStatuses: false,
  isLoadingHistory: false,
  statusError: null,
  fetchTimerStatuses: jest.fn(),
  fetchResolvedTimers: jest.fn(),
  fetchCheckInHistory: jest.fn(),
  fetchCallPersonnelStatuses: jest.fn(),
  toggleTimers: jest.fn(),
  startPolling: jest.fn(),
  stopPolling: jest.fn(),
  reset: jest.fn(),
};

jest.mock('@/stores/checkIn/store', () => ({
  useCheckInStore: jest.fn((selector) =>
    typeof selector === 'function' ? selector(mockStore) : mockStore
  ),
}));

jest.mock('@/stores/signalr/signalr-store', () => ({
  useSignalRStore: jest.fn((selector) =>
    typeof selector === 'function' ? selector({ lastCheckInUpdateTimestamp: 0 }) : { lastCheckInUpdateTimestamp: 0 }
  ),
}));

describe('CheckInTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders disabled message when timers disabled', () => {
    const { getByText } = render(
      <CheckInTab callId={1} checkInTimersEnabled={false} />
    );
    expect(getByText('check_in.timers_disabled')).toBeTruthy();
  });

  it('renders empty state when no timers', () => {
    const { getByText } = render(
      <CheckInTab callId={1} checkInTimersEnabled={true} />
    );
    expect(getByText('check_in.no_timers')).toBeTruthy();
  });

  it('starts polling on mount and stops on unmount', () => {
    const { unmount } = render(
      <CheckInTab callId={1} checkInTimersEnabled={true} />
    );
    expect(mockStore.fetchTimerStatuses).toHaveBeenCalledWith(1);
    expect(mockStore.startPolling).toHaveBeenCalledWith(1);

    unmount();
    expect(mockStore.stopPolling).toHaveBeenCalled();
    expect(mockStore.reset).toHaveBeenCalled();
  });
});
