import { cleanup, render } from '@testing-library/react-native';
import React from 'react';

import { useAudioStreamStore } from '@/stores/app/audio-stream-store';

import { AudioStreamBottomSheet } from '../audio-stream-bottom-sheet';

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
  cssInterop: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('lucide-react-native', () => ({
  Loader: () => null,
  Volume2: () => null,
  VolumeX: () => null,
}));

jest.mock('@/components/ui/text', () => {
  const { Text } = require('react-native');
  return { Text };
});

jest.mock('../../ui/actionsheet', () => {
  const { View } = require('react-native');
  return {
    Actionsheet: ({ isOpen, children }: any) => (isOpen ? <View testID="actionsheet">{children}</View> : null),
    ActionsheetBackdrop: () => null,
    ActionsheetContent: ({ children }: any) => <View>{children}</View>,
    ActionsheetDragIndicator: () => null,
    ActionsheetDragIndicatorWrapper: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock('../../ui/button', () => {
  const { Text, TouchableOpacity } = require('react-native');
  return {
    Button: ({ children, onPress }: any) => <TouchableOpacity onPress={onPress}>{children}</TouchableOpacity>,
    ButtonText: ({ children }: any) => <Text>{children}</Text>,
  };
});

jest.mock('../../ui/hstack', () => {
  const { View } = require('react-native');
  return { HStack: ({ children }: any) => <View>{children}</View> };
});

jest.mock('../../ui/vstack', () => {
  const { View } = require('react-native');
  return { VStack: ({ children }: any) => <View>{children}</View> };
});

const selectProps: Record<string, unknown>[] = [];
const selectInputProps: Record<string, unknown>[] = [];

jest.mock('../../ui/select', () => {
  const { View } = require('react-native');
  return {
    Select: ({ children, ...props }: any) => {
      selectProps.push(props);
      return <View testID="select">{children}</View>;
    },
    SelectBackdrop: () => null,
    SelectContent: ({ children }: any) => <View>{children}</View>,
    SelectDragIndicator: () => null,
    SelectDragIndicatorWrapper: ({ children }: any) => <View>{children}</View>,
    SelectIcon: () => null,
    SelectInput: (props: any) => {
      selectInputProps.push(props);
      return null;
    },
    SelectItem: () => null,
    SelectPortal: ({ children }: any) => <View>{children}</View>,
    SelectTrigger: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock('@/stores/app/audio-stream-store', () => ({
  useAudioStreamStore: jest.fn(),
}));

const mockUseAudioStreamStore = useAudioStreamStore as unknown as jest.Mock;

const stream = { Id: '3f1a9c6e-6f2b-4f0a-9f31-9a0e3c0f77aa', Name: 'Dispatch Primary', Type: 'Icecast', Url: 'https://relay/live' };

const buildState = (overrides: Record<string, unknown> = {}) => ({
  availableStreams: [stream],
  isLoadingStreams: false,
  currentStream: stream,
  isPlaying: true,
  isLoading: false,
  isBuffering: false,
  isBottomSheetVisible: true,
  setIsBottomSheetVisible: jest.fn(),
  fetchAvailableStreams: jest.fn(),
  playStream: jest.fn(),
  stopStream: jest.fn(),
  ...overrides,
});

const mockStore = (overrides: Record<string, unknown> = {}) => {
  const state = buildState(overrides);
  mockUseAudioStreamStore.mockImplementation((selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state));
};

const lastSelectInputValue = () => selectInputProps[selectInputProps.length - 1]?.value;

beforeEach(() => {
  selectProps.length = 0;
  selectInputProps.length = 0;
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('AudioStreamBottomSheet', () => {
  it('shows the stream name in the trigger, not the stream id', () => {
    mockStore();

    const { unmount } = render(<AudioStreamBottomSheet />);
    expect(selectProps[0]).toEqual(expect.objectContaining({ selectedValue: stream.Id }));
    expect(lastSelectInputValue()).toBe(stream.Name);
    unmount();
  });

  it('still shows the stream name after the sheet is closed and reopened', () => {
    mockStore();

    const { unmount } = render(<AudioStreamBottomSheet />);
    unmount();

    // Reopening remounts the Select (the actionsheet unmounts its children on close), so the
    // displayed label has to come from the store rather than a prior item press.
    selectInputProps.length = 0;
    const reopened = render(<AudioStreamBottomSheet />);
    expect(lastSelectInputValue()).toBe(stream.Name);
    reopened.unmount();
  });

  it('falls back to the none label when no stream is selected', () => {
    mockStore({ currentStream: null, isPlaying: false });

    const { unmount } = render(<AudioStreamBottomSheet />);
    expect(selectProps[0]).toEqual(expect.objectContaining({ selectedValue: 'none' }));
    expect(lastSelectInputValue()).toBe('audio_streams.none');
    unmount();
  });

  it('drops the stale stream name when playback clears the current stream while open', () => {
    mockStore();

    const { rerender, unmount } = render(<AudioStreamBottomSheet />);
    expect(lastSelectInputValue()).toBe(stream.Name);

    // A playback error clears currentStream without any item press.
    mockStore({ currentStream: null, isPlaying: false });
    rerender(<AudioStreamBottomSheet />);

    expect(lastSelectInputValue()).toBe('audio_streams.none');
    unmount();
  });
});
