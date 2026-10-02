import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import LoginWeb from '../../../app/login/index.web';
import { useAuth } from '@/lib/auth';

// Mock hooks and dependencies
const mockLogin = jest.fn();
const mockTrackEvent = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();

// Map @/components/ui/text to the standard RN Text so getByText works
jest.mock('@/components/ui/text', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Text: ({ children, ...props }: any) => React.createElement(Text, props, children),
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const translations: Record<string, string> = {
        'login.page_subtitle': 'Enter the information below to Sign in to the Resgrid Dispatch application.',
        'login.username_placeholder': 'Enter your username',
        'login.password_placeholder': 'Enter your password',
        'login.login_button': 'Login',
        'login.login_button_loading': 'Logging in...',
        'login.no_account': "Don't have an account?",
        'login.register': 'Register',
        'login.footer_text': 'Created with ❤️ in Lake Tahoe',
        'settings.server_url': 'Server URL',
        'login.errorModal.title': 'Login Failed',
        'login.errorModal.message': 'Please check your username and password and try again.',
        'login.errorModal.confirmButton': 'OK',
        'common.cancel': 'Cancel',
        'common.save': 'Save',
        'sso.sso_button': 'SSO Login',
      };
      return translations[key] || fallback || key;
    },
  }),
}));

jest.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({
    trackEvent: mockTrackEvent,
  }),
}));

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(),
}));

// The sign-in prompts render as markers carrying whether they are open.
jest.mock('@/components/auth/login-mfa-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { LoginMfaSheet: ({ isOpen }: { isOpen: boolean }) => (isOpen ? React.createElement(View, { testID: 'login-mfa-sheet-open' }) : null) };
});
jest.mock('@/components/auth/login-otp-modal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { LoginOtpModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? React.createElement(View, { testID: 'login-otp-open' }) : null) };
});

jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/env', () => ({
  Env: {
    API_VERSION: 'v4',
  },
}));

jest.mock('@/stores/app/server-url-store', () => ({
  useServerUrlStore: () => ({
    setUrl: jest.fn(),
    getUrl: jest.fn().mockResolvedValue('https://api.example.com/api/v4'),
  }),
}));

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: () => ({
    colorScheme: 'light',
  }),
}));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  default: () => ({
    width: 1200,
    height: 800,
  }),
}));

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  // Support any chain of .delay().duration() or .duration().delay()
  const animChain: any = () => ({ duration: animChain, delay: animChain });
  return {
    ...Reanimated,
    FadeIn: animChain(),
    FadeInDown: animChain(),
    FadeInUp: animChain(),
    FadeInRight: animChain(),
    FadeOut: animChain(),
    FadeOutLeft: animChain(),
  };
});

jest.mock('lucide-react-native', () => ({
  AlertCircle: () => null,
  Eye: () => null,
  EyeOff: () => null,
  Loader2: () => null,
  Lock: () => null,
  MonitorCog: () => null,
  Server: () => null,
  User: () => null,
}));

