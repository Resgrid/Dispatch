import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import Maintenance from '../../../app/maintenance';
import { Env } from '@/lib/env';

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useIsFocused: jest.fn(() => true),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/env', () => ({
  Env: {
    MAINTENANCE_MODE: true,
  },
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

describe('Maintenance', () => {
  const mockReplace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      replace: mockReplace,
    });
  });

  it('should render maintenance page correctly', () => {
    render(
      <TestWrapper>
        <Maintenance />
      </TestWrapper>
    );

    expect(screen.getByText('maintenance.title')).toBeTruthy();
    expect(screen.getByText('maintenance.message')).toBeTruthy();
    expect(screen.getByText('maintenance.why_down_title')).toBeTruthy();
    expect(screen.getByText('maintenance.downtime_title')).toBeTruthy();
    expect(screen.getByText('maintenance.support_title')).toBeTruthy();
  });

  it('should display all info cards', () => {
    render(
      <TestWrapper>
        <Maintenance />
      </TestWrapper>
    );

    expect(screen.getByText('maintenance.why_down_message')).toBeTruthy();
    expect(screen.getByText('maintenance.downtime_message')).toBeTruthy();
    // Support message contains nested text with email, so use getByText with options
    expect(screen.getByText(/maintenance.support_message/)).toBeTruthy();
  });

  it('should display support email', () => {
    render(
      <TestWrapper>
        <Maintenance />
      </TestWrapper>
    );

    expect(screen.getByText('support@resgrid.com')).toBeTruthy();
  });

  it('should redirect to login if maintenance mode is disabled', () => {
    (Env as any).MAINTENANCE_MODE = false;

    render(
      <TestWrapper>
        <Maintenance />
      </TestWrapper>
    );

    waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('should display copyright and version info', () => {
    render(
      <TestWrapper>
        <Maintenance />
      </TestWrapper>
    );

    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`${currentYear}`))).toBeTruthy();
  });
});
