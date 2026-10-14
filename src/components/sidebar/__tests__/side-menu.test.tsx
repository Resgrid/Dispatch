import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { terminologyStore } from '@/stores/terminology/store';

import SideMenu from '../side-menu';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'menu.menu': 'Menu',
        'menu.home': 'Home',
        'menu.calls': 'Calls',
        'menu.calls_list': 'Calls List',
        'menu.new_call': 'New Call',
        'menu.map': 'Map',
        'menu.pois': 'POIs',
        'menu.personnel': 'Personnel',
        'menu.units': 'Units',
        'menu.messages': 'Messages',
        'menu.protocols': 'Protocols',
        'menu.contacts': 'Contacts',
        'menu.settings': 'Settings',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock expo-router
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('SideMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', () => {
    render(<SideMenu />);

    expect(screen.getByTestId('side-menu-scroll-view')).toBeTruthy();
  });

  it('should render header', () => {
    render(<SideMenu />);

    expect(screen.getByText('Menu')).toBeTruthy();
  });

  it('should render all menu items', () => {
    render(<SideMenu />);

    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Calls')).toBeTruthy();
    expect(screen.getByText('Map')).toBeTruthy();
    expect(screen.getByText('POIs')).toBeTruthy();
    expect(screen.getByText('Personnel')).toBeTruthy();
    expect(screen.getByText('Units')).toBeTruthy();
    expect(screen.getByText('Protocols')).toBeTruthy();
    expect(screen.getByText('Contacts')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('should call onNavigate when a menu item is pressed', () => {
    const mockOnNavigate = jest.fn();
    render(<SideMenu onNavigate={mockOnNavigate} />);

    const homeItem = screen.getByText('Home');
    fireEvent.press(homeItem);

    expect(mockOnNavigate).toHaveBeenCalledTimes(1);
  });

  it('should navigate to correct route when menu item is pressed', async () => {
    const mockOnNavigate = jest.fn();
    render(<SideMenu onNavigate={mockOnNavigate} />);

    // Test direct navigation with Settings (not a parent item)
    const settingsItem = screen.getByText('Settings');
    fireEvent.press(settingsItem);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/settings');
    });
  });

  it('should navigate to the POIs route when the POIs item is pressed', async () => {
    const mockOnNavigate = jest.fn();
    render(<SideMenu onNavigate={mockOnNavigate} />);

    const poisItem = screen.getByText('POIs');
    fireEvent.press(poisItem);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/pois');
      expect(mockOnNavigate).toHaveBeenCalled();
    });
  });

  it('should expand parent menu items to show children', async () => {
    render(<SideMenu />);

    // Calls is a parent item - pressing it should expand to show children
    const callsItem = screen.getByText('Calls');
    fireEvent.press(callsItem);

    // After expanding, child items should be visible
    await waitFor(() => {
      expect(screen.getByText('Calls List')).toBeTruthy();
      expect(screen.getByText('New Call')).toBeTruthy();
    });
  });

  it('should navigate when child menu item is pressed', async () => {
    const mockOnNavigate = jest.fn();
    render(<SideMenu onNavigate={mockOnNavigate} />);

    // First expand the Calls parent
    const callsItem = screen.getByText('Calls');
    fireEvent.press(callsItem);

    // Wait for children to be visible and press Calls List
    await waitFor(() => {
      expect(screen.getByText('Calls List')).toBeTruthy();
    });

    const callsListItem = screen.getByText('Calls List');
    fireEvent.press(callsListItem);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/calls');
      expect(mockOnNavigate).toHaveBeenCalled();
    });
  });

  it('should work without onNavigate prop', async () => {
    render(<SideMenu />);

    const settingsItem = screen.getByText('Settings');
    fireEvent.press(settingsItem);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/settings');
    });
  });

  it('should display menu items with lucide icons', () => {
    render(<SideMenu />);

    // Verify all menu item labels are rendered (icons are now lucide components)
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Calls')).toBeTruthy();
    expect(screen.getByText('Map')).toBeTruthy();
    expect(screen.getByText('POIs')).toBeTruthy();
    expect(screen.getByText('Personnel')).toBeTruthy();
    expect(screen.getByText('Units')).toBeTruthy();
    expect(screen.getByText('Protocols')).toBeTruthy();
    expect(screen.getByText('Contacts')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('should apply light theme styles by default', () => {
    render(<SideMenu />);

    const container = screen.getByTestId('side-menu-scroll-view');
    expect(container).toBeTruthy();
  });

  it("should label modules with the department's own names", () => {
    terminologyStore.setState({ names: { 'module.calls': 'Incidents', 'module.units': 'Apparatus' } });
    try {
      const { unmount } = render(<SideMenu />);

      expect(screen.getByText('Incidents')).toBeTruthy();
      expect(screen.getByText('Apparatus')).toBeTruthy();
      expect(screen.queryByText('Calls')).toBeNull();
      expect(screen.queryByText('Units')).toBeNull();
      // Modules the department did not rename keep the app's own label.
      expect(screen.getByText('Personnel')).toBeTruthy();
      unmount();
    } finally {
      terminologyStore.setState({ names: {} });
    }
  });

  it('should accept colorScheme prop for dark mode', () => {
    render(<SideMenu colorScheme="dark" />);

    const container = screen.getByTestId('side-menu-scroll-view');
    expect(container).toBeTruthy();
  });
});
