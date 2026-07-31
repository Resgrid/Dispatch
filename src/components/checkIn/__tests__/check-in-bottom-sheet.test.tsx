import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { CheckInTimerStatusResultData } from '@/models/v4/checkIn/checkInTimerStatusResultData';

import { CheckInBottomSheet } from '../check-in-bottom-sheet';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  cssInterop: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

const mockPerformCheckIn = jest.fn().mockResolvedValue(true);

jest.mock('@/stores/checkIn/store', () => ({
  useCheckInStore: jest.fn((selector) =>
    typeof selector === 'function'
      ? selector({ performCheckIn: mockPerformCheckIn, isCheckingIn: false })
      : { performCheckIn: mockPerformCheckIn, isCheckingIn: false }
  ),
}));

jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: jest.fn((selector) =>
    typeof selector === 'function'
      ? selector({ latitude: 40.7, longitude: -74.0 })
      : { latitude: 40.7, longitude: -74.0 }
  ),
}));

jest.mock('@/stores/toast/store', () => ({
  useToastStore: jest.fn((selector) =>
    typeof selector === 'function'
      ? selector({ showToast: jest.fn() })
      : { showToast: jest.fn() }
  ),
}));

jest.mock('@/components/ui/bottom-sheet', () => ({
  CustomBottomSheet: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <>{children}</> : null,
}));

function makeTimer(): CheckInTimerStatusResultData {
  const timer = new CheckInTimerStatusResultData();
  timer.TargetType = 1;
  timer.TargetTypeName = 'Personnel';
  timer.TargetEntityId = 'u1';
  timer.TargetName = 'John Doe';
  timer.DurationMinutes = 20;
  timer.ElapsedMinutes = 5;
  timer.Status = 'Ok';
  timer.CallId = 1;
  return timer;
}

describe('CheckInBottomSheet', () => {
  it('shows target selection when no timer pre-selected', () => {
    const timers = [makeTimer()];
    const { getByText } = render(
      <CheckInBottomSheet isOpen={true} onClose={jest.fn()} callId={1} selectedTimer={null} timers={timers} />
    );
    expect(getByText('check_in.select_target')).toBeTruthy();
  });

  it('shows confirm step when timer is pre-selected', () => {
    const timer = makeTimer();
    const { getByText } = render(
      <CheckInBottomSheet isOpen={true} onClose={jest.fn()} callId={1} selectedTimer={timer} timers={[timer]} />
    );
    expect(getByText('check_in.confirm')).toBeTruthy();
  });
});
