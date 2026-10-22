import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { AwaitingResourcesBanner } from '@/components/awaiting-resources/awaiting-resources-banner';
import { UnitAvailableAlertHost } from '@/components/awaiting-resources/unit-available-alert-host';
import { type AwaitingUnitAlert } from '@/stores/awaiting-resources/store';

let mockPathname = '/';
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  usePathname: () => mockPathname,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
  cssInterop: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

let mockConditionsEnabled = true;
jest.mock('@/stores/feature-flags/store', () => ({
  useIsRunCardConditionsEnabled: () => mockConditionsEnabled,
}));

const mockSecurity = { canUserCreateCalls: true };
jest.mock('@/stores/security/store', () => ({
  useSecurityStore: () => mockSecurity,
}));

const mockAwaitingState = {
  calls: [] as { CallId: number }[],
  unitAlerts: [] as AwaitingUnitAlert[],
  busyKey: null as string | null,
  dispatchUnit: jest.fn(() => Promise.resolve(null)),
  dismissUnitAlert: jest.fn(),
};
jest.mock('@/stores/awaiting-resources/store', () => ({
  useAwaitingResourcesStore: (selector: (state: typeof mockAwaitingState) => unknown) => selector(mockAwaitingState),
}));

const alert = (): AwaitingUnitAlert => ({
  id: 'unit-41',
  unitId: 41,
  unitName: 'M-1',
  unitTypeName: 'MUG',
  message: 'M-1 available: 2 calls waiting for a MUG',
  calls: [
    { callId: 7, callNumber: '26-7', callName: 'Cardiac arrest', priority: 1, label: 'MUG', responseSeconds: 250, ageMinutes: 6 },
    { callId: 8, callNumber: null, callName: null, priority: 2, label: 'MUG', responseSeconds: null, ageMinutes: 2 },
  ],
  receivedAt: 1,
});

describe('UnitAvailableAlertHost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConditionsEnabled = true;
    mockSecurity.canUserCreateCalls = true;
    mockAwaitingState.unitAlerts = [alert()];
    mockAwaitingState.busyKey = null;
  });

  it('names the unit and every call waiting for it', () => {
    render(<UnitAvailableAlertHost />);

    expect(screen.getByText(/unit_available_title .*"unit":"M-1 \(MUG\)"/)).toBeTruthy();
    expect(screen.getByText('M-1 available: 2 calls waiting for a MUG')).toBeTruthy();
    expect(screen.getByText('26-7 · Cardiac arrest')).toBeTruthy();
    // A call with no number goes by its id.
    expect(screen.getByText('8')).toBeTruthy();
  });

  it('dispatches the unit to the chosen call in one step', () => {
    render(<UnitAvailableAlertHost />);

    expect(screen.getByText(/dispatch_to_call .*"call":"26-7"/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('unit-available-alert-41-dispatch-7'));

    expect(mockAwaitingState.dispatchUnit).toHaveBeenCalledWith(7, 41);
  });

  it('opens a waiting call', () => {
    const { router } = require('expo-router');
    render(<UnitAvailableAlertHost />);

    fireEvent.press(screen.getByTestId('unit-available-alert-41-open-8'));

    expect(router.push).toHaveBeenCalledWith('/call/8');
  });

  it('closes on request', () => {
    render(<UnitAvailableAlertHost />);

    fireEvent.press(screen.getByTestId('unit-available-alert-41-close'));

    expect(mockAwaitingState.dismissUnitAlert).toHaveBeenCalledWith('unit-41');
  });

  it('offers no dispatch to someone who cannot edit calls', () => {
    mockSecurity.canUserCreateCalls = false;
    render(<UnitAvailableAlertHost />);

    expect(screen.queryByTestId('unit-available-alert-41-dispatch-7')).toBeNull();
    expect(screen.getByTestId('unit-available-alert-41-open-7')).toBeTruthy();
  });

  it('renders nothing without Dispatch.RunCardConditions', () => {
    mockConditionsEnabled = false;
    render(<UnitAvailableAlertHost />);

    expect(screen.queryByTestId('unit-available-alert-host')).toBeNull();
  });
});

describe('AwaitingResourcesBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConditionsEnabled = true;
    mockPathname = '/';
    mockAwaitingState.calls = [{ CallId: 7 }, { CallId: 8 }];
  });

  it('counts the calls awaiting resources and opens the list', () => {
    const { router } = require('expo-router');
    render(<AwaitingResourcesBanner />);

    expect(screen.getByText(/awaiting_resources\.banner .*"count":2/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('awaiting-resources-banner'));

    expect(router.push).toHaveBeenCalledWith('/awaiting-resources');
  });

  it('stays out of the way when nothing is waiting, on the list itself, or without the flag', () => {
    mockAwaitingState.calls = [];
    const { rerender } = render(<AwaitingResourcesBanner />);
    expect(screen.queryByTestId('awaiting-resources-banner')).toBeNull();

    mockAwaitingState.calls = [{ CallId: 7 }];
    mockPathname = '/awaiting-resources';
    rerender(<AwaitingResourcesBanner />);
    expect(screen.queryByTestId('awaiting-resources-banner')).toBeNull();

    mockPathname = '/';
    mockConditionsEnabled = false;
    rerender(<AwaitingResourcesBanner />);
    expect(screen.queryByTestId('awaiting-resources-banner')).toBeNull();
  });
});
