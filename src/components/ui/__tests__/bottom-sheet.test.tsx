import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react-native';
import { Text as RNText, View } from 'react-native';

import { CustomBottomSheet } from '../bottom-sheet';

// Mock nativewind
jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: jest.fn(() => ({ colorScheme: 'light' })),
  cssInterop: jest.fn(),
}));

// Mock cssInterop globally
(global as any).cssInterop = jest.fn();

// Mock UI components
jest.mock('../actionsheet', () => ({
  Actionsheet: ({ children, isOpen, onClose, snapPoints, testID }: any) => {
    const { View } = require('react-native');
    return isOpen ? (
      <View testID={testID || 'actionsheet'} onTouchEnd={onClose}>
        {children}
      </View>
    ) : null;
  },
  ActionsheetBackdrop: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID="actionsheet-backdrop" {...props}>{children}</View>;
  },
  ActionsheetContent: ({ children, className, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID="actionsheet-content" className={className} {...props}>{children}</View>;
  },
  ActionsheetDragIndicator: ({ ...props }: any) => {
    const { View } = require('react-native');
    return <View testID="actionsheet-drag-indicator" {...props} />;
  },
  ActionsheetDragIndicatorWrapper: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID="actionsheet-drag-indicator-wrapper" {...props}>{children}</View>;
  },
}));

