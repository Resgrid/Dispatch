import { useColorScheme } from 'nativewind';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CallVideoFeedFormat } from '@/models/v4/callVideoFeeds/callVideoFeedEnums';
import { type CallVideoFeedResultData } from '@/models/v4/callVideoFeeds/callVideoFeedResultData';

interface VideoPlayerProps {
  feed: CallVideoFeedResultData;
  visible: boolean;
  onClose: () => void;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [/(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/, /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/, /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/, /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function getPlayerHtml(feed: CallVideoFeedResultData, isDark: boolean): string | null {
  const bgColor = isDark ? '#171717' : '#ffffff';
  const textColor = isDark ? '#d1d5db' : '#374151';

  switch (feed.FeedFormat) {
    case CallVideoFeedFormat.HLS:
    case CallVideoFeedFormat.DASH:
      return `
        <!DOCTYPE html>
        <html><head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script>
          <style>body{margin:0;padding:0;background:${bgColor};display:flex;align-items:center;justify-content:center;height:100vh}video{width:100%;max-height:100vh}</style>
        </head><body>
          <video id="video" controls autoplay playsinline></video>
          <script>
            var video = document.getElementById('video');
            var url = ${JSON.stringify(feed.Url)};
            if (url.includes('.m3u8') && Hls.isSupported()) {
              var hls = new Hls();
              hls.loadSource(url);
              hls.attachMedia(video);
            } else {
              video.src = url;
            }
          </script>
        </body></html>
      `;

    case CallVideoFeedFormat.YouTubeLive: {
      const videoId = extractYouTubeId(feed.Url);
      if (!videoId) return null;
      return `
        <!DOCTYPE html>
        <html><head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>body{margin:0;padding:0;background:${bgColor}}iframe{width:100%;height:100vh;border:none}</style>
        </head><body>
          <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>
        </body></html>
      `;
    }

    case CallVideoFeedFormat.MJPEG: {
      const mjpegUrl = sanitizeUrl(feed.Url);
      if (!mjpegUrl) return null;
      return `
        <!DOCTYPE html>
        <html><head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>body{margin:0;padding:0;background:${bgColor};display:flex;align-items:center;justify-content:center;height:100vh}img{width:100%;max-height:100vh;object-fit:contain}</style>
        </head><body>
          <img src="${mjpegUrl}" alt="MJPEG Stream" />
        </body></html>
      `;
    }

    case CallVideoFeedFormat.Embed:
    case CallVideoFeedFormat.Other: {
      const embedUrl = sanitizeUrl(feed.Url);
      if (!embedUrl) return null;
      return `
        <!DOCTYPE html>
        <html><head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>body{margin:0;padding:0;background:${bgColor}}iframe{width:100%;height:100vh;border:none}</style>
        </head><body>
          <iframe src="${embedUrl}" sandbox="allow-scripts allow-same-origin" allow="autoplay; encrypted-media" allowfullscreen></iframe>
        </body></html>
      `;
    }

    default:
      return null;
  }
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ feed, visible, onClose }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isLoading, setIsLoading] = useState(true);

  const playerHtml = useMemo(() => getPlayerHtml(feed, isDark), [feed, isDark]);
  const playerSource = useMemo(() => (playerHtml ? { html: playerHtml } : undefined), [playerHtml]);
  const isUnsupported = feed.FeedFormat === CallVideoFeedFormat.RTSP || feed.FeedFormat === CallVideoFeedFormat.WebRTC;

  const handleCopyUrl = async () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(feed.Url);
    } else {
      Alert.alert(t('videoFeeds.copyUrl'), feed.Url);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}>
        {/* Header */}
        <View style={[styles.header, isDark ? styles.headerDark : styles.headerLight]}>
          <View style={styles.headerContent}>
            <Text className="font-semibold">{feed.Name}</Text>
            <Text className="text-xs text-gray-500">{feed.Url}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text className="font-medium text-blue-500">{t('common.close')}</Text>
          </Pressable>
        </View>

        {/* Player */}
        <View style={styles.playerContainer}>
          {isUnsupported ? (
            <Box className="flex-1 items-center justify-center p-8">
              <Text className="mb-4 text-center text-lg font-medium">{t('videoFeeds.unsupportedFormat')}</Text>
              <Text className="mb-6 text-center text-sm text-gray-500">{feed.Url}</Text>
              <Button onPress={handleCopyUrl}>
                <ButtonText>{t('videoFeeds.copyUrl')}</ButtonText>
              </Button>
            </Box>
          ) : playerSource ? (
            <>
              {isLoading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" />
                </View>
              )}
              <WebView source={playerSource} style={styles.webview} allowsInlineMediaPlayback={true} mediaPlaybackRequiresUserAction={false} javaScriptEnabled={true} onLoadEnd={() => setIsLoading(false)} />
            </>
          ) : (
            <Box className="flex-1 items-center justify-center p-8">
              <Text className="mb-4 text-center">{t('videoFeeds.feedError')}</Text>
              <Button onPress={handleCopyUrl}>
                <ButtonText>{t('videoFeeds.copyUrl')}</ButtonText>
              </Button>
            </Box>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerDark: {
    backgroundColor: '#0a0a0a',
  },
  containerLight: {
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerDark: {
    backgroundColor: '#171717',
    borderBottomColor: '#262626',
  },
  headerLight: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e5e7eb',
  },
  headerContent: {
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    padding: 8,
  },
  playerContainer: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
