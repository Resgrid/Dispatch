import { Image } from 'expo-image';
import { Search } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { searchGifs } from '@/api/chat/chat';
import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '@/components/ui/actionsheet';
import { Box } from '@/components/ui/box';
import { Center } from '@/components/ui/center';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Pressable } from '@/components/ui/pressable';
import { ScrollView } from '@/components/ui/scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { logger } from '@/lib/logging';
import { type GifResultData } from '@/models/v4/chat';

interface GifPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (gif: GifResultData) => void;
}

export function GifPickerSheet({ isOpen, onClose, onSelect }: GifPickerSheetProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifResultData[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const response = await searchGifs(q || undefined, 24, 0, controller.signal);
      if (controller.signal.aborted) return;
      setGifs(response.Data ?? []);
    } catch (error) {
      if (controller.signal.aborted) return;
      logger.debug({ message: 'chat: gif search failed', context: { error } });
      setGifs([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    runSearch('');
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [isOpen, runSearch]);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 400);
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[70]}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <Box className="w-full px-2 pb-2">
          <Input className="rounded-full">
            <InputSlot className="pl-3">
              <InputIcon as={Search} />
            </InputSlot>
            <InputField placeholder={t('chat.search_gifs')} value={query} onChangeText={handleChange} />
          </Input>
        </Box>

        {loading ? (
          <Center className="h-40 w-full">
            <Spinner />
          </Center>
        ) : gifs.length === 0 ? (
          <Center className="h-40 w-full">
            <Text className="text-typography-400">{t('chat.no_gifs')}</Text>
          </Center>
        ) : (
          <ScrollView className="w-full" style={{ maxHeight: 380 }}>
            <HStack className="flex-wrap justify-between px-1">
              {gifs.map((gif) => (
                <Pressable
                  key={gif.Id}
                  className="mb-2"
                  style={{ width: '48%' }}
                  onPress={() => {
                    onSelect(gif);
                    onClose();
                  }}
                >
                  <Image source={{ uri: gif.PreviewUrl }} style={{ width: '100%', height: 120, borderRadius: 8 }} contentFit="cover" />
                </Pressable>
              ))}
            </HStack>
          </ScrollView>
        )}
      </ActionsheetContent>
    </Actionsheet>
  );
}
