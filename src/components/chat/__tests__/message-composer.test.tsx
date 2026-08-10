/**
 * The composer toolbar must only offer actions the host surface can actually perform.
 * Thread replies send text and location only; when they still rendered the image button
 * the picker opened and the chosen photo was silently dropped.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: 0, longitude: 0 } }),
}));

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), trace: jest.fn(), fatal: jest.fn() },
}));

jest.mock('@/stores/toast/store', () => ({
  useToastStore: { getState: () => ({ showToast: jest.fn() }) },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The shared lucide mock only exports the icons other suites use; this composer pulls in
// several it does not, which would otherwise render as undefined elements.
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const icon = React.forwardRef((props: Record<string, unknown>, ref: unknown) => React.createElement(View, { ...props, ref }));
  return new Proxy({}, { get: () => icon });
});

import { MessageComposer } from '../message-composer';

const baseProps = {
  onSendText: jest.fn(),
  onSendLocation: jest.fn(),
  onTyping: jest.fn(),
};

describe('MessageComposer attachment actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('offers image and GIF when both callbacks are provided', () => {
    render(<MessageComposer {...baseProps} onSendImage={jest.fn()} onOpenGif={jest.fn()} />);

    expect(screen.queryByLabelText('chat.add_image')).not.toBeNull();
    expect(screen.queryByLabelText('chat.add_gif')).not.toBeNull();
    expect(screen.queryByLabelText('chat.emoji')).not.toBeNull();
  });

  it('hides both when neither callback is provided, as thread replies do', () => {
    render(<MessageComposer {...baseProps} allowUrgent={false} />);

    expect(screen.queryByLabelText('chat.add_image')).toBeNull();
    expect(screen.queryByLabelText('chat.add_gif')).toBeNull();
    // The actions a thread can still perform stay available.
    expect(screen.queryByLabelText('chat.emoji')).not.toBeNull();
    expect(screen.queryByLabelText('chat.share_location')).not.toBeNull();
  });

  it('hides only the GIF action when images are supported but GIFs are not', () => {
    render(<MessageComposer {...baseProps} onSendImage={jest.fn()} />);

    expect(screen.queryByLabelText('chat.add_image')).not.toBeNull();
    expect(screen.queryByLabelText('chat.add_gif')).toBeNull();
  });

  it('hides only the image action when GIFs are supported but images are not', () => {
    render(<MessageComposer {...baseProps} onOpenGif={jest.fn()} />);

    expect(screen.queryByLabelText('chat.add_image')).toBeNull();
    expect(screen.queryByLabelText('chat.add_gif')).not.toBeNull();
  });

  it('invokes the GIF callback when the action is used', () => {
    const onOpenGif = jest.fn();
    render(<MessageComposer {...baseProps} onOpenGif={onOpenGif} />);

    fireEvent.press(screen.getByLabelText('chat.add_gif'));

    expect(onOpenGif).toHaveBeenCalledTimes(1);
  });
});