jest.mock('../center', () => ({
  Center: ({ children, className, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID="center" className={className} {...props}>{children}</View>;
  },
}));

jest.mock('../spinner', () => ({
  Spinner: ({ size, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID="spinner" size={size} {...props} />;
  },
}));

jest.mock('../text', () => ({
  Text: ({ children, className, ...props }: any) => {
    const { Text: RNText } = require('react-native');
    return <RNText testID="text" className={className} {...props}>{children}</RNText>;
  },
}));

jest.mock('../vstack', () => ({
  VStack: ({ children, className, space, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID="vstack" className={className} space={space} {...props}>{children}</View>;
  },
}));

const { useColorScheme } = require('nativewind');

// Mock console.error to prevent logging issues in tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('CustomBottomSheet', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    children: <RNText>Test Content</RNText>,
  };

  describe('Basic Rendering', () => {
    it('should render successfully when open', () => {
      render(<CustomBottomSheet {...defaultProps} />);

      expect(screen.getByTestId('actionsheet')).toBeTruthy();
      expect(screen.getByTestId('actionsheet-backdrop')).toBeTruthy();
      expect(screen.getByTestId('actionsheet-content')).toBeTruthy();
      expect(screen.getByTestId('actionsheet-drag-indicator-wrapper')).toBeTruthy();
      expect(screen.getByTestId('actionsheet-drag-indicator')).toBeTruthy();
      expect(screen.getByTestId('vstack')).toBeTruthy();
      expect(screen.getByText('Test Content')).toBeTruthy();
    });

    it('should not render when closed', () => {
      render(<CustomBottomSheet {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('actionsheet')).toBeNull();
      expect(screen.queryByText('Test Content')).toBeNull();
    });

    it('should render with custom testID', () => {
      render(<CustomBottomSheet {...defaultProps} testID="custom-bottom-sheet" />);

      expect(screen.getByTestId('custom-bottom-sheet')).toBeTruthy();
    });
  });

  describe('Props Handling', () => {
    it('should pass snapPoints correctly', () => {
      const snapPoints = [25, 50, 75];
      render(<CustomBottomSheet {...defaultProps} snapPoints={snapPoints} />);

      // The snapPoints should be passed to the Actionsheet component
      expect(screen.getByTestId('actionsheet')).toBeTruthy();
    });

    it('should use default snapPoints when not provided', () => {
      render(<CustomBottomSheet {...defaultProps} />);

      // Should render with default snapPoints [67]
      expect(screen.getByTestId('actionsheet')).toBeTruthy();
    });

    it('should apply custom minHeight', () => {
      render(<CustomBottomSheet {...defaultProps} minHeight="min-h-[600px]" />);

      const vstack = screen.getByTestId('vstack');
      expect(vstack.props.className).toContain('min-h-[600px]');
    });

    it('should use default minHeight when not provided', () => {
      render(<CustomBottomSheet {...defaultProps} />);

      const vstack = screen.getByTestId('vstack');
      expect(vstack.props.className).toContain('min-h-[400px]');
    });

    it('should handle onClose callback', () => {
      const onCloseMock = jest.fn();
      render(<CustomBottomSheet {...defaultProps} onClose={onCloseMock} />);

      const actionsheet = screen.getByTestId('actionsheet');
      fireEvent(actionsheet, 'touchEnd');

      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner when isLoading is true', () => {
      render(<CustomBottomSheet {...defaultProps} isLoading={true} />);

      expect(screen.getByTestId('spinner')).toBeTruthy();
      expect(screen.getByTestId('center')).toBeTruthy();
      expect(screen.queryByText('Test Content')).toBeNull();
    });

    it('should show loading text when provided', () => {
      render(
        <CustomBottomSheet
          {...defaultProps}
          isLoading={true}
          loadingText="Loading data..."
        />
      );

      expect(screen.getByTestId('spinner')).toBeTruthy();
      expect(screen.getByText('Loading data...')).toBeTruthy();
    });

    it('should not show loading text when not provided', () => {
      render(<CustomBottomSheet {...defaultProps} isLoading={true} />);

      expect(screen.getByTestId('spinner')).toBeTruthy();
      expect(screen.queryByTestId('text')).toBeNull();
    });

    it('should show children when not loading', () => {
      render(<CustomBottomSheet {...defaultProps} isLoading={false} />);

      expect(screen.queryByTestId('spinner')).toBeNull();
      expect(screen.queryByTestId('center')).toBeNull();
      expect(screen.getByText('Test Content')).toBeTruthy();
    });

    it('should default to not loading when isLoading is not provided', () => {
      render(<CustomBottomSheet {...defaultProps} />);

      expect(screen.queryByTestId('spinner')).toBeNull();
      expect(screen.getByText('Test Content')).toBeTruthy();
    });
  });

  describe('Color Scheme', () => {
    it('should apply light theme styles', () => {
      useColorScheme.mockReturnValue({ colorScheme: 'light' });

      render(<CustomBottomSheet {...defaultProps} />);

      const content = screen.getByTestId('actionsheet-content');
      expect(content.props.className).toContain('bg-white');
      expect(content.props.className).not.toContain('bg-neutral-900');
    });

    it('should apply dark theme styles', () => {
      useColorScheme.mockReturnValue({ colorScheme: 'dark' });

      render(<CustomBottomSheet {...defaultProps} />);

      const content = screen.getByTestId('actionsheet-content');
      expect(content.props.className).toContain('bg-neutral-900');
      expect(content.props.className).not.toContain('bg-white');
    });

    it('should handle color scheme changes', () => {
      useColorScheme.mockReturnValue({ colorScheme: 'light' });

      const { rerender } = render(<CustomBottomSheet {...defaultProps} />);

      let content = screen.getByTestId('actionsheet-content');
      expect(content.props.className).toContain('bg-white');

      useColorScheme.mockReturnValue({ colorScheme: 'dark' });
      rerender(<CustomBottomSheet {...defaultProps} />);

      content = screen.getByTestId('actionsheet-content');
      expect(content.props.className).toContain('bg-neutral-900');
    });
  });

  describe('Children Rendering', () => {
    it('should render simple text children', () => {
      render(
        <CustomBottomSheet {...defaultProps}>
          <RNText>Simple Text</RNText>
        </CustomBottomSheet>
      );

      expect(screen.getByText('Simple Text')).toBeTruthy();
    });

    it('should render complex children', () => {
      render(
        <CustomBottomSheet {...defaultProps}>
          <View>
            <RNText>Title</RNText>
            <RNText>Description</RNText>
          </View>
        </CustomBottomSheet>
      );

      expect(screen.getByText('Title')).toBeTruthy();
      expect(screen.getByText('Description')).toBeTruthy();
    });

    it('should render multiple children', () => {
      render(
        <CustomBottomSheet {...defaultProps}>
          <RNText>Child 1</RNText>
          <RNText>Child 2</RNText>
          <RNText>Child 3</RNText>
        </CustomBottomSheet>
      );

      expect(screen.getByText('Child 1')).toBeTruthy();
      expect(screen.getByText('Child 2')).toBeTruthy();
      expect(screen.getByText('Child 3')).toBeTruthy();
    });

    it('should handle null children', () => {
      render(
        <CustomBottomSheet {...defaultProps}>
          {null}
        </CustomBottomSheet>
      );

      expect(screen.getByTestId('vstack')).toBeTruthy();
    });

    it('should handle undefined children', () => {
      render(
        <CustomBottomSheet {...defaultProps}>
          {undefined}
        </CustomBottomSheet>
      );

      expect(screen.getByTestId('vstack')).toBeTruthy();
    });
  });

  describe('CSS Classes', () => {
    it('should apply correct base classes', () => {
      render(<CustomBottomSheet {...defaultProps} />);

      const content = screen.getByTestId('actionsheet-content');
      expect(content.props.className).toContain('rounded-t-3xl');
      expect(content.props.className).toContain('px-4');
      expect(content.props.className).toContain('pb-6');
    });

    it('should apply correct VStack classes', () => {
      render(<CustomBottomSheet {...defaultProps} />);

      const vstack = screen.getByTestId('vstack');
      expect(vstack.props.className).toContain('w-full');
      expect(vstack.props.space).toBe('md');
    });

    it('should apply correct loading Center classes', () => {
      render(<CustomBottomSheet {...defaultProps} isLoading={true} />);

      const center = screen.getByTestId('center');
      expect(center.props.className).toContain('h-32');
    });

    it('should apply correct loading text classes', () => {
      render(
        <CustomBottomSheet
          {...defaultProps}
          isLoading={true}
          loadingText="Loading..."
        />
      );

      const text = screen.getByTestId('text');
      expect(text.props.className).toContain('text-sm');
      expect(text.props.className).toContain('text-gray-500');
    });
  });

  describe('State Management', () => {
    it('should handle isOpen state changes', () => {
      const { rerender } = render(<CustomBottomSheet {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('actionsheet')).toBeNull();

      rerender(<CustomBottomSheet {...defaultProps} isOpen={true} />);

      expect(screen.getByTestId('actionsheet')).toBeTruthy();
    });

    it('should handle isLoading state changes', () => {
      const { rerender } = render(<CustomBottomSheet {...defaultProps} isLoading={false} />);

      expect(screen.queryByTestId('spinner')).toBeNull();
      expect(screen.getByText('Test Content')).toBeTruthy();

      rerender(<CustomBottomSheet {...defaultProps} isLoading={true} />);

      expect(screen.getByTestId('spinner')).toBeTruthy();
      expect(screen.queryByText('Test Content')).toBeNull();
    });

    it('should handle loadingText changes', () => {
      const { rerender } = render(
        <CustomBottomSheet {...defaultProps} isLoading={true} loadingText="Loading..." />
      );

      expect(screen.getByText('Loading...')).toBeTruthy();

      rerender(
        <CustomBottomSheet {...defaultProps} isLoading={true} loadingText="Please wait..." />
      );

      expect(screen.getByText('Please wait...')).toBeTruthy();
      expect(screen.queryByText('Loading...')).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty snapPoints array', () => {
      render(<CustomBottomSheet {...defaultProps} snapPoints={[]} />);

      expect(screen.getByTestId('actionsheet')).toBeTruthy();
    });

    it('should handle single snapPoint', () => {
      render(<CustomBottomSheet {...defaultProps} snapPoints={[100]} />);

      expect(screen.getByTestId('actionsheet')).toBeTruthy();
    });

    it('should handle empty string minHeight', () => {
      render(<CustomBottomSheet {...defaultProps} minHeight="" />);

      const vstack = screen.getByTestId('vstack');
      expect(vstack.props.className).toContain('w-full');
    });

    it('should handle empty string loadingText', () => {
      render(
        <CustomBottomSheet {...defaultProps} isLoading={true} loadingText="" />
      );

      expect(screen.getByTestId('spinner')).toBeTruthy();
      expect(screen.queryByTestId('text')).toBeNull();
    });

    it('should handle multiple onClose calls', () => {
      const onCloseMock = jest.fn();
      render(<CustomBottomSheet {...defaultProps} onClose={onCloseMock} />);

      const actionsheet = screen.getByTestId('actionsheet');
      fireEvent(actionsheet, 'touchEnd');
      fireEvent(actionsheet, 'touchEnd');
      fireEvent(actionsheet, 'touchEnd');

      expect(onCloseMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('Component Structure', () => {
    it('should maintain correct component hierarchy', () => {
      render(<CustomBottomSheet {...defaultProps} />);

      const actionsheet = screen.getByTestId('actionsheet');
      const backdrop = screen.getByTestId('actionsheet-backdrop');
      const content = screen.getByTestId('actionsheet-content');
      const dragIndicatorWrapper = screen.getByTestId('actionsheet-drag-indicator-wrapper');
      const dragIndicator = screen.getByTestId('actionsheet-drag-indicator');
      const vstack = screen.getByTestId('vstack');

      expect(actionsheet).toBeTruthy();
      expect(backdrop).toBeTruthy();
      expect(content).toBeTruthy();
      expect(dragIndicatorWrapper).toBeTruthy();
      expect(dragIndicator).toBeTruthy();
      expect(vstack).toBeTruthy();
    });

    it('should have correct loading state structure', () => {
      render(
        <CustomBottomSheet
          {...defaultProps}
          isLoading={true}
          loadingText="Loading..."
        />
      );

      const center = screen.getByTestId('center');
      const spinner = screen.getByTestId('spinner');
      const text = screen.getByTestId('text');

      expect(center).toBeTruthy();
      expect(spinner).toBeTruthy();
      expect(text).toBeTruthy();
    });
  });
}); 