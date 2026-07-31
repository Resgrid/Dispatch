import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useTranslation } from 'react-i18next';
import CallNotesModal from '../call-notes-modal';
import { useAuthStore } from '@/lib/auth';
import { useCallDetailStore } from '@/stores/calls/detail-store';

// Mock dependencies
jest.mock('react-i18next');
jest.mock('@/lib/auth');
jest.mock('@/stores/calls/detail-store');

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

// Mock nativewind
jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
  cssInterop: jest.fn(),
}));

// Mock lucide-react-native icons
jest.mock('lucide-react-native', () => ({
  SearchIcon: 'SearchIcon',
  X: 'X',
}));

// Mock Loading component
jest.mock('../../common/loading', () => ({
  Loading: () => {
    const { View, Text } = require('react-native');
    return <View testID="loading"><Text>Loading...</Text></View>;
  },
}));

// Mock ZeroState component  
jest.mock('../../common/zero-state', () => ({
  __esModule: true,
  default: ({ heading }: { heading: string }) => {
    const { View, Text } = require('react-native');
    return <View><Text>{heading}</Text></View>;
  },
}));

// Mock FocusAwareStatusBar to avoid navigation issues
jest.mock('../../ui/focus-aware-status-bar', () => ({
  FocusAwareStatusBar: () => null,
}));

// Mock react-native-keyboard-controller
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAwareScrollView: ({ children }: any) => {
    const { View } = require('react-native');
    return <View testID="keyboard-aware-scroll-view">{children}</View>;
  },
}));

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => ({
  ScrollView: ({ children, testID, ...props }: any) => {
    const { ScrollView } = require('react-native');
    return <ScrollView testID={testID} {...props}>{children}</ScrollView>;
  },
  PanGestureHandler: ({ children }: any) => children,
  State: {},
}));

// Mock @gorhom/bottom-sheet
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: React.forwardRef(({ children, onChange, index }: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        expand: jest.fn(),
        close: jest.fn(),
      }));

      React.useEffect(() => {
        if (onChange) onChange(index);
      }, [index, onChange]);

      return <View testID="bottom-sheet">{children}</View>;
    }),
    BottomSheetView: ({ children }: any) => <View testID="bottom-sheet-view">{children}</View>,
    BottomSheetBackdrop: ({ children }: any) => <View testID="backdrop">{children}</View>,
  };
});

// Mock lucide-react-native icons
jest.mock('lucide-react-native', () => ({
  SearchIcon: 'SearchIcon',
  X: 'X',
}));

const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
const mockUseCallDetailStore = useCallDetailStore as jest.MockedFunction<typeof useCallDetailStore>;

