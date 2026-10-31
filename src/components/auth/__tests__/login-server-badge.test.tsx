import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { useServerUrlStore } from '@/stores/app/server-url-store';

import { LoginServerBadge } from '../login-server-badge';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      ({
        'login.server.label': 'Server:',
        'login.server.us_west': 'US West',
        'login.server.eu_central': 'EU Central',
      })[key] ?? (key === 'login.server.custom_host' ? `Custom (${options?.host})` : key),
  }),
}));

jest.mock('nativewind', () => ({ useColorScheme: () => ({ colorScheme: 'light' }) }));
jest.mock('@/api/config', () => ({ getSystemConfig: jest.fn() }));
jest.mock('@/lib/mapbox-token', () => ({ clearMapboxToken: jest.fn() }));
jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: jest.fn(() => 'https://api.resgrid.com/api/v4'),
  setBaseApiUrl: jest.fn(),
}));

describe('LoginServerBadge', () => {
  beforeEach(() => {
    useServerUrlStore.setState({ url: '' });
  });

  it('names the stored server before anything changes it', () => {
    render(<LoginServerBadge />);
    expect(screen.getByText('US West')).toBeTruthy();
  });

  it('follows a server change', async () => {
    render(<LoginServerBadge />);
    await act(async () => {
      await useServerUrlStore.getState().setUrl('https://api-eu-central.resgrid.com/api/v4');
    });
    expect(screen.getByText('EU Central')).toBeTruthy();

    await act(async () => {
      await useServerUrlStore.getState().setUrl('https://rg.example.org/api/v4');
    });
    expect(screen.getByText('Custom (rg.example.org)')).toBeTruthy();
  });

  it('opens the server selector when pressed', () => {
    const onPress = jest.fn();
    render(<LoginServerBadge onPress={onPress} />);
    fireEvent.press(screen.getByTestId('login-server-badge'));
    expect(onPress).toHaveBeenCalled();
  });

  it('is a button only when it opens something', () => {
    const { rerender } = render(<LoginServerBadge onPress={jest.fn()} />);
    expect(screen.getByTestId('login-server-badge').props.accessibilityRole).toBe('button');

    rerender(<LoginServerBadge />);
    expect(screen.getByTestId('login-server-badge').props.accessibilityRole).toBeUndefined();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
