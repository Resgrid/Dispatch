import { Loader, Volume2, VolumeX } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { useAudioStreamStore } from '@/stores/app/audio-stream-store';

import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '../ui/actionsheet';
import { Button, ButtonText } from '../ui/button';
import { HStack } from '../ui/hstack';
import { Select, SelectBackdrop, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '../ui/select';
import { VStack } from '../ui/vstack';

export const AudioStreamBottomSheet = () => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();

  const { isBottomSheetVisible, setIsBottomSheetVisible, availableStreams, currentStream, isLoadingStreams, isPlaying, isLoading, isBuffering, fetchAvailableStreams, playStream, stopStream } = useAudioStreamStore();

  useEffect(() => {
    // Fetch available streams when bottom sheet opens
    if (isBottomSheetVisible && availableStreams.length === 0) {
      fetchAvailableStreams();
    }
  }, [isBottomSheetVisible, availableStreams.length, fetchAvailableStreams]);

  const handleStreamSelection = React.useCallback(
    async (streamId: string) => {
      try {
        if (streamId === 'none') {
          // Stop current stream
          await stopStream();
        } else {
          // Find and play the selected stream
          const selectedStream = availableStreams.find((s) => s.Id === streamId);
          if (selectedStream) {
            await playStream(selectedStream);
          }
        }
      } catch (error) {
        console.error('Failed to handle stream selection:', error);
      }
    },
    [availableStreams, stopStream, playStream]
  );

  const getCurrentStreamValue = () => {
    return currentStream ? currentStream.Id : 'none';
  };

  // The Select only tracks an option's label in internal state set when that option is pressed:
  // it never maps `selectedValue` back to a label. So the trigger falls back to rendering the
  // raw value -- the stream's GUID -- whenever the label state is missing (the Actionsheet
  // unmounts its children on close, so every reopen starts empty) or stale (playback failing
  // clears currentStream without a press). Driving SelectInput's value directly keeps the
  // trigger in sync with the store in both cases.
  const getCurrentStreamLabel = () => {
    return currentStream ? (currentStream.Name ?? '') : t('audio_streams.none');
  };

  const getDisplayText = () => {
    if (isLoading) {
      return t('audio_streams.loading_stream');
    }
    if (isBuffering) {
      return t('audio_streams.buffering_stream');
    }
    if (currentStream) {
      return isPlaying ? t('audio_streams.currently_playing', { streamName: currentStream.Name }) : t('audio_streams.stream_selected', { streamName: currentStream.Name });
    }
    return t('audio_streams.no_stream_playing');
  };

  return (
    <Actionsheet isOpen={isBottomSheetVisible} onClose={() => setIsBottomSheetVisible(false)}>
      <ActionsheetBackdrop />
      <ActionsheetContent className={colorScheme === 'dark' ? 'bg-neutral-900' : 'bg-white'}>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack space="lg" className="w-full p-4">
          {/* Header */}
          <VStack space="sm" className="items-center">
            {isLoading || isBuffering ? (
              <Loader size={32} color={colorScheme === 'dark' ? '#fff' : '#000'} />
            ) : currentStream && isPlaying ? (
              <Volume2 size={32} color={colorScheme === 'dark' ? '#fff' : '#000'} />
            ) : (
              <VolumeX size={32} color={colorScheme === 'dark' ? '#6b7280' : '#9ca3af'} />
            )}
            <Text className="text-center text-lg font-semibold">{t('audio_streams.title')}</Text>
            <Text className="text-center text-sm text-gray-500">{getDisplayText()}</Text>
          </VStack>

          {/* Stream Selection */}
          <VStack space="md">
            <Text className="font-medium">{t('audio_streams.select_stream')}</Text>

            {isLoadingStreams ? (
              <HStack space="sm" className="items-center justify-center p-4">
                <Loader size={16} color={colorScheme === 'dark' ? '#fff' : '#000'} />
                <Text className="text-sm text-gray-500">{t('audio_streams.loading_streams')}</Text>
              </HStack>
            ) : (
              <Select selectedValue={getCurrentStreamValue()} onValueChange={handleStreamSelection} isDisabled={isLoading || isBuffering}>
                <SelectTrigger>
                  <SelectInput placeholder={t('audio_streams.select_placeholder')} value={getCurrentStreamLabel()} />
                  <SelectIcon />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>

                    {/* None option */}
                    <SelectItem label={t('audio_streams.none')} value="none" />

                    {/* Available streams */}
                    {availableStreams.map((stream) => (
                      <SelectItem key={stream.Id} label={stream.Name} value={stream.Id} />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
            )}
          </VStack>

          {/* Stream Info */}
          {currentStream ? (
            <VStack space="sm" className={`rounded-lg p-3 ${colorScheme === 'dark' ? 'bg-neutral-800' : 'bg-gray-50'}`}>
              <Text className="font-medium">{t('audio_streams.stream_info')}</Text>
              <VStack space="xs">
                <HStack space="sm" className="items-center">
                  <Text className="flex-1 text-sm text-gray-500">{t('audio_streams.name')}:</Text>
                  <Text className="text-sm font-medium">{currentStream.Name}</Text>
                </HStack>
                <HStack space="sm" className="items-center">
                  <Text className="flex-1 text-sm text-gray-500">{t('audio_streams.type')}:</Text>
                  <Text className="text-sm font-medium">{currentStream.Type || t('common.unknown')}</Text>
                </HStack>
                <HStack space="sm" className="items-center">
                  <Text className="flex-1 text-sm text-gray-500">{t('audio_streams.status')}:</Text>
                  <HStack space="xs" className="items-center">
                    {isLoading || isBuffering ? (
                      <>
                        <Loader size={14} color="#3b82f6" />
                        <Text className="text-sm font-medium text-blue-600">{isLoading ? t('audio_streams.loading') : t('audio_streams.buffering')}</Text>
                      </>
                    ) : isPlaying ? (
                      <>
                        <Volume2 size={14} color="#22c55e" />
                        <Text className="text-sm font-medium text-green-600">{t('audio_streams.playing')}</Text>
                      </>
                    ) : (
                      <>
                        <VolumeX size={14} color="#ef4444" />
                        <Text className="text-sm font-medium text-red-600">{t('audio_streams.stopped')}</Text>
                      </>
                    )}
                  </HStack>
                </HStack>
              </VStack>
            </VStack>
          ) : null}

          {/* Action Buttons */}
          <VStack space="sm">
            {!isLoadingStreams && availableStreams.length === 0 ? (
              <Button onPress={fetchAvailableStreams} variant="outline">
                <ButtonText>{t('audio_streams.refresh_streams')}</ButtonText>
              </Button>
            ) : null}

            <Button onPress={() => setIsBottomSheetVisible(false)} variant="outline">
              <ButtonText>{t('common.close')}</ButtonText>
            </Button>
          </VStack>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
};
