import { router } from 'expo-router';
import { ChevronDownIcon, ChevronUpIcon, HistoryIcon, InfoIcon, MapPinIcon } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { ProtectedText } from '@/components/data-protection/protected-text';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAnalytics } from '@/hooks/use-analytics';
import { ProtectedFieldIds } from '@/lib/data-protection/redacted';
import { formatDateForDisplay, parseDateISOString } from '@/lib/utils';
import { type LocationHistoryCallData, type LocationHistoryMatch } from '@/models/v4/calls/locationHistoryResult';
import { locationHistoryKey, type LocationHistorySource, useLocationHistoryStore } from '@/stores/calls/location-history-store';
import { dataProtectionStore } from '@/stores/data-protection/store';

interface LocationHistoryPanelProps {
  source: LocationHistorySource;
  /** Opens a call; defaults to the call detail route. The contact sheet closes itself first. */
  onOpenCall?: (callId: string) => void;
}

const MATCH_STYLES: Record<LocationHistoryMatch, { box: string; text: string; key: string }> = {
  SameAddress: { box: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-800 dark:text-blue-200', key: 'location_history.match.same_address' },
  SimilarAddress: { box: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-800 dark:text-amber-200', key: 'location_history.match.similar_address' },
  Nearby: { box: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-800 dark:text-sky-200', key: 'location_history.match.nearby' },
  SameContact: { box: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-800 dark:text-green-200', key: 'location_history.match.same_contact' },
};

const formatTimestamp = (value?: string | null): string => {
  if (!value) {
    return '';
  }
  try {
    return formatDateForDisplay(parseDateISOString(value), 'yyyy-MM-dd HH:mm');
  } catch {
    return '';
  }
};

interface HistoryCallCardProps {
  call: LocationHistoryCallData;
  onOpenCall: (callId: string) => void;
}

const HistoryCallCard: React.FC<HistoryCallCardProps> = ({ call, onOpenCall }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const hasNotes = call.Notes.length > 0 || !!call.CompletedNotes;
  const loggedOn = call.LoggedOn || formatTimestamp(call.LoggedOnUtc);

  return (
    <Box className="mb-3 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" testID={`location-history-call-${call.CallId}`}>
      <Pressable onPress={() => onOpenCall(call.CallId)} className="p-3" testID={`location-history-open-${call.CallId}`}>
        <HStack space="sm" className="items-start">
          <VStack className="flex-1">
            <HStack space="xs" className="flex-wrap items-center">
              <Text className="text-sm font-semibold text-primary-600 dark:text-primary-400">{call.Number}</Text>
              <Box className="rounded px-1.5 py-0.5" style={{ backgroundColor: call.PriorityColor || '#6b7280' }}>
                <Text className="text-xs font-medium text-white">{call.PriorityText || t('location_history.unknown_priority')}</Text>
              </Box>
              <Text className={`text-xs ${call.State === 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>{t(`location_history.state.${call.State}`, String(call.State))}</Text>
            </HStack>
            <ProtectedText value={call.Name} fieldId={ProtectedFieldIds.callName} className="mt-1 text-base font-medium text-gray-900 dark:text-white" />
            {call.Nature ? <ProtectedText value={call.Nature} fieldId={ProtectedFieldIds.callNature} size="sm" className="text-sm text-gray-600 dark:text-gray-300" /> : null}
          </VStack>
          <Text className="text-xs text-gray-500 dark:text-gray-400">{loggedOn}</Text>
        </HStack>

        {call.Address ? (
          <HStack space="xs" className="mt-2 items-center">
            <MapPinIcon size={14} color="#6b7280" />
            <ProtectedText value={call.Address} fieldId={ProtectedFieldIds.callAddress} size="sm" className="flex-1 text-sm text-gray-700 dark:text-gray-300" />
            {call.DistanceMeters != null && call.DistanceMeters >= 1 ? (
              <Text className="text-xs text-gray-500 dark:text-gray-400">{t('location_history.meters_away', { distance: Math.round(call.DistanceMeters) })}</Text>
            ) : null}
          </HStack>
        ) : null}

        {call.Matches.length > 0 ? (
          <HStack space="xs" className="mt-2 flex-wrap">
            {call.Matches.map((match) => {
              const style = MATCH_STYLES[match];
              return style ? (
                <Box key={match} className={`mb-1 rounded px-2 py-0.5 ${style.box}`} testID={`location-history-match-${call.CallId}-${match}`}>
                  <Text className={`text-xs font-medium ${style.text}`}>{t(style.key)}</Text>
                </Box>
              ) : null;
            })}
          </HStack>
        ) : null}
      </Pressable>

      {hasNotes ? (
        <Box className="border-t border-gray-100 dark:border-gray-800">
          <Pressable onPress={() => setExpanded((value) => !value)} className="px-3 py-2" testID={`location-history-notes-toggle-${call.CallId}`}>
            <HStack space="xs" className="items-center">
              {expanded ? <ChevronUpIcon size={16} color="#6366F1" /> : <ChevronDownIcon size={16} color="#6366F1" />}
              <Text className="text-sm text-primary-600 dark:text-primary-400">{expanded ? t('location_history.hide_notes') : t('location_history.show_notes', { count: call.Notes.length })}</Text>
            </HStack>
          </Pressable>
          {expanded ? (
            <VStack space="sm" className="px-3 pb-3" testID={`location-history-notes-${call.CallId}`}>
              {call.CompletedNotes ? (
                <Box className="rounded-md bg-amber-50 p-2 dark:bg-amber-900/20">
                  <Text className="mb-1 text-xs font-semibold text-amber-800 dark:text-amber-200">{t('location_history.closing_notes')}</Text>
                  <ProtectedText value={call.CompletedNotes} fieldId="calls.completednotes" size="sm" className="text-sm text-gray-800 dark:text-gray-200" />
                </Box>
              ) : null}
              {call.Notes.map((note) => (
                <Box key={note.CallNoteId} className="rounded-md bg-gray-50 p-2 dark:bg-gray-800">
                  <Text className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTimestamp(note.TimestampUtc)} · {note.FullName || t('location_history.unknown_user')}
                  </Text>
                  <ProtectedText value={note.Note} fieldId={ProtectedFieldIds.callNote} size="sm" className="text-sm text-gray-800 dark:text-gray-200" />
                </Box>
              ))}
            </VStack>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
};

/**
 * Previous calls at a location: on the call detail screen, other calls at the same address (however it was typed), nearby
 * calls without a street address and calls with the same contacts; on the contact sheet, calls linked to the contact and
 * calls at every occupancy it is linked to. Newest first, with notes and closing notes so a crew sees what happened before.
 * Re-fetches when the Protected Data Grant changes so a step-up replaces REDACTED values.
 */
export const LocationHistoryPanel: React.FC<LocationHistoryPanelProps> = ({ source, onOpenCall }) => {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const key = locationHistoryKey(source);
  const entry = useLocationHistoryStore((state) => state.entries[key]);
  const fetchHistory = useLocationHistoryStore((state) => state.fetchHistory);
  const clear = useLocationHistoryStore((state) => state.clear);
  const grantToken = dataProtectionStore((state) => state.grantToken);
  const { kind, id } = source;

  React.useEffect(() => {
    if (id) {
      fetchHistory({ kind, id });
    }
    return () => {
      clear({ kind, id });
    };
  }, [kind, id, fetchHistory, clear]);

  const previousGrant = React.useRef(grantToken);
  React.useEffect(() => {
    if (previousGrant.current !== grantToken) {
      previousGrant.current = grantToken;
      if (id) {
        fetchHistory({ kind, id });
      }
    }
  }, [grantToken, kind, id, fetchHistory]);

  const history = entry?.history ?? null;
  React.useEffect(() => {
    if (history) {
      trackEvent('location_history_viewed', {
        kind,
        id,
        callCount: history.Calls.length,
        addressMatchingAvailable: history.AddressMatchingAvailable,
        isProtected: history.IsProtected,
      });
    }
  }, [history, kind, id, trackEvent]);

  const openCall = useCallback(
    (callId: string) => {
      if (onOpenCall) {
        onOpenCall(callId);
      } else {
        router.push(`/call/${callId}`);
      }
    },
    [onOpenCall]
  );

  if (entry?.isLoading && !history) {
    return (
      <Box className="flex-1 items-center justify-center py-8" testID="location-history-loading">
        <Spinner size="large" className="mb-4" />
        <Text className="text-center text-gray-500 dark:text-gray-400">{t('location_history.loading')}</Text>
      </Box>
    );
  }

  if (entry?.error && !history) {
    return (
      <Box className="flex-1 items-center justify-center py-8" testID="location-history-error">
        <Text className="text-center text-red-600 dark:text-red-400">{t('location_history.load_failed')}</Text>
      </Box>
    );
  }

  const calls = history?.Calls ?? [];

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} testID="location-history-panel">
      <Box className="p-4">
        <Text className="text-base font-semibold text-gray-900 dark:text-white">{kind === 'call' ? t('location_history.header_call') : t('location_history.header_contact')}</Text>
        <Text className="mb-3 text-xs text-gray-500 dark:text-gray-400">{kind === 'call' ? t('location_history.help_call') : t('location_history.help_contact')}</Text>

        {history && !history.AddressMatchingAvailable ? (
          <HStack space="xs" className="mb-3 items-start rounded-md bg-blue-50 p-2 dark:bg-blue-900/20" testID="location-history-address-matching-off">
            <InfoIcon size={14} color="#2563eb" />
            <Text className="flex-1 text-xs text-blue-800 dark:text-blue-200">{t('location_history.address_matching_off')}</Text>
          </HStack>
        ) : null}
        {history && history.AddressMatchingAvailable && !history.IndexComplete ? <Text className="mb-2 text-xs text-gray-500 dark:text-gray-400">{t('location_history.index_incomplete')}</Text> : null}
        {history?.InterpretedAddress ? (
          <Text className="mb-3 text-xs text-gray-500 dark:text-gray-400" testID="location-history-interpreted">
            {t('location_history.matched_as', { address: history.InterpretedAddress })}
          </Text>
        ) : null}

        {calls.length === 0 ? (
          <VStack space="md" className="items-center py-6" testID="location-history-empty">
            <Box className="size-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <HistoryIcon size={32} color="#6b7280" />
            </Box>
            <VStack space="xs" className="items-center">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white">{t('location_history.empty')}</Text>
              <Text className="text-center text-gray-500 dark:text-gray-400">{t('location_history.empty_description')}</Text>
            </VStack>
          </VStack>
        ) : (
          calls.map((call) => <HistoryCallCard key={call.CallId} call={call} onOpenCall={openCall} />)
        )}

        {history?.HasMore ? <Text className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">{t('location_history.has_more')}</Text> : null}
      </Box>
    </ScrollView>
  );
};
