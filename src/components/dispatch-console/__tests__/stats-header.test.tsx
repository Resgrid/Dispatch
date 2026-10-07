import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { StatsHeader } from '../stats-header';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../weather-widget', () => ({
  WeatherWidget: () => null,
}));

jest.mock('@/components/ui/icon', () => ({
  Icon: () => null,
}));

const baseProps = {
  activeCalls: 4,
  scheduledCalls: 2,
  unitsAvailable: 6,
  personnelAvailable: 9,
  personnelOnDuty: 12,
};

describe('StatsHeader', () => {
  // The header's clock ticks every second; hold it still so no tick lands outside act().
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('leaves the Pending tile out when there is no pending count', () => {
    render(<StatsHeader {...baseProps} />);

    expect(screen.queryByText('dispatch.pending_calls')).toBeNull();
    expect(screen.getByText('dispatch.scheduled_calls')).toBeTruthy();
  });

  it('shows the pending count, including zero', () => {
    const { rerender } = render(<StatsHeader {...baseProps} pendingCalls={3} />);

    expect(screen.getByText('dispatch.pending_calls')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();

    rerender(<StatsHeader {...baseProps} pendingCalls={0} />);
    expect(screen.getByText('dispatch.pending_calls')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('opens the pending and scheduled lists from their tiles', () => {
    const onPendingCallsPress = jest.fn();
    const onScheduledCallsPress = jest.fn();
    render(<StatsHeader {...baseProps} pendingCalls={3} onPendingCallsPress={onPendingCallsPress} onScheduledCallsPress={onScheduledCallsPress} />);

    fireEvent.press(screen.getByTestId('stat-pending-calls'));
    fireEvent.press(screen.getByTestId('stat-scheduled-calls'));

    expect(onPendingCallsPress).toHaveBeenCalledTimes(1);
    expect(onScheduledCallsPress).toHaveBeenCalledTimes(1);
  });

  it('labels the pressable tiles for screen readers', () => {
    render(<StatsHeader {...baseProps} pendingCalls={3} onPendingCallsPress={jest.fn()} onScheduledCallsPress={jest.fn()} />);

    expect(screen.getByLabelText('dispatch.view_pending_calls: 3')).toBeTruthy();
    expect(screen.getByLabelText('dispatch.view_scheduled_calls: 2')).toBeTruthy();
  });

  it('keeps the tiles inert without a press handler', () => {
    render(<StatsHeader {...baseProps} pendingCalls={3} />);

    expect(screen.queryByLabelText('dispatch.view_pending_calls: 3')).toBeNull();
    expect(screen.queryByLabelText('dispatch.view_scheduled_calls: 2')).toBeNull();
  });
});
