import { useColorScheme } from 'nativewind';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import WebView from 'react-native-webview';

import { Calendar, Tag, X } from '@/components/ui/lucide-icons';
import { useAnalytics } from '@/hooks/use-analytics';
import { formatDateForDisplay, parseDateISOString } from '@/lib/utils';
import { useNotesStore } from '@/stores/notes/store';
import { sanitizeHtmlContent } from '@/utils/html-sanitizer';

import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '../ui/actionsheet';
import { Box } from '../ui/box';
import { Button } from '../ui/button';
import { Divider } from '../ui/divider';
import { Heading } from '../ui/heading';
import { HStack } from '../ui/hstack';
import { Text } from '../ui/text';
import { VStack } from '../ui/vstack';

export const NoteDetailsSheet: React.FC = () => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { trackEvent } = useAnalytics();
  const { notes, selectedNoteId, isDetailsOpen, closeDetails, deleteNote } = useNotesStore();

  const selectedNote = notes.find((note) => note.NoteId === selectedNoteId);

  // Track when note details sheet is opened/rendered
  useEffect(() => {
    if (isDetailsOpen && selectedNote) {
      trackEvent('note_details_sheet_opened', {
        noteId: selectedNote.NoteId,
        hasCategory: !!selectedNote.Category,
        hasBody: !!selectedNote.Body,
        bodyLength: selectedNote.Body?.length || 0,
        hasAddedDate: !!selectedNote.AddedOn,
      });
    }
  }, [isDetailsOpen, selectedNote, trackEvent]);

  if (!selectedNote) return null;

  const textColor = colorScheme === 'dark' ? '#E5E7EB' : '#1F2937'; // gray-200 : gray-800

  return (
    <Actionsheet isOpen={isDetailsOpen} onClose={closeDetails} snapPoints={[67]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="w-full rounded-t-xl bg-white dark:bg-gray-800">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <Box className="w-full flex-1 p-4">
          <HStack className="mb-4 items-center justify-between">
            <Heading size="lg" className="text-gray-800 dark:text-gray-100">
              {selectedNote.Title}
            </Heading>
            <Button variant="link" onPress={closeDetails} className="p-1">
              <X size={24} className="text-gray-600 dark:text-gray-400" />
            </Button>
          </HStack>

          <VStack space="md" className="flex-1">
            {/* Note content in WebView */}
            <Box className="w-full flex-1 rounded-lg bg-gray-50 p-1 dark:bg-gray-700">
              <WebView
                style={[styles.container, { height: 120 }]}
                originWhitelist={['*']}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                source={{
                  html: `
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
                        <style>
                          body {
                            color: ${textColor};
                            font-family: system-ui, -apple-system, sans-serif;
                            margin: 0;
                            padding: 8px;
                            font-size: 16px;
                            line-height: 1.5;
                            background-color: ${colorScheme === 'dark' ? '#374151' : '#F9FAFB'};
                          }
                          * {
                            max-width: 100%;
                          }
                        </style>
                      </head>
                      <body>${sanitizeHtmlContent(selectedNote.Body ?? '')}</body>
                    </html>
                  `,
                }}
                androidLayerType="software"
              />
            </Box>

            <Divider />

            {/* Category */}
            {selectedNote.Category && (
              <HStack space="xs" className="items-center">
                <Tag size={18} className="text-gray-600 dark:text-gray-400" />
                <Text className="text-gray-700 dark:text-gray-300">{selectedNote.Category}</Text>
              </HStack>
            )}

            {/* Date information */}
            <VStack space="xs">
              {selectedNote.AddedOn && (
                <HStack space="xs" className="items-center">
                  <Calendar size={18} className="text-gray-600 dark:text-gray-400" />
                  <Text className="text-sm text-gray-600 dark:text-gray-400">{formatDateForDisplay(parseDateISOString(selectedNote.AddedOn), 'yyyy-MM-dd HH:mm Z')}</Text>
                </HStack>
              )}
            </VStack>

            {/* Action buttons 
            <HStack className="mt-4 justify-between">
              <Button
                variant="outline"
                className="mr-2 flex-1 border-red-500"
                onPress={() => {
                  deleteNote(selectedNote.NoteId);
                  closeDetails();
                }}
              >
                <Icon as={Trash2} size="sm" color="danger" />
                <ButtonText className="ml-1 text-red-500">{t('notes.details.delete')}</ButtonText>
              </Button>

              <Button
                className="ml-2 flex-1 bg-blue-500"
                onPress={() => {
                  // Edit functionality would go here
                  closeDetails();
                }}
              >
                <Icon as={Pencil} size="sm" color="white" />
                <ButtonText className="ml-1 text-white">{t('notes.details.edit')}</ButtonText>
              </Button>
            </HStack>*/}
          </VStack>
        </Box>
      </ActionsheetContent>
    </Actionsheet>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'transparent',
  },
});
