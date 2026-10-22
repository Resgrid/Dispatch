import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { DispatchSelectionModal } from '../dispatch-selection-modal';

const ROLE_ICON_URL = 'https://api.resgrid.dev/api/v4/TypeIcons/0123456789abcdef0123456789abcdef';
const PERSON_ICON_URL = 'https://api.resgrid.dev/api/v4/TypeIcons/fedcba9876543210fedcba9876543210';

// One role and one person with an icon, and one of each without.
const mockData = {
  users: [
    { Id: 'u1', Name: 'Jane Medic', TypeIconUrl: PERSON_ICON_URL },
    { Id: 'u2', Name: 'Sam Driver', TypeIconUrl: null },
  ],
  groups: [],
  roles: [
    { Id: '7', Name: 'Paramedic', TypeIconUrl: ROLE_ICON_URL },
    { Id: '8', Name: 'Driver' },
  ],
  units: [],
};

const mockDispatchStore = {
  data: mockData,
  selection: { everyone: false, users: [] as string[], groups: [] as string[], roles: [] as string[], units: [] as string[] },
  isLoading: false,
  error: null,
  loadFailures: { users: false, groups: false, roles: false, units: false },
  searchQuery: '',
  fetchDispatchData: jest.fn(),
  setSelection: jest.fn(),
  toggleEveryone: jest.fn(),
  toggleUser: jest.fn(),
  toggleGroup: jest.fn(),
  toggleRole: jest.fn(),
  toggleUnit: jest.fn(),
  setSearchQuery: jest.fn(),
  clearSelection: jest.fn(),
};

jest.mock('@/stores/dispatch/store', () => ({
  useDispatchStore: jest.fn(() => mockDispatchStore),
  filterDispatchData: (data: unknown) => data,
}));

jest.mock('@/components/runcards/use-add-resources-recommendation', () => ({
  useAddResourcesRecommendation: () => ({ isRunCardsEnabled: false, recommendation: null, isLoading: false, error: null, hasFetched: false, isApplied: false, refresh: jest.fn(), applyToSelection: (s: unknown) => s }),
}));

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: unknown) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
  cssInterop: jest.fn(),
}));

jest.mock('@/components/ui/actionsheet', () => {
  const { View } = require('react-native');
  return {
    Actionsheet: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => (isOpen ? <View>{children}</View> : null),
    ActionsheetBackdrop: () => null,
    ActionsheetContent: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    ActionsheetDragIndicator: () => null,
    ActionsheetDragIndicatorWrapper: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// expo-image is a native view; stand in a plain View that keeps the props the component sets.
jest.mock('expo-image', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  return {
    Image: (props: Record<string, unknown>) => mockReact.createElement(View, props),
  };
});

// The icons are decorative (hidden from screen readers), so they are looked up with hidden elements included.
const hidden = { includeHiddenElements: true };

const renderModal = () =>
  render(
    <DispatchSelectionModal
      isVisible
      onClose={jest.fn()}
      onConfirm={jest.fn()}
      initialSelection={{ everyone: false, users: [], groups: [], roles: [], units: [] }}
    />
  );

describe('DispatchSelectionModal role icons', () => {
  it("shows a role's own icon beside the role", () => {
    renderModal();

    const icon = screen.getByTestId('dispatch-role-icon-7-url', hidden);
    expect(icon.props.source).toEqual({ uri: ROLE_ICON_URL });
    expect(icon.props.style).toEqual(expect.objectContaining({ width: 20, height: 20 }));
    expect(screen.getByText('Paramedic')).toBeTruthy();
  });

  it("shows a person's role icon beside their name", () => {
    renderModal();

    expect(screen.getByTestId('dispatch-user-icon-u1-url', hidden).props.source).toEqual({ uri: PERSON_ICON_URL });
    expect(screen.getByText('Jane Medic')).toBeTruthy();
  });

  it('shows no icon for a role or person without one', () => {
    renderModal();

    expect(screen.queryByTestId('dispatch-role-icon-8-url', hidden)).toBeNull();
    expect(screen.queryByTestId('dispatch-user-icon-u2-url', hidden)).toBeNull();
    expect(screen.getByText('Driver')).toBeTruthy();
    expect(screen.getByText('Sam Driver')).toBeTruthy();
  });
});
