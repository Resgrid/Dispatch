import * as Clipboard from 'expo-clipboard';
import { type TFunction } from 'i18next';

import { getAvatarUrl } from '@/lib/utils';
import { type ChatChannelResultData, ChatChannelType, type ChatGifMetadata, type ChatImageMetadata, type ChatLocationMetadata } from '@/models/v4/chat';

/** Buckets used to group the channel list into sections. */
export interface GroupedChannels {
  directMessages: ChatChannelResultData[];
  channels: ChatChannelResultData[];
  incidents: ChatChannelResultData[];
  assistant: ChatChannelResultData[];
}

export function groupChannels(channels: ChatChannelResultData[]): GroupedChannels {
  const grouped: GroupedChannels = { directMessages: [], channels: [], incidents: [], assistant: [] };
  for (const channel of channels) {
    if (channel.IsArchived) continue;
    switch (channel.ChannelType) {
      case ChatChannelType.DirectMessage:
        grouped.directMessages.push(channel);
        break;
      case ChatChannelType.Incident:
      case ChatChannelType.IncidentLane:
      case ChatChannelType.IncidentCommand:
      case ChatChannelType.IncidentLeads:
      case ChatChannelType.IncidentDispatch:
        grouped.incidents.push(channel);
        break;
      case ChatChannelType.Chatbot:
        grouped.assistant.push(channel);
        break;
      default:
        grouped.channels.push(channel);
        break;
    }
  }
  const byRecent = (a: ChatChannelResultData, b: ChatChannelResultData) => new Date(b.LastMessageOn ?? 0).getTime() - new Date(a.LastMessageOn ?? 0).getTime();
  grouped.directMessages.sort(byRecent);
  grouped.channels.sort(byRecent);
  grouped.incidents.sort(byRecent);
  return grouped;
}

export function getChannelDisplayName(channel: ChatChannelResultData, t: TFunction): string {
  if (channel.Name && channel.Name.trim().length > 0) return channel.Name;
  if (channel.ChannelType === ChatChannelType.DirectMessage) return t('chat.direct_message');
  return t('chat.channel');
}

export function isDirectMessage(channel: ChatChannelResultData): boolean {
  return channel.ChannelType === ChatChannelType.DirectMessage;
}

export function getPersonAvatarUrl(userId?: string | null): string | undefined {
  if (!userId) return undefined;
  return getAvatarUrl(userId);
}

export function parseMetadata<T>(metadataJson?: string | null): T | null {
  if (!metadataJson) return null;
  try {
    return JSON.parse(metadataJson) as T;
  } catch {
    return null;
  }
}

/**
 * MetadataJson wire contract, shared with the web client: a nested, camelCase envelope
 * — `{ location: { latitude, longitude, label } }` and `{ gif: { url, previewUrl, width,
 * height } }`. Earlier mobile builds wrote a flat PascalCase object that the web client
 * cannot read (it falls back to rendering the message body), so the builders below emit
 * only the nested form while the parsers still accept the flat one for history already
 * stored on the server.
 */
function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function buildLocationMetadata(latitude: number, longitude: number, label?: string): string {
  return JSON.stringify({ location: { latitude, longitude, label } });
}

export function buildGifMetadata(gif: { GifUrl: string; PreviewUrl?: string; Width?: number; Height?: number }): string {
  return JSON.stringify({ gif: { url: gif.GifUrl, previewUrl: gif.PreviewUrl, width: gif.Width, height: gif.Height } });
}

export function parseLocationMetadata(metadataJson?: string | null): ChatLocationMetadata | null {
  const raw = parseMetadata<Record<string, unknown>>(metadataJson);
  if (!raw) return null;
  const nested = (raw.location ?? raw.Location) as Record<string, unknown> | undefined;
  const source = nested ?? raw;
  const latitude = readNumber(source.latitude ?? source.Latitude);
  const longitude = readNumber(source.longitude ?? source.Longitude);
  if (latitude === undefined || longitude === undefined) return null;
  return { Latitude: latitude, Longitude: longitude, Label: readString(source.label ?? source.Label) };
}

export function parseGifMetadata(metadataJson?: string | null): ChatGifMetadata | null {
  const raw = parseMetadata<Record<string, unknown>>(metadataJson);
  if (!raw) return null;
  const nested = (raw.gif ?? raw.Gif) as Record<string, unknown> | undefined;
  const source = nested ?? raw;
  const url = readString(source.url ?? source.Url ?? source.gifUrl ?? source.GifUrl);
  if (!url) return null;
  return {
    GifUrl: url,
    PreviewUrl: readString(source.previewUrl ?? source.PreviewUrl),
    Width: readNumber(source.width ?? source.Width),
    Height: readNumber(source.height ?? source.Height),
    Title: readString(source.title ?? source.Title),
  };
}

export function parseImageMetadata(metadataJson?: string | null): ChatImageMetadata | null {
  return parseMetadata<ChatImageMetadata>(metadataJson);
}

const URL_REGEX = /(https?:\/\/[^\s]+)/;
const URL_REGEX_GLOBAL = new RegExp(URL_REGEX.source, 'g');

export interface TextSegment {
  text: string;
  isLink: boolean;
}

/** Splits a message body into plain-text and link segments for rendering. */
export function linkifySegments(body: string): TextSegment[] {
  if (!body) return [];
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  const matches = body.matchAll(URL_REGEX_GLOBAL);
  for (const match of matches) {
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ text: body.slice(lastIndex, index), isLink: false });
    segments.push({ text: match[0], isLink: true });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < body.length) segments.push({ text: body.slice(lastIndex), isLink: false });
  return segments;
}

export function hasLink(body?: string | null): boolean {
  if (!body) return false;
  return URL_REGEX.test(body);
}

/**
 * Copies text to the clipboard. Uses the async Clipboard API on web/Electron
 * and expo-clipboard on native; returns false only when both are unavailable
 * or the write fails, so callers can surface an appropriate message.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const nav = (globalThis as unknown as { navigator?: { clipboard?: { writeText?: (value: string) => Promise<void> } } }).navigator;
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    // ignore and fall through to the native module
  }
  try {
    return await Clipboard.setStringAsync(text);
  } catch {
    return false;
  }
}

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

/** Best-effort image MIME type: prefer the picker asset metadata, then the file extension. */
export function getImageMimeType(uri: string, assetMimeType?: string | null): string {
  if (assetMimeType) return assetMimeType;
  const extension = uri.split('?')[0].split('.').pop()?.toLowerCase();
  return (extension ? IMAGE_MIME_BY_EXTENSION[extension] : undefined) ?? 'image/jpeg';
}

/** Relative-ish short time label for message rows and channel list. */
export function formatShortTime(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = Date.now();
  const diffMs = now - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  if (diffMs < oneDay && now >= date.getTime()) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
