import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';

import { PersonnelPanel } from '../personnel-panel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

// Renders which lucide icon the panel asked for (and in what color), so the avatar's fallback can be found.
jest.mock('@/components/ui/icon', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  return {
    Icon: ({ as: IconComponent, color }: { as?: { displayName?: string }; color?: string }) => mockReact.createElement(View, { testID: `icon-${IconComponent?.displayName ?? 'unknown'}`, color }),
  };
});

jest.mock('../animated-refresh-icon', () => ({
  AnimatedRefreshIcon: () => null,
}));

// expo-image is a native view; stand in a plain View that keeps the props the component sets.
jest.mock('expo-image', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  return {
    Image: (props: Record<string, unknown>) => mockReact.createElement(View, props),
  };
});

const ROLE_ICON_URL = 'https://api.resgrid.dev/api/v4/TypeIcons/r4.png';
const STATUS_COLOR = '#16a34a';

const person = (patch: Partial<PersonnelInfoResultData> = {}): PersonnelInfoResultData =>
  ({
    UserId: 'u-jane',
    FirstName: 'Jane',
    LastName: 'Doe',
    GroupName: 'Station 1',
    Status: 'Available',
    StatusColor: STATUS_COLOR,
    Staffing: 'On Duty',
    StaffingColor: '#2563eb',
    StatusDestinationName: '',
    Roles: ['Paramedic', 'Driver'],
    ...patch,
  }) as PersonnelInfoResultData;

// The role icon is decorative (hidden from screen readers), so it is looked up with hidden elements included.
const hidden = { includeHiddenElements: true };
const roleIcon = () => screen.queryByTestId('personnel-role-icon-u-jane-url', hidden);
const fallbackAvatar = () => screen.queryByTestId('icon-User', hidden);

const renderPanel = (people: PersonnelInfoResultData[]) => render(<PersonnelPanel personnel={people} isLoading={false} onRefresh={jest.fn()} />);

describe('PersonnelPanel role icon avatar', () => {
  it("shows the person's role icon in place of the person avatar", () => {
    renderPanel([person({ RoleIconUrl: ROLE_ICON_URL })]);

    expect(roleIcon()!.props.source).toEqual({ uri: ROLE_ICON_URL });
    expect(roleIcon()!.props.style).toEqual(expect.objectContaining({ width: 20, height: 20 }));
    expect(fallbackAvatar()).toBeNull();
    // The roles are still listed as text beside it
    expect(screen.getByText('Paramedic, Driver')).toBeTruthy();
  });

  it('keeps the status color as the ring around the role icon', () => {
    renderPanel([person({ RoleIconUrl: ROLE_ICON_URL })]);

    // The nearest ancestor with a border is the avatar ring.
    let ring = screen.getByTestId('personnel-role-icon-u-jane', hidden).parent;
    while (ring && !StyleSheet.flatten(ring.props.style)?.borderColor) ring = ring.parent;
    expect(StyleSheet.flatten(ring?.props.style)).toEqual(expect.objectContaining({ borderColor: STATUS_COLOR, borderWidth: 2 }));
  });

  it('falls back to the status-colored person avatar when the role icon fails to load', () => {
    renderPanel([person({ RoleIconUrl: ROLE_ICON_URL })]);

    fireEvent(roleIcon()!, 'error');

    expect(roleIcon()).toBeNull();
    expect(fallbackAvatar()!.props.color).toBe(STATUS_COLOR);
  });

  it('shows the status-colored person avatar when none of their roles has an icon (or from older servers)', () => {
    renderPanel([person({ RoleIconUrl: null }), person({ UserId: 'u-sam', FirstName: 'Sam', RoleIconUrl: undefined })]);

    expect(roleIcon()).toBeNull();
    expect(screen.getAllByTestId('icon-User', hidden)).toHaveLength(2);
    screen.getAllByTestId('icon-User', hidden).forEach((icon) => expect(icon.props.color).toBe(STATUS_COLOR));
  });

  it('ignores a role icon URL that is not an absolute http(s) URL', () => {
    renderPanel([person({ RoleIconUrl: '/api/v4/TypeIcons/r4.png' })]);

    expect(roleIcon()).toBeNull();
    expect(fallbackAvatar()).not.toBeNull();
  });
});
