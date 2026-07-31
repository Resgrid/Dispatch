import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { CloseCallBottomSheet } from '../close-call-bottom-sheet';
import { useAnalytics } from '@/hooks/use-analytics';
import { useCallDetailStore } from '@/stores/calls/detail-store';
import { useCallsStore } from '@/stores/calls/store';
import { useToastStore } from '@/stores/toast/store';

// Mock dependencies
jest.mock('expo-router');
jest.mock('react-i18next');
jest.mock('@/hooks/use-analytics');
jest.mock('@/stores/calls/detail-store');
jest.mock('@/stores/calls/store');
jest.mock('@/stores/toast/store');

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
});

// Mock nativewind
jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
  cssInterop: jest.fn(),
}));

// Mock cssInterop globally
(global as any).cssInterop = jest.fn();

// Mock UI components
jest.mock('@/components/ui/bottom-sheet', () => ({
  CustomBottomSheet: ({ children, isOpen }: any) => {
    const { View } = require('react-native');
    return isOpen ? <View testID="bottom-sheet">{children}</View> : null;
  },
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onPress, testID, disabled, ...props }: any) => {
    const { TouchableOpacity } = require('react-native');
    return <TouchableOpacity onPress={onPress} testID={testID} disabled={disabled} {...props}>{children}</TouchableOpacity>;
  },
  ButtonText: ({ children, ...props }: any) => {
    const { Text } = require('react-native');
    return <Text {...props}>{children}</Text>;
  },
}));

jest.mock('@/components/ui/text', () => ({
  Text: ({ children, ...props }: any) => {
    const { Text: RNText } = require('react-native');
    return <RNText {...props}>{children}</RNText>;
  },
}));

