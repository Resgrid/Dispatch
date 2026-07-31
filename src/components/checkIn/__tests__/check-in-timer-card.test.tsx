import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { CheckInTimerStatusResultData } from '@/models/v4/checkIn/checkInTimerStatusResultData';

import { CheckInTimerCard } from '../check-in-timer-card';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.count !== undefined) return `${opts.count} min ago`;
      return key;
    },
  }),
}));

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  cssInterop: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

function makeTimer(overrides: Partial<CheckInTimerStatusResultData> = {}): CheckInTimerStatusResultData {
  const timer = new CheckInTimerStatusResultData();
  timer.TargetType = 1;
  timer.TargetTypeName = 'Personnel';
  timer.TargetEntityId = 'u1';
  timer.TargetName = 'John Doe';
  timer.DurationMinutes = 20;
  timer.ElapsedMinutes = 5;
  timer.Status = 'Ok';
  timer.LastCheckIn = '2026-01-01T00:00:00Z';
  timer.CallId = 1;
  Object.assign(timer, overrides);
  return timer;
}

describe('CheckInTimerCard', () => {
  it('renders Ok status correctly', () => {
    const onCheckIn = jest.fn();
    const { getByText } = render(
      <CheckInTimerCard timer={makeTimer()} onCheckIn={onCheckIn} />
    );
    expect(getByText('John Doe')).toBeTruthy();
    expect(getByText('check_in.status_ok')).toBeTruthy();
  });

  it('renders Overdue status', () => {
    const onCheckIn = jest.fn();
    const { getByText } = render(
      <CheckInTimerCard
        timer={makeTimer({ Status: 'Overdue', ElapsedMinutes: 25 })}
        onCheckIn={onCheckIn}
      />
    );
    expect(getByText('check_in.status_overdue')).toBeTruthy();
  });

  it('calls onCheckIn when button pressed', () => {
    const onCheckIn = jest.fn();
    const timer = makeTimer();
    const { getByText } = render(
      <CheckInTimerCard timer={timer} onCheckIn={onCheckIn} />
    );
    fireEvent.press(getByText('check_in.perform_check_in'));
    expect(onCheckIn).toHaveBeenCalledWith(timer);
  });
});
