import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Platform, useWindowDimensions } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { ProtectedText } from '@/components/data-protection/protected-text';
import { isRedactedValue, ProtectedFieldIds } from '@/lib/data-protection/redacted';
import { SearchIcon, X } from '@/components/ui/lucide-icons';
import { useAnalytics } from '@/hooks/use-analytics';
import { useAuthStore } from '@/lib/auth';
import { useCallDetailStore } from '@/stores/calls/detail-store';

import { Loading } from '../common/loading';
import ZeroState from '../common/zero-state';
import { FocusAwareStatusBar } from '../ui';
import { Box } from '../ui/box';
import { Button, ButtonText } from '../ui/button';
import { Divider } from '../ui/divider';
import { Heading } from '../ui/heading';
import { HStack } from '../ui/hstack';
import { Input } from '../ui/input';
import { InputSlot } from '../ui/input';
import { InputField } from '../ui/input';
import { Text } from '../ui/text';
import { Textarea } from '../ui/textarea';
import { TextareaInput } from '../ui/textarea';
import { VStack } from '../ui/vstack';

interface CallNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  callId: string;
}

const CallNotesModal = ({ isOpen, onClose, callId }: CallNotesModalProps) => {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const [searchQuery, setSearchQuery] = useState('');
  const [newNote, setNewNote] = useState('');
  const { callNotes, addNote, searchNotes, isNotesLoading, fetchCallNotes } = useCallDetailStore();
  const { profile } = useAuthStore();
  const { height } = useWindowDimensions();

  // Bottom sheet ref and snap points
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['67%'], []);

  // Fetch call notes when modal opens
  useEffect(() => {
    if (isOpen && callId) {
      fetchCallNotes(callId);
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isOpen, callId, fetchCallNotes]);

  // Track when call notes modal is opened/rendered
  useEffect(() => {
    if (isOpen) {
      trackEvent('call_notes_modal_opened', {
        callId: callId,
        existingNotesCount: callNotes.length,
        hasSearchQuery: searchQuery.length > 0,
        isNotesLoading: isNotesLoading,
      });
    }
  }, [isOpen, trackEvent, callId, callNotes.length, searchQuery.length, isNotesLoading]);

  const filteredNotes = React.useMemo(() => {
    return searchNotes(searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchNotes, callNotes]);

  // Get current user from profile
  const currentUser = profile?.sub || '';

  const handleAddNote = React.useCallback(async () => {
    if (newNote.trim()) {
      try {
        await addNote(callId, newNote, currentUser, null, null);
        setNewNote('');
        Keyboard.dismiss();
      } catch (error) {
        console.error('Failed to add note:', error);
      }
    }
  }, [newNote, callId, currentUser, addNote]);

  // Handle sheet changes
  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose();
      }
    },
    [onClose]
  );

  // Render backdrop
  const renderBackdrop = useCallback((props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />, []);

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
        <BottomSheetView style={{ flex: 1 }}>
          {/* Fixed Header */}
          <VStack space="md" className="bg-white dark:bg-gray-800">
            <Box className="w-full flex-row items-center justify-between border-b border-gray-200 px-4 pb-4 pt-2 dark:border-gray-700">
              <Heading size="lg">{t('callNotes.title')}</Heading>
              <Button variant="link" onPress={onClose} className="p-1" testID="close-button">
                <X size={24} />
              </Button>
            </Box>

            {/* Search Bar - Fixed */}
            <Box className="px-4 pb-4">
              <Input className="w-full rounded-lg bg-gray-100 dark:bg-gray-700">
                <InputSlot>
                  <SearchIcon size={20} className="text-gray-500" />
                </InputSlot>
                <InputField placeholder={t('callNotes.searchPlaceholder')} value={searchQuery} onChangeText={setSearchQuery} />
              </Input>
            </Box>
          </VStack>

          {/* Scrollable Notes List - This is the only scrollable part */}
          <ScrollView style={{ flex: 1 }} className="bg-white dark:bg-gray-800" showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
            <VStack space="md" className="w-full">
              {isNotesLoading ? (
                <Loading />
              ) : filteredNotes.length > 0 ? (
                filteredNotes.map((note) => (
                  <Box key={note.CallNoteId} className="w-full rounded-lg bg-gray-50 p-4 shadow-xs dark:bg-gray-700">
                    <ProtectedText value={note.Note} fieldId={ProtectedFieldIds.callNote} className="mb-2 text-gray-800 dark:text-gray-200" />
                    <HStack className="w-full justify-between">
                      <Text className="text-xs text-gray-500 dark:text-gray-400">{note.FullName}</Text>
                      <Text className="text-xs text-gray-500 dark:text-gray-400">{note.TimestampFormatted}</Text>
                    </HStack>
                  </Box>
                ))
              ) : (
                <ZeroState heading="No notes found" />
              )}
            </VStack>
          </ScrollView>

          <Divider />

          {/* Fixed Footer - Always at bottom */}
          <KeyboardAwareScrollView keyboardShouldPersistTaps={Platform.OS === 'android' ? 'handled' : 'always'} showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
            <Box className="w-full bg-gray-50 p-4 dark:bg-gray-900">
              <VStack space="md" className="w-full">
                <Textarea className="w-full rounded-lg bg-white dark:bg-gray-700">
                  <TextareaInput placeholder={t('callNotes.addNotePlaceholder')} value={newNote} onChangeText={setNewNote} autoCorrect={false} className="min-h-[80px] w-full" />
                </Textarea>
                <HStack className="w-full justify-end">
                  <Button onPress={handleAddNote} className="bg-blue-600 dark:bg-blue-500" isDisabled={!newNote.trim() || isNotesLoading}>
                    <HStack space="xs" className="text-center">
                      <ButtonText>{t('callNotes.addNote')}</ButtonText>
                    </HStack>
                  </Button>
                </HStack>
              </VStack>
            </Box>
          </KeyboardAwareScrollView>
        </BottomSheetView>
      </BottomSheet>
    </>
  );
};

export default CallNotesModal;