describe('LoginWeb', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      status: 'idle',
      error: null,
      isAuthenticated: false,
    });
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<LoginWeb />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders the login button', () => {
    render(<LoginWeb />);
    expect(screen.getByText('Login')).toBeTruthy();
  });

  it('renders the server URL button', () => {
    render(<LoginWeb />);
    expect(screen.getByText('Server URL')).toBeTruthy();
  });

  it('renders the SSO login button', () => {
    render(<LoginWeb />);
    expect(screen.getByText('SSO Login')).toBeTruthy();
  });

  it('renders the page subtitle', () => {
    render(<LoginWeb />);
    expect(screen.getByText('Enter the information below to Sign in to the Resgrid Dispatch application.')).toBeTruthy();
  });

  it('renders the footer registration link', () => {
    render(<LoginWeb />);
    expect(screen.getByText(/Don't have an account/)).toBeTruthy();
    expect(screen.getByText('Register')).toBeTruthy();
  });

  it('renders the copyright text', () => {
    render(<LoginWeb />);
    expect(screen.getByText(/Resgrid, LLC/)).toBeTruthy();
  });

  it('opens server URL modal when server URL button is pressed', () => {
    render(<LoginWeb />);
    fireEvent.press(screen.getByText('Server URL'));
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('closes server URL modal when cancel is pressed', async () => {
    render(<LoginWeb />);
    fireEvent.press(screen.getByText('Server URL'));
    expect(screen.getByText('Cancel')).toBeTruthy();
    fireEvent.press(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(screen.queryByText('Cancel')).toBeNull();
    });
  });

  it('navigates to SSO login when SSO button is pressed', () => {
    render(<LoginWeb />);
    fireEvent.press(screen.getByText('SSO Login'));
    expect(mockPush).toHaveBeenCalledWith('/login/sso');
  });

  it('shows loading text when auth status is loading', () => {
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      status: 'loading',
      error: null,
      isAuthenticated: false,
    });
    render(<LoginWeb />);
    expect(screen.getByText('Logging in...')).toBeTruthy();
    expect(screen.queryByText('Login')).toBeNull();
  });

  it('shows error modal when auth status is error', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      status: 'error',
      error: 'Invalid credentials',
      isAuthenticated: false,
    });
    render(<LoginWeb />);
    await waitFor(() => {
      expect(screen.getByText('Login Failed')).toBeTruthy();
      expect(screen.getByText('Please check your username and password and try again.')).toBeTruthy();
    });
  });

  it('closes error modal when OK is pressed', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      status: 'error',
      error: 'Invalid credentials',
      isAuthenticated: false,
    });
    render(<LoginWeb />);
    await waitFor(() => {
      expect(screen.getByText('OK')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('OK'));
    await waitFor(() => {
      expect(screen.queryByText('Login Failed')).toBeNull();
    });
  });

  it('redirects to home when authentication succeeds', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      status: 'signedIn',
      error: null,
      isAuthenticated: true,
    });
    render(<LoginWeb />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(app)');
    });
  });

  it('tracks page view analytics on mount', () => {
    render(<LoginWeb />);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'login_web_view_rendered',
      expect.objectContaining({
        hasError: false,
        status: 'idle',
      })
    );
  });

  describe('second factor (the web sign-in gap)', () => {
    const { default: useAuthStore } = jest.requireActual('@/stores/auth/store') as typeof import('@/stores/auth/store');

    afterEach(() => useAuthStore.setState({ mfaChallenge: null }));

    it('opens the second-factor sheet when the sign-in continues on a login transaction', () => {
      (useAuth as jest.Mock).mockReturnValue({ login: mockLogin, status: 'mfaRequired', error: null, isAuthenticated: false });
      useAuthStore.setState({ mfaChallenge: { kind: 'verify', methods: ['totp'], enrolled: ['totp'], preferred: 'totp', expiresAt: null, source: 'password' } });

      render(<LoginWeb />);

      expect(screen.getByTestId('login-mfa-sheet-open')).toBeTruthy();
      expect(screen.queryByTestId('login-otp-open')).toBeNull();
    });

    it("leaves a single sign-on's second factor to the SSO screen on top of it", () => {
      (useAuth as jest.Mock).mockReturnValue({ login: mockLogin, status: 'mfaRequired', error: null, isAuthenticated: false });
      useAuthStore.setState({ mfaChallenge: { kind: 'verify', methods: ['totp'], enrolled: ['totp'], preferred: 'totp', expiresAt: null, source: 'sso' } });

      render(<LoginWeb />);

      expect(screen.queryByTestId('login-mfa-sheet-open')).toBeNull();
    });

    it("keeps the older server's code prompt closed with no sign-in to resubmit", () => {
      (useAuth as jest.Mock).mockReturnValue({ login: mockLogin, status: 'mfaRequired', error: null, isAuthenticated: false });
      useAuthStore.setState({ mfaChallenge: { kind: 'legacy', methods: ['totp'], enrolled: ['totp'], preferred: 'totp', expiresAt: null, source: 'password' } });

      render(<LoginWeb />);

      expect(screen.queryByTestId('login-mfa-sheet-open')).toBeNull();
      expect(screen.queryByTestId('login-otp-open')).toBeNull();
    });
  });

  it('offers the shared device setting and opens it', () => {
    render(<LoginWeb />);

    fireEvent.press(screen.getByTestId('login-shared-device'));

    expect(screen.getByText('shared_session.device_setup')).toBeTruthy();
    expect(mockPush).toHaveBeenCalledWith('/login/shared-device');
  });
});
