import React from 'react';

import { render, waitFor, cleanup, act } from '@testing-library/react-native';

import { AddNoteBottomSheet } from '../add-note-bottom-sheet';

// Prevent console noise during tests
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

// Mock UI components with simplified implementations
jest.mock('@/components/ui/actionsheet', () => {
  const { View } = require('react-native');
  return {
    Actionsheet: ({ children, isOpen }: any) => (isOpen ? <View testID="actionsheet">{children}</View> : null),
    ActionsheetBackdrop: () => null,
    ActionsheetContent: ({ children }: any) => <View testID="actionsheet-content">{children}</View>,
    ActionsheetDragIndicator: () => null,
    ActionsheetDragIndicatorWrapper: ({ children }: any) => children,
  };
});

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

jest.mock('@/components/ui/heading', () => ({
  Heading: ({ children, ...props }: any) => {
    const { Text } = require('react-native');
    return <Text {...props}>{children}</Text>;
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
  FormControlError: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
  FormControlErrorText: ({ children, ...props }: any) => {
    const { Text } = require('react-native');
    return <Text {...props}>{children}</Text>;
  },
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
  InputField: (props: any) => {
    const { TextInput } = require('react-native');
    return <TextInput {...props} />;
  },
}));

jest.mock('@/components/ui/textarea', () => ({
  Textarea: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
  TextareaInput: (props: any) => {
    const { TextInput } = require('react-native');
    return <TextInput {...props} multiline />;
  },
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, testID, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={testID} {...props}>{children}</View>;
  },
  SelectTrigger: ({ children, ...props }: any) => {
    const { TouchableOpacity } = require('react-native');
    return <TouchableOpacity {...props}>{children}</TouchableOpacity>;
  },
  SelectInput: ({ placeholder, ...props }: any) => {
    const { Text } = require('react-native');
    return <Text {...props}>{placeholder}</Text>;
  },
  SelectIcon: () => null,
  SelectPortal: ({ children }: any) => children,
  SelectBackdrop: () => null,
  SelectContent: ({ children }: any) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
  SelectDragIndicatorWrapper: ({ children }: any) => children,
  SelectDragIndicator: () => null,
  SelectItem: ({ label, value, ...props }: any) => {
    const { Text } = require('react-native');
    return <Text {...props}>{label}</Text>;
  },
}));

// Mock dependencies
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'dispatch.add_note_title': 'Add New Note',
        'dispatch.note_title_label': 'Title',
        'dispatch.note_title_placeholder': 'Enter note title...',
        'dispatch.note_category_label': 'Category',
        'dispatch.note_category_placeholder': 'Select a category',
        'dispatch.note_no_category': 'No Category',
        'dispatch.note_body_label': 'Note Content',
        'dispatch.note_body_placeholder': 'Enter note content...',
        'common.cancel': 'Cancel',
        'common.save': 'Save',
        'form.required': 'This field is required',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('@/api/notes/notes', () => ({
  getNoteCategories: jest.fn().mockResolvedValue({
    Data: [
      { NoteCategoryId: '1', Category: 'General' },
      { NoteCategoryId: '2', Category: 'Important' },
    ],
  }),
  saveNote: jest.fn().mockResolvedValue({ Data: { NoteId: '123' } }),
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('AddNoteBottomSheet', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onNoteAdded: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when open', async () => {
    const { getByTestId } = render(<AddNoteBottomSheet {...defaultProps} />);
    
    await waitFor(() => {
      expect(getByTestId('actionsheet')).toBeTruthy();
    });
  });

  it('does not render when closed', () => {
    const { queryByTestId } = render(<AddNoteBottomSheet {...defaultProps} isOpen={false} />);
    
    expect(queryByTestId('actionsheet')).toBeNull();
  });

  it('fetches categories when opened', async () => {
    const { getNoteCategories } = require('@/api/notes/notes');
    
    render(<AddNoteBottomSheet {...defaultProps} />);
    
    await waitFor(() => {
      expect(getNoteCategories).toHaveBeenCalled();
    });
  });
});