describe('CallNotesModal', () => {
  const mockProps = {
    isOpen: true,
    onClose: jest.fn(),
    callId: 'test-call-id',
  };

  const mockCallDetailStore = {
    callNotes: [
      {
        CallNoteId: '1',
        Note: 'Test note 1',
        FullName: 'John Doe',
        TimestampFormatted: '2025-01-15 10:30 AM',
      },
      {
        CallNoteId: '2',
        Note: 'Test note 2',
        FullName: 'Jane Smith',
        TimestampFormatted: '2025-01-15 11:00 AM',
      },
    ],
    addNote: jest.fn(),
    searchNotes: jest.fn(),
    isNotesLoading: false,
    fetchCallNotes: jest.fn(),
  };

  const mockAuthStore = {
    profile: { sub: 'user-123' },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseTranslation.mockReturnValue({
      t: (key: string) => {
        const translations: { [key: string]: string } = {
          'callNotes.title': 'Call Notes',
          'callNotes.searchPlaceholder': 'Search notes...',
          'callNotes.addNotePlaceholder': 'Add a note...',
          'callNotes.addNote': 'Add Note',
        };
        return translations[key] || key;
      },
    } as any);

    mockUseCallDetailStore.mockReturnValue({
      ...mockCallDetailStore,
      searchNotes: jest.fn(() => mockCallDetailStore.callNotes),
    });

    mockUseAuthStore.mockReturnValue(mockAuthStore);
  });

  it('renders correctly when open', () => {
    const { getByText, getByTestId } = render(<CallNotesModal {...mockProps} />);

    expect(getByText('Call Notes')).toBeTruthy();
    expect(getByTestId('close-button')).toBeTruthy();
    expect(getByText('Test note 1')).toBeTruthy();
    expect(getByText('Test note 2')).toBeTruthy();
  });

  it('fetches call notes when opened', () => {
    render(<CallNotesModal {...mockProps} />);

    expect(mockCallDetailStore.fetchCallNotes).toHaveBeenCalledWith('test-call-id');
  });

  it('calls onClose when close button is pressed', () => {
    const { getByTestId } = render(<CallNotesModal {...mockProps} />);

    fireEvent.press(getByTestId('close-button'));

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('renders correctly when closed', () => {
    const { queryByText } = render(<CallNotesModal {...mockProps} isOpen={false} />);

    // Bottom sheet should still render but with index -1 (closed)
    expect(queryByText('Call Notes')).toBeTruthy();
  });

  it('handles search input correctly', () => {
    const mockSearchNotes = jest.fn(() => [mockCallDetailStore.callNotes[0]]);
    mockUseCallDetailStore.mockReturnValue({
      ...mockCallDetailStore,
      searchNotes: mockSearchNotes,
    });

    const { getByPlaceholderText, getByText, queryByText } = render(<CallNotesModal {...mockProps} />);

    const searchInput = getByPlaceholderText('Search notes...');
    fireEvent.changeText(searchInput, 'Test note 1');

    // Should show filtered results
    expect(getByText('Test note 1')).toBeTruthy();
    expect(queryByText('Test note 2')).toBeFalsy();
  });

  it('shows loading state correctly', () => {
    mockUseCallDetailStore.mockReturnValue({
      ...mockCallDetailStore,
      isNotesLoading: true,
    });

    const { getByTestId } = render(<CallNotesModal {...mockProps} />);

    expect(getByTestId('loading')).toBeTruthy();
  });

  it('shows zero state when no notes found', () => {
    mockUseCallDetailStore.mockReturnValue({
      ...mockCallDetailStore,
      callNotes: [],
      searchNotes: jest.fn(() => []),
    });

    const { getByText } = render(<CallNotesModal {...mockProps} />);

    expect(getByText('No notes found')).toBeTruthy();
  });

  it('handles adding a new note', async () => {
    const mockAddNote = jest.fn();
    mockUseCallDetailStore.mockReturnValue({
      ...mockCallDetailStore,
      addNote: mockAddNote,
      searchNotes: jest.fn(() => mockCallDetailStore.callNotes),
    });

    const { getByPlaceholderText, getByText } = render(<CallNotesModal {...mockProps} />);

    const noteInput = getByPlaceholderText('Add a note...');
    const addButton = getByText('Add Note');

    fireEvent.changeText(noteInput, 'New test note');
    fireEvent.press(addButton);

    await waitFor(() => {
      expect(mockAddNote).toHaveBeenCalledWith('test-call-id', 'New test note', 'user-123', null, null);
    });
  });

  it('disables add button when note input is empty', () => {
    const mockAddNote = jest.fn();
    mockUseCallDetailStore.mockReturnValue({
      ...mockCallDetailStore,
      addNote: mockAddNote,
      searchNotes: jest.fn(() => mockCallDetailStore.callNotes),
    });

    const { getByText } = render(<CallNotesModal {...mockProps} />);

    const addButton = getByText('Add Note');

    // Try to press the button when no note is entered - it should not call addNote
    fireEvent.press(addButton);

    expect(mockAddNote).not.toHaveBeenCalled();
  });

  it('disables add button when loading', () => {
    const mockAddNote = jest.fn();
    mockUseCallDetailStore.mockReturnValue({
      ...mockCallDetailStore,
      addNote: mockAddNote,
      isNotesLoading: true,
      searchNotes: jest.fn(() => mockCallDetailStore.callNotes),
    });

    const { getByText, getByPlaceholderText } = render(<CallNotesModal {...mockProps} />);

    const noteInput = getByPlaceholderText('Add a note...');
    const addButton = getByText('Add Note');

    fireEvent.changeText(noteInput, 'New test note');
    fireEvent.press(addButton);

    // Button should not call addNote when loading
    expect(mockAddNote).not.toHaveBeenCalled();
  });

  it('displays note author and timestamp correctly', () => {
    const { getByText } = render(<CallNotesModal {...mockProps} />);

    expect(getByText('John Doe')).toBeTruthy();
    expect(getByText('2025-01-15 10:30 AM')).toBeTruthy();
    expect(getByText('Jane Smith')).toBeTruthy();
    expect(getByText('2025-01-15 11:00 AM')).toBeTruthy();
  });

  it('clears note input after successful submission', async () => {
    const mockAddNote = jest.fn().mockResolvedValue(undefined);
    mockUseCallDetailStore.mockReturnValue({
      ...mockCallDetailStore,
      addNote: mockAddNote,
      searchNotes: jest.fn(() => mockCallDetailStore.callNotes),
    });

    const { getByPlaceholderText, getByText } = render(<CallNotesModal {...mockProps} />);

    const noteInput = getByPlaceholderText('Add a note...');
    const addButton = getByText('Add Note');

    fireEvent.changeText(noteInput, 'New test note');
    fireEvent.press(addButton);

    await waitFor(() => {
      expect(noteInput.props.value).toBe('');
    });
  });

  it('does not add empty note when only whitespace is entered', async () => {
    const mockAddNote = jest.fn();
    mockUseCallDetailStore.mockReturnValue({
      ...mockCallDetailStore,
      addNote: mockAddNote,
      searchNotes: jest.fn(() => mockCallDetailStore.callNotes),
    });

    const { getByPlaceholderText, getByText } = render(<CallNotesModal {...mockProps} />);

    const noteInput = getByPlaceholderText('Add a note...');
    const addButton = getByText('Add Note');

    fireEvent.changeText(noteInput, '   ');
    fireEvent.press(addButton);

    expect(mockAddNote).not.toHaveBeenCalled();
  });

  it('handles missing user profile gracefully', () => {
    mockUseAuthStore.mockReturnValue({
      profile: null,
    });

    const { getByText } = render(<CallNotesModal {...mockProps} />);

    expect(getByText('Call Notes')).toBeTruthy();
  });
});
