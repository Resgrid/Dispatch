import { act, render, screen } from '@testing-library/react-native';
import React from 'react';

import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';

import { ResourcesPanel } from '../resources-panel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

// Renders which lucide icon the panel asked for, so the person avatar fallback can be found.
jest.mock('@/components/ui/icon', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  return {
    Icon: ({ as: IconComponent }: { as?: { displayName?: string } }) => mockReact.createElement(View, { testID: `icon-${IconComponent?.displayName ?? 'unknown'}` }),
  };
});

jest.mock('../animated-refresh-icon', () => ({
  AnimatedRefreshIcon: () => null,
}));

// Multi-unit selection is not part of this test; a closed selection keeps the rows on their normal press path.
jest.mock('../unit-multi-select', () => ({
  useUnitMultiSelect: () => ({
    isSelectionMode: false,
    selectedUnitIds: [],
    selectedUnitIdSet: new Set<string>(),
    toggleSelectionMode: jest.fn(),
    handleUnitPress: () => false,
    handleUnitLongPress: jest.fn(),
    addUnits: jest.fn(),
    clearSelection: jest.fn(),
    endSelection: jest.fn(),
  }),
  UnitMultiSelectToggle: () => null,
  UnitSelectionBar: () => null,
  UnitSelectionCheckbox: () => null,
}));

// expo-image is a native view; stand in a plain View that keeps the props the component sets.
jest.mock('expo-image', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  return {
    Image: (props: Record<string, unknown>) => mockReact.createElement(View, props),
  };
});

let mockPersonnel: PersonnelInfoResultData[] = [];

jest.mock('@/stores/units/store', () => ({
  useUnitsStore: (selector: (state: unknown) => unknown) => selector({ units: [], isLoading: false, fetchUnits: jest.fn() }),
}));

jest.mock('@/stores/personnel/store', () => ({
  usePersonnelStore: (selector: (state: unknown) => unknown) => selector({ personnel: mockPersonnel, isLoading: false, fetchPersonnel: jest.fn() }),
}));

jest.mock('@/stores/dispatch/dashboard-view-store', () => ({
  useDashboardViewStore: (selector: (state: unknown) => unknown) => selector({ availableOnly: false, collapsedCards: {}, setCardCollapsed: jest.fn() }),
  selectCardCollapsed: () => () => false,
}));

const ROLE_ICON_URL = 'https://api.resgrid.dev/api/v4/TypeIcons/0123456789abcdef0123456789abcdef';

const person = (patch: Partial<PersonnelInfoResultData> = {}): PersonnelInfoResultData =>
  ({
    UserId: 'u-jane',
    FirstName: 'Jane',
    LastName: 'Doe',
    GroupName: 'Station 1',
    Status: 'Available',
    StatusColor: '#16a34a',
    Staffing: 'On Duty',
    Roles: ['Paramedic'],
    ...patch,
  }) as PersonnelInfoResultData;

// The role icon is decorative (hidden from screen readers), so it is looked up with hidden elements included.
const hidden = { includeHiddenElements: true };

describe('ResourcesPanel personnel role icon', () => {
  afterEach(() => {
    mockPersonnel = [];
  });

  it("shows the person's role icon in place of the person glyph", () => {
    mockPersonnel = [person({ RoleIconUrl: ROLE_ICON_URL })];

    render(<ResourcesPanel />);

    const icon = screen.getByTestId('resource-role-icon-u-jane-url', hidden);
    expect(icon.props.source).toEqual({ uri: ROLE_ICON_URL });
    expect(icon.props.style).toEqual(expect.objectContaining({ width: 22, height: 22, backgroundColor: '#ffffff' }));
    expect(screen.queryByTestId('icon-User', hidden)).toBeNull();
    expect(screen.getByText('Jane Doe')).toBeTruthy();
  });

  it('keeps the person glyph when the person has no role icon', () => {
    mockPersonnel = [person({ RoleIconUrl: null })];

    render(<ResourcesPanel />);

    expect(screen.queryByTestId('resource-role-icon-u-jane-url', hidden)).toBeNull();
    expect(screen.getByTestId('icon-User', hidden)).toBeTruthy();
  });

  it('falls back to the person glyph when the role icon fails to load', () => {
    mockPersonnel = [person({ RoleIconUrl: ROLE_ICON_URL })];

    render(<ResourcesPanel />);
    act(() => {
      screen.getByTestId('resource-role-icon-u-jane-url', hidden).props.onError();
    });

    expect(screen.queryByTestId('resource-role-icon-u-jane-url', hidden)).toBeNull();
    expect(screen.getByTestId('icon-User', hidden)).toBeTruthy();
  });
});
