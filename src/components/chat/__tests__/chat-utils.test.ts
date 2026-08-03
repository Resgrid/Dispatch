import { type TFunction } from 'i18next';

import { ChatChannelType, type ChatChannelResultData } from '@/models/v4/chat';

import { getChannelDisplayName, getImageMimeType, hasLink, linkifySegments } from '../chat-utils';

const mockT = ((key: string) => key) as TFunction;

const buildChannel = (overrides: Partial<ChatChannelResultData>): ChatChannelResultData => ({ ...overrides }) as ChatChannelResultData;

describe('chat-utils', () => {
  describe('getChannelDisplayName', () => {
    it('returns the channel name when one is set', () => {
      const channel = buildChannel({ Name: 'Engine 1', ChannelType: ChatChannelType.DirectMessage });
      expect(getChannelDisplayName(channel, mockT)).toBe('Engine 1');
    });

    it('ignores blank channel names', () => {
      const channel = buildChannel({ Name: '   ', ChannelType: ChatChannelType.AdHocGroup });
      expect(getChannelDisplayName(channel, mockT)).toBe('chat.channel');
    });

    it('resolves the direct message fallback through t()', () => {
      const channel = buildChannel({ Name: '', ChannelType: ChatChannelType.DirectMessage });
      expect(getChannelDisplayName(channel, mockT)).toBe('chat.direct_message');
    });

    it('resolves the generic channel fallback through t()', () => {
      const channel = buildChannel({ Name: '', ChannelType: ChatChannelType.AdHocGroup });
      expect(getChannelDisplayName(channel, mockT)).toBe('chat.channel');
    });
  });

  describe('getImageMimeType', () => {
    it('prefers the picker asset mimeType when available', () => {
      expect(getImageMimeType('file:///photos/photo.jpg', 'image/png')).toBe('image/png');
    });

    it('falls back to the uri extension when no asset mimeType is given', () => {
      expect(getImageMimeType('file:///photos/photo.png')).toBe('image/png');
      expect(getImageMimeType('file:///photos/photo.gif')).toBe('image/gif');
      expect(getImageMimeType('file:///photos/photo.webp')).toBe('image/webp');
      expect(getImageMimeType('file:///photos/photo.HEIC')).toBe('image/heic');
      expect(getImageMimeType('file:///photos/photo.jpeg')).toBe('image/jpeg');
    });

    it('ignores query strings when reading the extension', () => {
      expect(getImageMimeType('file:///photos/photo.png?width=100')).toBe('image/png');
    });

    it('treats a null asset mimeType as missing', () => {
      expect(getImageMimeType('file:///photos/photo.png', null)).toBe('image/png');
    });

    it('defaults to image/jpeg for unknown or missing extensions', () => {
      expect(getImageMimeType('file:///photos/photo.bmp')).toBe('image/jpeg');
      expect(getImageMimeType('file:///photos/photo')).toBe('image/jpeg');
    });
  });

  describe('hasLink', () => {
    it('returns consistent results across repeated calls on the same body', () => {
      const body = 'see https://resgrid.com for details';
      expect(hasLink(body)).toBe(true);
      expect(hasLink(body)).toBe(true);
      expect(hasLink(body)).toBe(true);
    });

    it('returns false for empty or link-free bodies', () => {
      expect(hasLink(undefined)).toBe(false);
      expect(hasLink(null)).toBe(false);
      expect(hasLink('')).toBe(false);
      expect(hasLink('no links here')).toBe(false);
    });
  });

  describe('linkifySegments', () => {
    it('splits multiple links and surrounding text', () => {
      expect(linkifySegments('go to https://a.com or http://b.com now')).toEqual([
        { text: 'go to ', isLink: false },
        { text: 'https://a.com', isLink: true },
        { text: ' or ', isLink: false },
        { text: 'http://b.com', isLink: true },
        { text: ' now', isLink: false },
      ]);
    });

    it('returns consistent results across repeated calls', () => {
      const body = 'go to https://a.com';
      expect(linkifySegments(body)).toEqual(linkifySegments(body));
    });

    it('returns an empty array for empty input', () => {
      expect(linkifySegments('')).toEqual([]);
    });
  });
});
