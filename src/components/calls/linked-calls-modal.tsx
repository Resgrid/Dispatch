import { LinkIcon, SearchIcon, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { getCalls } from '@/api/calls/calls';
import { Text } from '@/components/ui/text';
import { type CallResultData } from '@/models/v4/calls/callResultData';

interface LinkedCallsModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (call: CallResultData) => void;
  selectedCallId?: string;
  /** A call that cannot be picked: the one being edited, since a call cannot be linked to itself. */
  excludeCallId?: string;
}

export const LinkedCallsModal: React.FC<LinkedCallsModalProps> = ({ isVisible, onClose, onSelect, selectedCallId, excludeCallId }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [calls, setCalls] = useState<CallResultData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isVisible) {
      loadCalls();
    }
  }, [isVisible]);

  const loadCalls = async () => {
    setIsLoading(true);
    try {
      const result = await getCalls();
      setCalls(result?.Data ?? []);
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const linkable = excludeCallId ? calls.filter((c) => c.CallId !== excludeCallId) : calls;
    if (!searchQuery.trim()) return linkable;
    const q = searchQuery.toLowerCase();
    return linkable.filter((c) => c.Name.toLowerCase().includes(q) || c.Number.toLowerCase().includes(q) || c.Nature.toLowerCase().includes(q) || c.Address.toLowerCase().includes(q));
  }, [calls, searchQuery, excludeCallId]);

  const handleSelect = useCallback(
    (call: CallResultData) => {
      onSelect(call);
      onClose();
    },
    [onSelect, onClose]
  );

  if (!isVisible) return null;

  return (
    <Modal visible={isVisible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={StyleSheet.flatten([styles.container, isDark ? styles.containerDark : styles.containerLight])}>
          {/* Header */}
          <View style={StyleSheet.flatten([styles.header, isDark ? styles.headerDark : styles.headerLight])}>
            <View style={styles.headerLeft}>
              <LinkIcon size={20} color={isDark ? '#e5e7eb' : '#111827'} />
              <Text style={StyleSheet.flatten([styles.title, isDark ? styles.titleDark : styles.titleLight])}>{t('calls.linked_calls.title', 'Link to Existing Call')}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel={t('common.close')}>
              <X size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={StyleSheet.flatten([styles.searchContainer, isDark ? styles.searchContainerDark : styles.searchContainerLight])}>
            <SearchIcon size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
            <TextInput
              style={StyleSheet.flatten([styles.searchInput, isDark ? styles.searchInputDark : styles.searchInputLight])}
              placeholder={t('calls.linked_calls.search_placeholder', 'Search calls...')}
              placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Content */}
          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#2563eb" />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.center}>
              <Text style={StyleSheet.flatten([styles.emptyText, isDark ? styles.emptyTextDark : styles.emptyTextLight])}>{t('calls.linked_calls.none', 'No active calls available')}</Text>
            </View>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {filtered.map((call) => {
                const isSelected = call.CallId === selectedCallId;
                return (
                  <TouchableOpacity
                    key={call.CallId}
                    style={StyleSheet.flatten([styles.item, isDark ? styles.itemDark : styles.itemLight, isSelected ? styles.itemSelected : {}])}
                    onPress={() => handleSelect(call)}
                    accessibilityRole="button"
                    accessibilityLabel={call.Name}
                  >
                    <View style={styles.itemRow}>
                      <Text style={StyleSheet.flatten([styles.callNumber, isDark ? styles.callNumberDark : styles.callNumberLight])}>#{call.Number}</Text>
                      {isSelected ? (
                        <View style={styles.selectedBadge}>
                          <Text style={styles.selectedBadgeText}>{t('calls.linked_calls.linked', 'Linked')}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={StyleSheet.flatten([styles.itemName, isDark ? styles.itemNameDark : styles.itemNameLight])}>{call.Name}</Text>
                    {!!call.Nature && (
                      <Text style={StyleSheet.flatten([styles.itemMeta, isDark ? styles.itemMetaDark : styles.itemMetaLight])} numberOfLines={2}>
                        {call.Nature}
                      </Text>
                    )}
                    {!!call.Address && (
                      <Text style={StyleSheet.flatten([styles.itemAddress, isDark ? styles.itemMetaDark : styles.itemMetaLight])} numberOfLines={1}>
                        {call.Address}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  containerDark: { backgroundColor: '#171717' },
  containerLight: { backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerDark: { borderBottomColor: '#262626' },
  headerLight: { borderBottomColor: '#e5e7eb' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '600', marginLeft: 8 },
  titleDark: { color: '#ffffff' },
  titleLight: { color: '#111827' },
  closeBtn: { padding: 4 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchContainerDark: { backgroundColor: '#262626', borderColor: '#404040' },
  searchContainerLight: { backgroundColor: '#f9fafb', borderColor: '#d1d5db' },
  searchInput: { flex: 1, fontSize: 14, marginLeft: 8 },
  searchInputDark: { color: '#ffffff' },
  searchInputLight: { color: '#111827' },
  center: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 14 },
  emptyTextDark: { color: '#9ca3af' },
  emptyTextLight: { color: '#6b7280' },
  list: { paddingHorizontal: 16 },
  item: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  itemDark: { backgroundColor: '#262626', borderColor: '#404040' },
  itemLight: { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
  itemSelected: { borderColor: '#2563eb', borderWidth: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  callNumber: { fontSize: 11, fontWeight: '500' },
  callNumberDark: { color: '#9ca3af' },
  callNumberLight: { color: '#6b7280' },
  itemName: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  itemNameDark: { color: '#ffffff' },
  itemNameLight: { color: '#111827' },
  itemMeta: { fontSize: 12, marginBottom: 2 },
  itemMetaDark: { color: '#9ca3af' },
  itemMetaLight: { color: '#6b7280' },
  itemAddress: { fontSize: 11, fontStyle: 'italic' },
  selectedBadge: { backgroundColor: '#2563eb', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  selectedBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '600' },
});
