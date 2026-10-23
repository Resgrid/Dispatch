import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { useCallDetailMenu } from '../call-detail-menu';

// Mock the i18next hook
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the UI components
jest.mock('@/components/ui/actionsheet', () => ({
  Actionsheet: ({ children, isOpen, testID }: { children: React.ReactNode; isOpen: boolean; testID?: string }) => {
    const { View } = require('react-native');
    return isOpen ? <View testID={testID}>{children}</View> : null;
  },
  ActionsheetBackdrop: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View testID="actionsheet-backdrop">{children}</View>;
  },
  ActionsheetContent: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View testID="actionsheet-content">{children}</View>;
  },
  ActionsheetDragIndicator: () => {
    const { View } = require('react-native');
    return <View testID="actionsheet-drag-indicator" />;
  },
  ActionsheetDragIndicatorWrapper: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View testID="actionsheet-drag-indicator-wrapper">{children}</View>;
  },
  ActionsheetItem: ({ children, onPress, testID }: { children: React.ReactNode; onPress: () => void; testID?: string }) => {
    const { TouchableOpacity } = require('react-native');
    return <TouchableOpacity testID={testID} onPress={onPress}>{children}</TouchableOpacity>;
  },
  ActionsheetItemText: ({ children }: { children: React.ReactNode }) => {
    const { Text } = require('react-native');
    return <Text>{children}</Text>;
  },
}));

jest.mock('@/components/ui/hstack', () => ({
  HStack: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('lucide-react-native', () => ({
  EditIcon: () => null,
  XIcon: () => null,
  MoreVerticalIcon: () => {
    const { View } = require('react-native');
    return <View />;
  },
}));

jest.mock('@/components/ui/', () => ({
  Pressable: ({ children, onPress, onPressIn, testID }: { children: React.ReactNode; onPress?: () => void; onPressIn?: () => void; testID?: string }) => {
    const { TouchableOpacity } = require('react-native');
    return <TouchableOpacity testID={testID} onPress={onPress || onPressIn}>{children}</TouchableOpacity>;
  },
}));

describe('Call Detail Menu Integration Test', () => {
  const mockOnEditCall = jest.fn();
  const mockOnCloseCall = jest.fn();

  const TestComponent = () => {
    const { HeaderRightMenu, CallDetailActionSheet } = useCallDetailMenu({
      onEditCall: mockOnEditCall,
      onCloseCall: mockOnCloseCall,
      canUserCreateCalls: true, // Explicitly set to true for integration tests
    });

    return (
      <>
        <HeaderRightMenu />
        <CallDetailActionSheet />
      </>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the header menu button and actionsheet', () => {
    render(<TestComponent />);

    // Check if the kebab menu button is rendered
    expect(screen.getByTestId('kebab-menu-button')).toBeTruthy();
  });

  it('should open actionsheet when menu button is pressed', async () => {
    render(<TestComponent />);

    const menuButton = screen.getByTestId('kebab-menu-button');
    fireEvent.press(menuButton);

    // Wait for the actionsheet to appear
    await waitFor(() => {
      expect(screen.getByTestId('call-detail-actionsheet')).toBeTruthy();
    });
  });

  it('should call onEditCall when edit button is pressed', async () => {
    render(<TestComponent />);

    // Open the menu
    const menuButton = screen.getByTestId('kebab-menu-button');
    fireEvent.press(menuButton);

    // Wait for the actionsheet and press edit button
    await waitFor(() => {
      const editButton = screen.getByTestId('edit-call-button');
      fireEvent.press(editButton);
    });

    expect(mockOnEditCall).toHaveBeenCalledTimes(1);
  });

  it('should call onCloseCall when close button is pressed', async () => {
    render(<TestComponent />);

    // Open the menu
    const menuButton = screen.getByTestId('kebab-menu-button');
    fireEvent.press(menuButton);

    // Wait for the actionsheet and press close button
    await waitFor(() => {
      const closeButton = screen.getByTestId('close-call-button');
      fireEvent.press(closeButton);
    });

    expect(mockOnCloseCall).toHaveBeenCalledTimes(1);
  });

  it('offers no close for a call that is already closed', async () => {
    // An archived call: the detail screen passes no onCloseCall.
    const ClosedCallMenu = () => {
      const { HeaderRightMenu, CallDetailActionSheet } = useCallDetailMenu({ onEditCall: mockOnEditCall, canUserCreateCalls: true });
      return (
        <>
          <HeaderRightMenu />
          <CallDetailActionSheet />
        </>
      );
    };
    render(<ClosedCallMenu />);

    fireEvent.press(screen.getByTestId('kebab-menu-button'));

    await waitFor(() => {
      expect(screen.getByTestId('edit-call-button')).toBeTruthy();
    });
    expect(screen.queryByTestId('close-call-button')).toBeNull();
  });
});
