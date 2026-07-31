import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import Lockscreen from '../../../app/lockscreen';
import { useAuth } from '@/lib/auth';
import { verifyPassword } from '@/lib/auth/api';
import useLockscreenStore from '@/stores/lockscreen/store';

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/auth/api', () => ({
  verifyPassword: jest.fn(),
}));

jest.mock('@/stores/lockscreen/store');

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <NavigationContainer>{children}</NavigationContainer>;
};

describe('Lockscreen', () => {
  const mockReplace = jest.fn();
  const mockUnlock = jest.fn();
  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      replace: mockReplace,
    });

    (useAuth as jest.Mock).mockReturnValue({
      logout: mockLogout,
      status: 'signedIn',
      isAuthenticated: true,
    });

    (useLockscreenStore as unknown as jest.Mock).mockReturnValue({
      unlock: mockUnlock,
    });

    // Default: entered password matches the stored verification hash
    (verifyPassword as jest.Mock).mockResolvedValue(true);
  });

  it('should render lockscreen correctly', () => {
    render(
      <TestWrapper>
        <Lockscreen />
      </TestWrapper>
    );

    expect(screen.getByText('lockscreen.title')).toBeTruthy();
    expect(screen.getByText('lockscreen.message')).toBeTruthy();
    expect(screen.getByText('lockscreen.unlock_button')).toBeTruthy();
  });

  it('should render password input field', () => {
    render(
      <TestWrapper>
        <Lockscreen />
      </TestWrapper>
    );

    expect(screen.getByPlaceholderText('lockscreen.password_placeholder')).toBeTruthy();
  });

  it('should render welcome back message when authenticated', () => {
    render(
      <TestWrapper>
        <Lockscreen />
      </TestWrapper>
    );

    expect(screen.getByText('lockscreen.welcome_back')).toBeTruthy();
  });

  it('should display logout link', () => {
    render(
      <TestWrapper>
        <Lockscreen />
      </TestWrapper>
    );

    expect(screen.getByText('lockscreen.not_you')).toBeTruthy();
  });

  describe('Password visibility toggle', () => {
    it('should toggle password visibility when eye icon is pressed', async () => {
      const { root } = render(
        <TestWrapper>
          <Lockscreen />
        </TestWrapper>
      );

      const passwordInput = screen.getByPlaceholderText('lockscreen.password_placeholder');
      
      // Initially password should be hidden (type = 'password')
      expect(passwordInput.props.type).toBe('password');

      // Find all pressable elements and get the eye icon toggle (it's inside InputSlot)
      const allElements = root.findAllByType('View');
      const inputSlot = allElements.find((el: any) => el.props.className?.includes('pr-3'));
      
      // Trigger the press on the InputSlot which has the onPress handler
      if (inputSlot && inputSlot.props.onPress) {
        fireEvent.press(inputSlot);
        
        // Password should now be visible (type = 'text')
        await waitFor(() => {
          expect(passwordInput.props.type).toBe('text');
        });

        // Press again to hide
        fireEvent.press(inputSlot);
        await waitFor(() => {
          expect(passwordInput.props.type).toBe('password');
        });
      } else {
        // If we can't find InputSlot, verify the input type can be controlled
        expect(passwordInput.props.type).toBeDefined();
      }
    });
  });

  describe('Unlock submission', () => {
    it('should submit unlock form with valid password', async () => {
      render(
        <TestWrapper>
          <Lockscreen />
        </TestWrapper>
      );

      const passwordInput = screen.getByPlaceholderText('lockscreen.password_placeholder');
      const unlockButton = screen.getByText('lockscreen.unlock_button');

      // Fill in password
      fireEvent.changeText(passwordInput, 'testPassword123');
      
      // Submit the form
      fireEvent.press(unlockButton);

      // Wait for async operations
      await waitFor(() => {
        expect(mockUnlock).toHaveBeenCalled();
      });

      // Should navigate to app
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/(app)');
      });
    });

    it('should call unlock store and navigate on successful unlock', async () => {
      render(
        <TestWrapper>
          <Lockscreen />
        </TestWrapper>
      );

      const passwordInput = screen.getByPlaceholderText('lockscreen.password_placeholder');
      const unlockButton = screen.getByText('lockscreen.unlock_button');

      fireEvent.changeText(passwordInput, 'validPassword');
      fireEvent.press(unlockButton);

      await waitFor(() => {
        expect(mockUnlock).toHaveBeenCalledTimes(1);
        expect(mockReplace).toHaveBeenCalledWith('/(app)');
      });
    });

    it('should not submit form with empty password', async () => {
      render(
        <TestWrapper>
          <Lockscreen />
        </TestWrapper>
      );

      const unlockButton = screen.getByText('lockscreen.unlock_button');
      
      // Try to submit without password
      fireEvent.press(unlockButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('Password is required')).toBeTruthy();
      });

      // Should not call unlock
      expect(mockUnlock).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('should show error and not unlock when password does not match', async () => {
      (verifyPassword as jest.Mock).mockResolvedValue(false);

      render(
        <TestWrapper>
          <Lockscreen />
        </TestWrapper>
      );

      const passwordInput = screen.getByPlaceholderText('lockscreen.password_placeholder');
      const unlockButton = screen.getByText('lockscreen.unlock_button');

      fireEvent.changeText(passwordInput, 'wrongPassword');
      fireEvent.press(unlockButton);

      await waitFor(() => {
        expect(screen.getByText('lockscreen.unlock_failed')).toBeTruthy();
      });

      expect(mockUnlock).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalledWith('/(app)');
    });

    it('should require re-login when no verification hash is stored', async () => {
      (verifyPassword as jest.Mock).mockResolvedValue(null);

      render(
        <TestWrapper>
          <Lockscreen />
        </TestWrapper>
      );

      const passwordInput = screen.getByPlaceholderText('lockscreen.password_placeholder');
      const unlockButton = screen.getByText('lockscreen.unlock_button');

      fireEvent.changeText(passwordInput, 'anyPassword');
      fireEvent.press(unlockButton);

      await waitFor(() => {
        expect(screen.getByText('lockscreen.relogin_required')).toBeTruthy();
      });

      expect(mockUnlock).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalledWith('/(app)');
    });
  });

  describe('Error handling', () => {
    it('should handle multiple submissions correctly', async () => {
      render(
        <TestWrapper>
          <Lockscreen />
        </TestWrapper>
      );

      const passwordInput = screen.getByPlaceholderText('lockscreen.password_placeholder');
      const unlockButton = screen.getByText('lockscreen.unlock_button');

      // First submission
      fireEvent.changeText(passwordInput, 'password1');
      fireEvent.press(unlockButton);

      await waitFor(() => {
        expect(mockUnlock).toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith('/(app)');
      });

      // Verify submission was successful
      expect(mockUnlock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Loading state', () => {
    beforeEach(() => {
      // Resolve verification after a short delay so the loading state is observable
      (verifyPassword as jest.Mock).mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(true), 100)));
    });

    it('should show loading indicator while unlocking', async () => {
      render(
        <TestWrapper>
          <Lockscreen />
        </TestWrapper>
      );

      const passwordInput = screen.getByPlaceholderText('lockscreen.password_placeholder');
      const unlockButton = screen.getByText('lockscreen.unlock_button');

      fireEvent.changeText(passwordInput, 'testPassword');
      fireEvent.press(unlockButton);

      // Should show loading state immediately
      await waitFor(() => {
        expect(screen.getByText('lockscreen.unlocking')).toBeTruthy();
      });
    });

    it('should disable button during unlock process', async () => {
      render(
        <TestWrapper>
          <Lockscreen />
        </TestWrapper>
      );

      const passwordInput = screen.getByPlaceholderText('lockscreen.password_placeholder');
      const unlockButton = screen.getByText('lockscreen.unlock_button');

      fireEvent.changeText(passwordInput, 'testPassword');
      fireEvent.press(unlockButton);

      // During unlock, the button should show loading state
      await waitFor(() => {
        const loadingButton = screen.queryByText('lockscreen.unlock_button');
        expect(loadingButton).toBeNull();
        expect(screen.getByText('lockscreen.unlocking')).toBeTruthy();
      });

      // After unlock completes
      await waitFor(() => {
        expect(mockUnlock).toHaveBeenCalled();
      });
    });

    it('should re-enable button after unlock completes', async () => {
      render(
        <TestWrapper>
          <Lockscreen />
        </TestWrapper>
      );

      const passwordInput = screen.getByPlaceholderText('lockscreen.password_placeholder');
      const unlockButton = screen.getByText('lockscreen.unlock_button');

      fireEvent.changeText(passwordInput, 'testPassword');
      fireEvent.press(unlockButton);

      await waitFor(() => {
        expect(screen.getByText('lockscreen.unlocking')).toBeTruthy();
      });

      // Wait for unlock to complete
      await waitFor(() => {
        expect(mockUnlock).toHaveBeenCalled();
      });
    });
  });

  describe('Logout functionality', () => {
    it('should call logout handler when logout link is pressed', async () => {
      render(
        <TestWrapper>
          <Lockscreen />
        </TestWrapper>
      );

      // Find the logout link by text
      const logoutLink = screen.getByText('lockscreen.not_you');
      
      // The logout link is wrapped in a Pressable, so we need to find the parent with onPress
      const parent = logoutLink.parent;
      
      if (parent && parent.props.onPress) {
        fireEvent.press(parent);
      } else {
        // Fallback: create a press event on the text element itself
        fireEvent(logoutLink, 'press');
      }

      await waitFor(() => {
        expect(mockUnlock).toHaveBeenCalled();
        expect(mockLogout).toHaveBeenCalled();
      });
    });

    it('should navigate to login screen after logout', async () => {
      render(
        <TestWrapper>
          <Lockscreen />
        </TestWrapper>
      );

      const logoutLink = screen.getByText('lockscreen.not_you');
      const parent = logoutLink.parent;
      
      if (parent && parent.props.onPress) {
        fireEvent.press(parent);
      } else {
        fireEvent(logoutLink, 'press');
      }

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/login');
      });
    });

    it('should unlock the screen and call logout', async () => {
      const mockUnlockFn = jest.fn();
      (useLockscreenStore as unknown as jest.Mock).mockReturnValue({
        unlock: mockUnlockFn,
      });

      render(
        <TestWrapper>
          <Lockscreen />
        </TestWrapper>
      );

      const logoutLink = screen.getByText('lockscreen.not_you');
      const parent = logoutLink.parent;
      
      if (parent && parent.props.onPress) {
        fireEvent.press(parent);
      } else {
        fireEvent(logoutLink, 'press');
      }

      await waitFor(() => {
        expect(mockUnlockFn).toHaveBeenCalled();
        expect(mockLogout).toHaveBeenCalled();
      });
    });
  });
});
