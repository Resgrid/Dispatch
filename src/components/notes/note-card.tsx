import React from 'react';
import { Pressable } from 'react-native';

import { formatDateForDisplay, parseDateISOString, stripHtmlTags } from '@/lib/utils';
import { type NoteResultData } from '@/models/v4/notes/noteResultData';

import { Badge } from '../ui/badge';
import { Box } from '../ui/box';
import { HStack } from '../ui/hstack';
import { Text } from '../ui/text';
import { VStack } from '../ui/vstack';
interface NoteCardProps {
  note: NoteResultData;
  onPress: (id: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onPress }) => {
  return (
    <Pressable onPress={() => onPress(note.NoteId)}>
      <Box className="mb-3 rounded-lg bg-white p-4 shadow-xs dark:bg-gray-800">
        <VStack space="xs">
          <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100">{note.Title}</Text>
          <Text className="text-sm text-gray-600 dark:text-gray-300" numberOfLines={2}>
            {stripHtmlTags(note.Body)}
          </Text>
          {note.Category && (
            <HStack className="mt-2 flex-wrap">
              <Badge className="mb-1 mr-1 bg-blue-100 dark:bg-blue-900">
                <Text className="text-xs text-blue-800 dark:text-blue-100">{note.Category}</Text>
              </Badge>
            </HStack>
          )}
          <Text className="mt-2 text-xs text-gray-500 dark:text-gray-400">{formatDateForDisplay(parseDateISOString(note.AddedOn), 'yyyy-MM-dd HH:mm Z')}</Text>
        </VStack>
      </Box>
    </Pressable>
  );
};
