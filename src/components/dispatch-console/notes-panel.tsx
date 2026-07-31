import { AlertTriangle, FileText, Filter, Plus, Search, Send, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { formatDateForDisplay, parseDateISOString, stripHtmlTags } from '@/lib/utils';
import { type CallNoteResultData } from '@/models/v4/callNotes/callNoteResultData';
import { type NoteResultData } from '@/models/v4/notes/noteResultData';
import { selectCardCollapsed, useDashboardViewStore } from '@/stores/dispatch/dashboard-view-store';

import { AnimatedRefreshIcon } from './animated-refresh-icon';
import { PanelHeader } from './panel-header';

interface NotesPanelProps {
  notes: NoteResultData[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectNote?: (noteId: string) => void;
  onNewNote?: () => void;
  // Call filter props
  isCallFilterActive?: boolean;
  callNotes?: CallNoteResultData[];
  onAddCallNote?: (note: string) => void;
  isAddingNote?: boolean;
  /** Flex weight when expanded; collapses to header height so siblings absorb the freed space. */
  flexWeight?: number;
}

const NoteItem: React.FC<{
  note: NoteResultData;
  onPress: () => void;
}> = ({ note, onPress }) => {
  return (
    <Pressable onPress={onPress}>
      <Box className="mb-2 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
        <VStack space="xs">
          <HStack className="items-start justify-between">
            <Text className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-100" numberOfLines={1}>
              {note.Title}
            </Text>
            {note.Category ? (
              <Badge size="sm" className="bg-blue-100 dark:bg-blue-900">
                <Text className="text-xs text-blue-700 dark:text-blue-300">{note.Category}</Text>
              </Badge>
            ) : null}
          </HStack>
          <Text className="text-xs text-gray-600 dark:text-gray-400" numberOfLines={2}>
            {stripHtmlTags(note.Body)}
          </Text>
          <Text className="text-xs text-gray-400">{formatDateForDisplay(parseDateISOString(note.AddedOn), 'MM/dd HH:mm')}</Text>
        </VStack>
      </Box>
    </Pressable>
  );
};

const CallNoteItem: React.FC<{
  note: CallNoteResultData;
}> = ({ note }) => {
  return (
    <Box className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-700 dark:bg-amber-900/30">
      <VStack space="xs">
        <HStack className="items-center justify-between">
          <HStack className="items-center" space="xs">
            <Icon as={AlertTriangle} size="xs" className="text-amber-600 dark:text-amber-400" />
            <Text className="text-xs font-semibold text-amber-700 dark:text-amber-300">{note.FullName || 'Unknown'}</Text>
          </HStack>
          <Text className="text-xs text-amber-600 dark:text-amber-400">{note.TimestampFormatted || formatDateForDisplay(parseDateISOString(note.Timestamp), 'MM/dd HH:mm')}</Text>
        </HStack>
        <Text className="text-sm text-gray-700 dark:text-gray-200">{note.Note}</Text>
      </VStack>
    </Box>
  );
};

export const NotesPanel: React.FC<NotesPanelProps> = ({ notes, isLoading, onRefresh, onSelectNote, onNewNote, isCallFilterActive, callNotes, onAddCallNote, isAddingNote, flexWeight }) => {
  const { t } = useTranslation();
  const isCollapsed = useDashboardViewStore(selectCardCollapsed('notes'));
  const setCardCollapsed = useDashboardViewStore((s) => s.setCardCollapsed);
  const [newNoteText, setNewNoteText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleAddNote = () => {
    if (newNoteText.trim() && onAddCallNote) {
      onAddCallNote(newNoteText.trim());
      setNewNoteText('');
    }
  };

  // Determine which notes to display and apply search filter
  const displayNotes = isCallFilterActive && callNotes;

  // Filter notes based on search query
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const query = searchQuery.toLowerCase().trim();
    return notes.filter((n) => {
      const title = (n.Title || '').toLowerCase();
      const body = (stripHtmlTags(n.Body) || '').toLowerCase();
      const category = (n.Category || '').toLowerCase();
      return title.includes(query) || body.includes(query) || category.includes(query);
    });
  }, [notes, searchQuery]);

  const filteredCallNotes = useMemo(() => {
    if (!callNotes || !searchQuery.trim()) return callNotes;
    const query = searchQuery.toLowerCase().trim();
    return callNotes.filter((n) => {
      const note = (n.Note || '').toLowerCase();
      const fullName = (n.FullName || '').toLowerCase();
      return note.includes(query) || fullName.includes(query);
    });
  }, [callNotes, searchQuery]);

  const notesCount = displayNotes ? filteredCallNotes?.length || 0 : filteredNotes.length;

  return (
    <Box
      className={`overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 ${isCollapsed ? '' : 'flex-1'}`}
      style={!isCollapsed && flexWeight !== undefined ? { flex: flexWeight } : undefined}
    >
      <PanelHeader
        title={isCallFilterActive ? t('dispatch.call_notes') : t('dispatch.notes')}
        icon={FileText}
        iconColor={isCallFilterActive ? '#f59e0b' : '#f59e0b'}
        count={notesCount}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setCardCollapsed('notes', !isCollapsed)}
        rightContent={
          <HStack space="xs">
            {isCallFilterActive ? (
              <Badge size="sm" className="bg-indigo-100 dark:bg-indigo-900">
                <HStack className="items-center" space="xs">
                  <Icon as={Filter} size="xs" className="text-indigo-600 dark:text-indigo-300" />
                  <Text className="text-xs font-medium text-indigo-700 dark:text-indigo-300">{t('dispatch.filtered')}</Text>
                </HStack>
              </Badge>
            ) : null}
            <Pressable onPress={onRefresh} style={styles.iconButton}>
              <AnimatedRefreshIcon isLoading={isLoading} />
            </Pressable>
            {!isCallFilterActive && onNewNote ? (
              <Pressable onPress={onNewNote} style={styles.iconButton}>
                <Icon as={Plus} size="xs" className="text-indigo-500" />
              </Pressable>
            ) : null}
          </HStack>
        }
      />

      {!isCollapsed ? (
        <VStack className="flex-1">
          {/* Search Input */}
          <HStack className="items-center border-b border-gray-200 px-2 py-1.5 dark:border-gray-700" space="sm">
            <Icon as={Search} size="xs" className="text-gray-400" />
            <TextInput
              style={styles.searchInput}
              className="flex-1 text-sm text-gray-800 dark:text-gray-100"
              placeholder={t('dispatch.search_notes_placeholder')}
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Icon as={X} size="xs" className="text-gray-400" />
              </Pressable>
            ) : null}
          </HStack>
          {/* Add note input for call notes */}
          {isCallFilterActive && onAddCallNote ? (
            <HStack className="border-b border-gray-200 p-2 dark:border-gray-700" space="sm">
              <TextInput
                style={styles.noteInput}
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                placeholder={t('dispatch.add_call_note_placeholder')}
                placeholderTextColor="#9ca3af"
                value={newNoteText}
                onChangeText={setNewNoteText}
                multiline
                maxLength={500}
                editable={!isAddingNote}
              />
              <Pressable onPress={handleAddNote} disabled={!newNoteText.trim() || isAddingNote} style={StyleSheet.flatten([styles.sendButton, (!newNoteText.trim() || isAddingNote) && styles.sendButtonDisabled])}>
                <Icon as={Send} size="sm" className={newNoteText.trim() && !isAddingNote ? 'text-indigo-500' : 'text-gray-400'} />
              </Pressable>
            </HStack>
          ) : null}

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {displayNotes ? (
              // Show call notes
              filteredCallNotes && filteredCallNotes.length > 0 ? (
                filteredCallNotes.map((note) => <CallNoteItem key={note.CallNoteId} note={note} />)
              ) : (
                <View style={styles.emptyState}>
                  <Icon as={FileText} size="lg" className="text-gray-300 dark:text-gray-600" />
                  <Text className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">{t('dispatch.no_call_notes')}</Text>
                </View>
              )
            ) : // Show general notes
            filteredNotes.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon as={FileText} size="lg" className="text-gray-300 dark:text-gray-600" />
                <Text className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">{t('dispatch.no_notes')}</Text>
              </View>
            ) : (
              filteredNotes.slice(0, 10).map((note) => <NoteItem key={note.NoteId} note={note} onPress={() => onSelectNote?.(note.NoteId)} />)
            )}
          </ScrollView>
        </VStack>
      ) : null}
    </Box>
  );
};

const styles = StyleSheet.create({
  searchInput: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  content: {
    flex: 1,
    padding: 8,
    maxHeight: 250,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  iconButton: {
    padding: 4,
  },
  noteInput: {
    minHeight: 36,
    maxHeight: 80,
  },
  sendButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