jest.mock('@/components/ui/vstack', () => ({
  VStack: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('@/components/ui/hstack', () => ({
  HStack: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('@/components/ui/form-control', () => ({
  FormControl: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
  FormControlLabel: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
  FormControlLabelText: ({ children, ...props }: any) => {
    const { Text } = require('react-native');
    return <Text {...props}>{children}</Text>;
  },
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, testID, selectedValue, onValueChange, ...props }: any) => {
    const { View, TouchableOpacity, Text } = require('react-native');
    return (
      <View testID={testID} {...props}>
        {children}
        <TouchableOpacity onPress={() => onValueChange && onValueChange('1')}>
          <Text>Select Option</Text>
        </TouchableOpacity>
      </View>
    );
  },
  SelectTrigger: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
  SelectInput: ({ placeholder, ...props }: any) => {
    const { Text } = require('react-native');
    return <Text {...props}>{placeholder}</Text>;
  },
  SelectIcon: () => null,
  SelectPortal: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
  SelectBackdrop: () => null,
  SelectContent: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
  SelectItem: ({ label, value, ...props }: any) => {
    const { View, Text } = require('react-native');
    return <View {...props}><Text>{label}</Text></View>;
  },
}));

jest.mock('@/components/ui/textarea', () => ({
  Textarea: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
  TextareaInput: ({ placeholder, value, onChangeText, testID, ...props }: any) => {
    const { TextInput } = require('react-native');
    return <TextInput placeholder={placeholder} value={value} onChangeText={onChangeText} testID={testID} {...props} />;
  },
}));

const mockRouter = {
  back: jest.fn(),
};

const mockUseTranslation = {
  t: (key: string) => key,
};

const mockCloseCall = jest.fn();
const mockFetchCalls = jest.fn();
const mockShowToast = jest.fn();
const mockTrackEvent = jest.fn();

const mockUseAnalytics = useAnalytics as jest.MockedFunction<typeof useAnalytics>;
const mockUseCallDetailStore = useCallDetailStore as jest.MockedFunction<typeof useCallDetailStore>;
const mockUseCallsStore = useCallsStore as jest.MockedFunction<typeof useCallsStore>;
const mockUseToastStore = useToastStore as jest.MockedFunction<typeof useToastStore>;

describe('CloseCallBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the console.error mock as well
    (console.error as jest.Mock).mockClear();

    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useTranslation as jest.Mock).mockReturnValue(mockUseTranslation);

    mockUseAnalytics.mockReturnValue({
      trackEvent: mockTrackEvent,
    });

    mockUseCallDetailStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector({ closeCall: mockCloseCall } as any);
      }
      return { closeCall: mockCloseCall } as any;
    });

    mockUseCallsStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector({ fetchCalls: mockFetchCalls } as any);
      }
      return { fetchCalls: mockFetchCalls } as any;
    });

    mockUseToastStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector({ showToast: mockShowToast } as any);
      }
      return { showToast: mockShowToast } as any;
    });
  });

  it('should render the close call bottom sheet', () => {
    render(<CloseCallBottomSheet isOpen={true} onClose={jest.fn()} callId="test-call-1" />);

    const closeCallTexts = screen.getAllByText('call_detail.close_call');
    expect(closeCallTexts.length).toBeGreaterThan(0); // Should have at least one element with this text
    expect(screen.getByText('call_detail.close_call_type')).toBeTruthy();
    expect(screen.getByText('call_detail.close_call_note')).toBeTruthy();
    expect(screen.getByText('common.cancel')).toBeTruthy();
  });

  it('should show error toast when no close type is selected', async () => {
    render(<CloseCallBottomSheet isOpen={true} onClose={jest.fn()} callId="test-call-1" />);

    // Try to submit without selecting a type
    const submitButton = screen.getAllByText('call_detail.close_call')[1]; // Second one is the submit button
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('error', 'call_detail.close_call_type_required');
    });

    expect(mockCloseCall).not.toHaveBeenCalled();
  });

  it('should successfully close call with valid data', async () => {
    mockCloseCall.mockResolvedValue(undefined);
    mockFetchCalls.mockResolvedValue(undefined);

    const mockOnClose = jest.fn();
    render(<CloseCallBottomSheet isOpen={true} onClose={mockOnClose} callId="test-call-1" />);

    // Select close type
    const typeSelect = screen.getByTestId('close-call-type-select');
    fireEvent(typeSelect, 'onValueChange', '1');

    // Add note
    const noteInput = screen.getByPlaceholderText('call_detail.close_call_note_placeholder');
    fireEvent.changeText(noteInput, 'Call resolved successfully');

    // Submit
    const submitButton = screen.getAllByText('call_detail.close_call')[1];
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(mockCloseCall).toHaveBeenCalledWith({
        callId: 'test-call-1',
        type: 1,
        note: 'Call resolved successfully',
      });
      expect(mockShowToast).toHaveBeenCalledWith('success', 'call_detail.close_call_success');
      expect(mockFetchCalls).toHaveBeenCalled();
      expect(mockRouter.back).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should handle close call with empty note', async () => {
    mockCloseCall.mockResolvedValue(undefined);
    mockFetchCalls.mockResolvedValue(undefined);

    const mockOnClose = jest.fn();
    render(<CloseCallBottomSheet isOpen={true} onClose={mockOnClose} callId="test-call-1" />);

    // Select close type but leave note empty
    const typeSelect = screen.getByTestId('close-call-type-select');
    fireEvent(typeSelect, 'onValueChange', '2');

    // Submit
    const submitButton = screen.getAllByText('call_detail.close_call')[1];
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(mockCloseCall).toHaveBeenCalledWith({
        callId: 'test-call-1',
        type: 2,
        note: '',
      });
      expect(mockShowToast).toHaveBeenCalledWith('success', 'call_detail.close_call_success');
      expect(mockFetchCalls).toHaveBeenCalled();
      expect(mockRouter.back).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should handle close call API error', async () => {
    const errorMessage = 'Failed to close call';
    mockCloseCall.mockRejectedValue(new Error(errorMessage));

    render(<CloseCallBottomSheet isOpen={true} onClose={jest.fn()} callId="test-call-1" />);

    // Select close type
    const typeSelect = screen.getByTestId('close-call-type-select');
    fireEvent(typeSelect, 'onValueChange', '1');

    // Submit
    const submitButton = screen.getAllByText('call_detail.close_call')[1];
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('error', 'call_detail.close_call_error');
    });

    expect(mockFetchCalls).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it.each([
    { type: '1', expected: 1 },
    { type: '2', expected: 2 },
    { type: '3', expected: 3 },
    { type: '4', expected: 4 },
    { type: '5', expected: 5 },
    { type: '6', expected: 6 },
    { type: '7', expected: 7 },
  ])('should handle close call type $type', async ({ type, expected }) => {
    mockCloseCall.mockResolvedValue(undefined);
    mockFetchCalls.mockResolvedValue(undefined);

    render(<CloseCallBottomSheet isOpen={true} onClose={jest.fn()} callId="test-call-1" />);

    // Select close type
    const typeSelect = screen.getByTestId('close-call-type-select');
    fireEvent(typeSelect, 'onValueChange', type);

    // Submit
    const submitButton = screen.getAllByText('call_detail.close_call')[1];
    fireEvent.press(submitButton);

    // Wait for the entire flow to complete
    await waitFor(() => {
      expect(mockCloseCall).toHaveBeenCalledWith({
        callId: 'test-call-1',
        type: expected,
        note: '',
      });
      expect(mockFetchCalls).toHaveBeenCalled();
    });
  });

  it('should disable buttons when submitting', async () => {
    let resolveCloseCall: () => void;
    const closeCallPromise = new Promise<void>((resolve) => {
      resolveCloseCall = resolve;
    });

    mockCloseCall.mockImplementation(() => closeCallPromise);
    mockFetchCalls.mockResolvedValue(undefined);

    render(<CloseCallBottomSheet isOpen={true} onClose={jest.fn()} callId="test-call-1" />);

    // Select close type
    const typeSelect = screen.getByTestId('close-call-type-select');
    fireEvent(typeSelect, 'onValueChange', '1');

    // Submit
    const submitButton = screen.getAllByText('call_detail.close_call')[1];
    const cancelButton = screen.getByText('common.cancel');

    fireEvent.press(submitButton);

    // Buttons should be disabled while submitting
    expect(submitButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();

    // Resolve the promise to complete the test
    resolveCloseCall!();
    await waitFor(() => {
      expect(mockCloseCall).toHaveBeenCalled();
    });
  });

  it('should cancel and reset form', () => {
    const mockOnClose = jest.fn();
    render(<CloseCallBottomSheet isOpen={true} onClose={mockOnClose} callId="test-call-1" />);

    // Select close type and add note
    const typeSelect = screen.getByTestId('close-call-type-select');
    fireEvent(typeSelect, 'onValueChange', '1');

    const noteInput = screen.getByPlaceholderText('call_detail.close_call_note_placeholder');
    fireEvent.changeText(noteInput, 'Some note');

    // Cancel
    const cancelButton = screen.getByText('common.cancel');
    fireEvent.press(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
    // Form should be reset (verified by testing the component doesn't retain values on next render)
  });

  it('should handle fetchCalls error gracefully', async () => {
    mockCloseCall.mockResolvedValue(undefined);
    mockFetchCalls.mockRejectedValue(new Error('Failed to fetch calls'));

    const mockOnClose = jest.fn();
    render(<CloseCallBottomSheet isOpen={true} onClose={mockOnClose} callId="test-call-1" />);

    // Select close type
    const typeSelect = screen.getByTestId('close-call-type-select');
    fireEvent(typeSelect, 'onValueChange', '1');

    // Submit
    const submitButton = screen.getAllByText('call_detail.close_call')[1];
    fireEvent.press(submitButton);

    // Wait for the entire flow to complete
    await waitFor(() => {
      expect(mockCloseCall).toHaveBeenCalled();
      expect(mockFetchCalls).toHaveBeenCalled();
    });

    // Wait for all toast messages and error handling to complete
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('success', 'call_detail.close_call_success');
      expect(mockOnClose).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Error closing call:', expect.any(Error));
      expect(mockShowToast).toHaveBeenCalledWith('error', 'call_detail.close_call_error');
    });

    // Since closeCall succeeded, the modal should be closed but router.back() should not be called due to fetchCalls failure
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('should not render when isOpen is false', () => {
    render(<CloseCallBottomSheet isOpen={false} onClose={jest.fn()} callId="test-call-1" />);

    // The component should not render its content when closed
    expect(screen.queryByText('call_detail.close_call')).toBeFalsy();
  });

  it('should track analytics event when bottom sheet is opened', () => {
    render(<CloseCallBottomSheet isOpen={true} onClose={jest.fn()} callId="test-call-123" isLoading={false} />);

    expect(mockTrackEvent).toHaveBeenCalledWith('close_call_bottom_sheet_opened', {
      callId: 'test-call-123',
      isLoading: false,
    });
  });

  it('should not track analytics event when bottom sheet is closed', () => {
    render(<CloseCallBottomSheet isOpen={false} onClose={jest.fn()} callId="test-call-123" isLoading={false} />);

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('should track analytics event with loading state', () => {
    render(<CloseCallBottomSheet isOpen={true} onClose={jest.fn()} callId="test-call-456" isLoading={true} />);

    expect(mockTrackEvent).toHaveBeenCalledWith('close_call_bottom_sheet_opened', {
      callId: 'test-call-456',
      isLoading: true,
    });
  });

  it('should track analytics event only once when isOpen changes from false to true', () => {
    const { rerender } = render(<CloseCallBottomSheet isOpen={false} onClose={jest.fn()} callId="test-call-789" isLoading={false} />);

    // Should not track when initially closed
    expect(mockTrackEvent).not.toHaveBeenCalled();

    // Should track when opened
    rerender(<CloseCallBottomSheet isOpen={true} onClose={jest.fn()} callId="test-call-789" isLoading={false} />);

    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith('close_call_bottom_sheet_opened', {
      callId: 'test-call-789',
      isLoading: false,
    });

    // Should not track again when staying open
    rerender(<CloseCallBottomSheet isOpen={true} onClose={jest.fn()} callId="test-call-789" isLoading={false} />);

    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
  });
}); 