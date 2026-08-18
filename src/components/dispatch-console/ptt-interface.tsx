import { PhoneOff, Radio, Wifi, WifiOff } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { usePTT } from '@/hooks/use-ptt';

import { PTTChannelSelector } from './ptt-channel-selector';

interface PTTInterfaceProps {
  /** Optional callback when PTT press starts (for activity logging) */
  onPTTPress?: () => void;
  /** Optional callback when PTT press ends (for activity logging) */
  onPTTRelease?: () => void;
  /** External transmitting state (for activity logging only, actual state managed by hook) */
  isTransmitting?: boolean;
  /** Display name for current channel (fallback only, actual channel from hook) */
  currentChannel?: string;
}

const PTTInterfaceComponent: React.FC<PTTInterfaceProps> = ({ onPTTPress, onPTTRelease, isTransmitting: externalTransmitting = false, currentChannel: externalChannel = 'Disconnected' }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();

  // Use refs to store callback functions to avoid re-creating onTransmittingChange
  const onPTTPressRef = useRef(onPTTPress);
  const onPTTReleaseRef = useRef(onPTTRelease);

  // Keep refs in sync with props
  useEffect(() => {
    onPTTPressRef.current = onPTTPress;
  }, [onPTTPress]);

  useEffect(() => {
    onPTTReleaseRef.current = onPTTRelease;
  }, [onPTTRelease]);

  // Memoize the callback to prevent infinite loops - use refs to access latest props
  const handleTransmittingChange = useCallback((transmitting: boolean) => {
    if (transmitting) {
      onPTTPressRef.current?.();
    } else {
      onPTTReleaseRef.current?.();
    }
  }, []);

  // PTT hook for LiveKit integration
  const {
    isConnected,
    isConnecting,
    isTransmitting: pttTransmitting,
    isMuted,
    currentChannel: pttChannel,
    availableChannels,
    isVoiceEnabled,
    error,
    connect,
    disconnect,
    startTransmitting,
    stopTransmitting,
    selectChannel,
    refreshVoiceSettings,
  } = usePTT({
    onTransmittingChange: handleTransmittingChange,
  });

  // Local state for channel selector
  const [isChannelSelectorOpen, setIsChannelSelectorOpen] = useState(false);

  // Use actual PTT state or fallback to external props
  const isTransmitting = isConnected ? pttTransmitting : externalTransmitting;
  const displayChannel = isConnected ? pttChannel?.Name || externalChannel : pttChannel?.Name || t('dispatch.disconnected');

  // Toggle-style PTT handler - tap to start/stop transmitting
  const handlePTTToggle = useCallback(async () => {
    if (!isConnected) {
      // If not connected, try to connect first
      if (availableChannels.length > 0 && !pttChannel) {
        // Auto-select default channel or first available
        const defaultChannel = availableChannels.find((c) => c.IsDefault) || availableChannels[0];
        selectChannel(defaultChannel);
        await connect(defaultChannel);
      } else if (pttChannel) {
        await connect();
      }
      return;
    }

    // Toggle transmitting state
    if (pttTransmitting) {
      await stopTransmitting();
    } else {
      await startTransmitting();
    }
  }, [isConnected, availableChannels, pttChannel, pttTransmitting, selectChannel, connect, startTransmitting, stopTransmitting]);

  const handleChannelPress = useCallback(() => {
    if (isVoiceEnabled && availableChannels.length > 0) {
      setIsChannelSelectorOpen(true);
    }
  }, [isVoiceEnabled, availableChannels]);

  const handleChannelSelect = useCallback(
    async (channelId: string) => {
      const channel = availableChannels.find((c) => c.Id === channelId);
      if (channel) {
        // Disconnect from current channel if connected
        if (isConnected) {
          await disconnect();
        }
        selectChannel(channel);
        setIsChannelSelectorOpen(false);
        // Auto-connect to the selected channel
        await connect(channel);
      }
    },
    [availableChannels, isConnected, disconnect, selectChannel, connect]
  );

  const handleDisconnect = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  // Get connection status indicator
  const getConnectionIndicator = () => {
    if (isConnecting) {
      return (
        <View style={styles.connectingIndicator}>
          <Text className="text-xs font-bold text-white">...</Text>
        </View>
      );
    }
    if (isConnected) {
      if (isTransmitting) {
        return (
          <View style={styles.transmittingIndicator}>
            <Text className="text-xs font-bold text-white">TX</Text>
          </View>
        );
      }
      return (
        <View style={styles.connectedIndicator}>
          <Text className="text-xs font-bold text-white">RX</Text>
        </View>
      );
    }
    return (
      <View style={styles.disconnectedIndicator}>
        <Text className="text-xs font-bold text-white">OFF</Text>
      </View>
    );
  };

  // Determine PTT button state
  const getPTTButtonStyle = () => {
    if (!isVoiceEnabled) {
      return [styles.pttButtonCompact, styles.pttButtonDisabled];
    }
    if (isConnecting) {
      return [styles.pttButtonCompact, styles.pttButtonConnecting];
    }
    if (isTransmitting) {
      return [styles.pttButtonCompact, styles.pttButtonActive];
    }
    if (isConnected) {
      return [styles.pttButtonCompact, styles.pttButtonConnected];
    }
    return [styles.pttButtonCompact];
  };

  return (
    <Box className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <HStack className="items-center justify-between p-2" space="sm">
        {/* Channel & Stream Info */}
        <HStack className="flex-1 items-center" space="sm">
          {/* Connection Status Indicator */}
          {getConnectionIndicator()}

          {/* Channel Info */}
          <VStack className="flex-1">
            <Pressable onPress={handleChannelPress} disabled={!isVoiceEnabled}>
              <HStack className="items-center" space="xs">
                <Icon as={isConnected ? Wifi : WifiOff} size="2xs" color={isConnected ? '#22c55e' : colorScheme === 'dark' ? '#6b7280' : '#9ca3af'} />
                <Text className={`text-xs ${isConnected ? 'font-medium text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`} numberOfLines={1}>
                  {isVoiceEnabled ? displayChannel : t('dispatch.voice_disabled')}
                </Text>
              </HStack>
            </Pressable>
          </VStack>
        </HStack>

        {/* Compact Controls */}
        <HStack className="items-center" space="sm">
          {/* Disconnect Button (only shown when connected) */}
          {isConnected ? (
            <Pressable onPress={handleDisconnect} style={StyleSheet.flatten([styles.compactControlButton, styles.disconnectButton])}>
              <Icon as={PhoneOff} size="sm" color="#fff" />
            </Pressable>
          ) : null}

          {/* PTT Toggle Button - tap to start/stop transmitting */}
          <Pressable onPress={handlePTTToggle} style={StyleSheet.flatten(getPTTButtonStyle())} disabled={!isVoiceEnabled}>
            <Icon as={Radio} size="sm" color="#fff" />
          </Pressable>
        </HStack>
      </HStack>

      {/* Error display */}
      {error ? (
        <View style={styles.errorBanner}>
          <Text className="text-xs text-red-100">{error}</Text>
        </View>
      ) : null}

      {/* Channel Selector Bottom Sheet */}
      <PTTChannelSelector
        isOpen={isChannelSelectorOpen}
        onClose={() => setIsChannelSelectorOpen(false)}
        channels={availableChannels}
        selectedChannelId={pttChannel?.Id}
        onSelectChannel={handleChannelSelect}
        isConnected={isConnected}
      />
    </Box>
  );
};

// Memoized: the panel hangs directly off the dispatch console, so without this any console
// re-render walks its entire subtree.
export const PTTInterface = React.memo(PTTInterfaceComponent);

PTTInterface.displayName = 'PTTInterface';

const styles = StyleSheet.create({
  compactControlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Note: mutedButton style kept for backwards compatibility but no longer used
  mutedButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  disconnectButton: {
    backgroundColor: '#ef4444',
  },
  pttButtonCompact: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
      },
    }),
  } as any,
  pttButtonActive: {
    backgroundColor: '#ef4444',
    ...Platform.select({
      web: {
        transform: 'scale(0.95)',
      },
      default: {
        transform: [{ scale: 0.95 }],
      },
    }),
  } as any,
  pttButtonConnected: {
    backgroundColor: '#3b82f6',
  },
  pttButtonConnecting: {
    backgroundColor: '#f59e0b',
  },
  pttButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  transmittingIndicator: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 28,
    alignItems: 'center',
  },
  connectedIndicator: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 28,
    alignItems: 'center',
  },
  connectingIndicator: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 28,
    alignItems: 'center',
  },
  disconnectedIndicator: {
    backgroundColor: '#6b7280',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 28,
    alignItems: 'center',
  },
  errorBanner: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
