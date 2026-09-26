import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { type AudioPlayer, type AudioStatus, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Music, PauseIcon, PlayIcon, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { Box } from '@/components/ui/box';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAnalytics } from '@/hooks/use-analytics';
import { logger } from '@/lib/logging';
import { type CallFileResultData } from '@/models/v4/callFiles/callFileResultData';
import { useCallDetailStore } from '@/stores/calls/detail-store';

import { FocusAwareStatusBar } from '../ui';

interface CallAudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  callId: string;
}

export const CallAudioModal: React.FC<CallAudioModalProps> = ({ isOpen, onClose, callId }) => {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { callAudio, isLoadingAudio, errorAudio, fetchCallAudio } = useCallDetailStore();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const soundRef = useRef<AudioPlayer | null>(null);
  // Monotonic id bumped on every play/stop tap so overlapping async loads can tell
  // whether they are still the latest request before committing state.
  const playRequestRef = useRef(0);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['67%'], []);

  const unloadSound = useCallback(async () => {
    if (soundRef.current) {
      try {
        soundRef.current.remove();
      } catch {
        // ignore — player may already be released
      }
      soundRef.current = null;
    }
    setPlayingId(null);
  }, []);

  // Fetch on open; stop playback on close.
  useEffect(() => {
    if (isOpen) {
      bottomSheetRef.current?.expand();
      fetchCallAudio(callId);
    } else {
      bottomSheetRef.current?.close();
      void unloadSound();
    }
  }, [isOpen, callId, fetchCallAudio, unloadSound]);

  // Always release the native sound on unmount.
  useEffect(() => () => void unloadSound(), [unloadSound]);

  useEffect(() => {
    if (isOpen) {
      trackEvent('call_audio_modal_opened', {
        callId,
        audioCount: callAudio?.length || 0,
        isLoadingAudio,
        hasError: !!errorAudio,
      });
    }
  }, [isOpen, trackEvent, callId, callAudio, isLoadingAudio, errorAudio]);

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose();
      }
    },
    [onClose]
  );

  const renderBackdrop = useCallback((props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />, []);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handlePlay = async (file: CallFileResultData) => {
    if (!file.Url) return;

    // This tap is now the latest request; any in-flight load is superseded.
    const requestId = ++playRequestRef.current;

    // Tapping the currently-playing clip stops it.
    if (playingId === file.Id) {
      await unloadSound();
      return;
    }
    try {
      setLoadingId(file.Id);
      await unloadSound();
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });

      // A newer tap arrived while the audio session was being configured — bail out so
      // this clip can't overwrite soundRef.current or start overlapping playback.
      if (requestId !== playRequestRef.current) {
        return;
      }

      const sound = createAudioPlayer({ uri: file.Url.trim() });
      sound.volume = 1.0;
      sound.addListener('playbackStatusUpdate', (status: AudioStatus) => {
        if (status.didJustFinish && soundRef.current === sound) {
          void unloadSound();
        }
      });

      soundRef.current = sound;
      setPlayingId(file.Id);
      sound.play();
    } catch (error) {
      logger.error({ message: 'Failed to play call audio', context: { error, callId } });
    } finally {
      // Only the latest request should clear the shared loading indicator.
      if (requestId === playRequestRef.current) {
        setLoadingId(null);
      }
    }
  };

  const renderAudioItem = (file: CallFileResultData) => {
    const isPlaying = playingId === file.Id;
    const isBusy = loadingId === file.Id;

    return (
      <Pressable
        key={file.Id}
        onPress={() => handlePlay(file)}
        className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
        style={{ opacity: file.Url ? 1 : 0.5 }}
        testID={`audio-item-${file.Id}`}
      >
        <HStack space="md" className="items-center">
          <Music size={24} color="#6B7280" />
          <VStack className="flex-1" space="xs">
            <Text className="font-medium text-gray-900 dark:text-gray-100" numberOfLines={1}>
              {file.Name || file.FileName || t('calls.audio.audio_name')}
            </Text>
            {file.Timestamp ? <Text className="text-sm text-gray-500 dark:text-gray-400">{formatDate(file.Timestamp)}</Text> : null}
          </VStack>
          <Box className="items-center justify-center">{isBusy ? <Spinner size="small" /> : isPlaying ? <PauseIcon size={22} color="#6B7280" /> : <PlayIcon size={22} color="#6B7280" />}</Box>
        </HStack>
      </Pressable>
    );
  };

  const renderContent = () => {
    if (isLoadingAudio) {
      return (
        <Box className="flex-1 items-center justify-center py-8">
          <Spinner size="large" />
          <Text className="mt-4 text-gray-600 dark:text-gray-400">{t('common.loading')}</Text>
        </Box>
      );
    }

    if (errorAudio) {
      return (
        <Box className="flex-1 items-center justify-center py-8">
          <Text className="text-center text-red-600 dark:text-red-400">{t('calls.audio.error')}</Text>
          <Text className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">{errorAudio}</Text>
          <Button variant="outline" onPress={() => fetchCallAudio(callId)} className="mt-4" size="sm">
            <Text>{t('common.retry')}</Text>
          </Button>
        </Box>
      );
    }

    if (!callAudio || callAudio.length === 0) {
      return (
        <Box className="flex-1 items-center justify-center py-8">
          <Music size={48} color="#9CA3AF" />
          <Text className="mt-4 text-gray-600 dark:text-gray-400">{t('calls.audio.no_audio')}</Text>
          <Text className="mt-2 text-center text-sm text-gray-500 dark:text-gray-500">{t('calls.audio.no_audio_description')}</Text>
        </Box>
      );
    }

    return (
      <VStack space="md" className="w-full">
        {callAudio.map(renderAudioItem)}
      </VStack>
    );
  };

  return (
    <>
      <FocusAwareStatusBar hidden={true} />
      <BottomSheet
        ref={bottomSheetRef}
        index={isOpen ? 0 : -1}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        backdropComponent={renderBackdrop}
        enablePanDownToClose={true}
        handleIndicatorStyle={{ backgroundColor: '#D1D5DB' }}
        backgroundStyle={{ backgroundColor: 'white' }}
      >
        <BottomSheetView style={{ flex: 1 }} testID="call-audio-modal">
          <VStack space="md" className="bg-white dark:bg-gray-800">
            <Box className="w-full flex-row items-center justify-between border-b border-gray-200 px-4 pb-4 pt-2 dark:border-gray-700">
              <Heading size="lg">{t('calls.audio.title')}</Heading>
              <Button variant="link" onPress={onClose} className="p-1" testID="close-button">
                <X size={24} />
              </Button>
            </Box>
          </VStack>

          <ScrollView style={{ flex: 1 }} className="bg-white dark:bg-gray-800" showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
            {renderContent()}
          </ScrollView>
        </BottomSheetView>
      </BottomSheet>
    </>
  );
};

export default CallAudioModal;
