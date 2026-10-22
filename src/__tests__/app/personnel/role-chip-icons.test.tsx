import { act, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { getPersonnelInfo } from '@/api/personnel/personnel';

import PersonnelDetail from '@/app/personnel/[id]';

const ROLE_ICON_URL = 'https://api.resgrid.dev/api/v4/TypeIcons/0123456789abcdef0123456789abcdef';

jest.mock('@/api/personnel/personnel', () => ({ getPersonnelInfo: jest.fn() }));

// Paramedic has an uploaded icon, Driver does not.
jest.mock('@/hooks/use-role-icons', () => ({
  useRoleIcons: () => new Map([['paramedic', 'https://api.resgrid.dev/api/v4/TypeIcons/0123456789abcdef0123456789abcdef']]),
}));

jest.mock('@/hooks/use-analytics', () => ({ useAnalytics: () => ({ trackEvent: jest.fn() }) }));

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'u1' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: unknown) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
  cssInterop: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/components/ui/focus-aware-status-bar', () => ({ FocusAwareStatusBar: () => null }));
jest.mock('@/components/calls/udf-fields-renderer', () => ({ UdfFieldsRenderer: () => null }));

// Renders which lucide icon the screen asked for, so the plain role marker can be found.
jest.mock('@/components/ui/icon', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  return {
    Icon: ({ as: IconComponent }: { as?: { displayName?: string } }) => mockReact.createElement(View, { testID: `icon-${IconComponent?.displayName ?? 'unknown'}` }),
  };
});

// expo-image is a native view; stand in a plain View that keeps the props the component sets.
jest.mock('expo-image', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  return {
    Image: (props: Record<string, unknown>) => mockReact.createElement(View, props),
  };
});

const hidden = { includeHiddenElements: true };

describe('Personnel detail role chips', () => {
  it("shows each role's uploaded icon on its chip and the plain marker for a role without one", async () => {
    (getPersonnelInfo as jest.Mock).mockResolvedValue({
      Data: { UserId: 'u1', FirstName: 'Jane', LastName: 'Medic', Roles: ['Paramedic', 'Driver'], StatusColor: '#16a34a', UdfValues: [] },
    });

    render(<PersonnelDetail />);
    await waitFor(() => expect(screen.getByText('Paramedic')).toBeTruthy());
    await act(async () => {});

    expect(screen.getByTestId('role-chip-icon-Paramedic-url', hidden).props.source).toEqual({ uri: ROLE_ICON_URL });
    expect(screen.queryByTestId('role-chip-icon-Driver-url', hidden)).toBeNull();
    expect(screen.getByText('Driver')).toBeTruthy();
    expect(screen.getAllByTestId('icon-Shield', hidden).length).toBeGreaterThanOrEqual(1);
  });
});
