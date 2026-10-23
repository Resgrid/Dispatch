import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';

import { UnitsPanel } from '../units-panel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/components/ui/icon', () => ({
  Icon: () => null,
}));

jest.mock('../animated-refresh-icon', () => ({
  AnimatedRefreshIcon: () => null,
}));

jest.mock('../resources-panel', () => ({
  ResourcesPanel: () => null,
}));

const units = [
  {
    UnitId: 'e1',
    Name: 'Engine 1',
    Type: 'Engine',
    GroupName: 'Station 1',
    CurrentStatus: 'Available',
    CurrentStatusId: '0',
    CurrentDestinationId: '',
    Roles: [
      { RoleId: 'r1', RoleName: 'Officer', UserId: 'u1', Name: 'Taylor Brooks' },
      { RoleId: 'r2', RoleName: 'Driver', UserId: 'u2', Name: 'Priya Natarajan' },
      { RoleId: 'r3', RoleName: 'Firefighter', UserId: '', Name: '' },
    ],
  },
  { UnitId: 'b1', Name: 'Boat 1', Type: '', GroupName: 'Station 2', CurrentStatus: 'Available', CurrentStatusId: '0', CurrentDestinationId: '', Roles: [] },
] as unknown as UnitInfoResultData[];

describe('UnitsPanel unit type and crew', () => {
  it("shows the unit's type with its group, and its filled role seats followed by the people on them", () => {
    render(<UnitsPanel units={units} isLoading={false} onRefresh={jest.fn()} />);

    expect(screen.getByText('Engine · Station 1')).toBeTruthy();
    expect(screen.getByTestId('unit-crew-count-e1')).toHaveTextContent('2/3');
    expect(screen.getByTestId('unit-crew-names-e1')).toHaveTextContent('Taylor Brooks, Priya Natarajan');
    // No type and no roles: the group alone, and no crew line
    expect(screen.getByText('Station 2')).toBeTruthy();
    expect(screen.queryByTestId('unit-crew-b1')).toBeNull();
  });

  it('finds a unit by a person on it', () => {
    render(<UnitsPanel units={units} isLoading={false} onRefresh={jest.fn()} />);

    fireEvent.changeText(screen.getByPlaceholderText('dispatch.search_units_placeholder'), 'priya');

    expect(screen.getByText('Engine 1')).toBeTruthy();
    expect(screen.queryByText('Boat 1')).toBeNull();
  });
});
