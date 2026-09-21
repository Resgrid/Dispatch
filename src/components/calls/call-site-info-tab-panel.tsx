import { BuildingIcon, LockIcon, MapPinIcon, PhoneIcon, ShieldAlertIcon, UserIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView } from 'react-native';

import { ContactFilesList } from '@/components/contacts/contact-files-list';
import { PreplanSummary } from '@/components/contacts/preplan-summary';
import { ProtectedText } from '@/components/data-protection/protected-text';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAnalytics } from '@/hooks/use-analytics';
import { isRedactedValue } from '@/lib/data-protection/redacted';
import { type CallSiteContactData } from '@/models/v4/calls/callSiteInfoResult';
import { useSiteInfoStore } from '@/stores/calls/site-info-store';
import { dataProtectionStore } from '@/stores/data-protection/store';

interface CallSiteInfoTabPanelProps {
  callId: string;
}

interface SiteContactCardProps {
  site: CallSiteContactData;
  callId: string;
}

const SiteContactCard: React.FC<SiteContactCardProps> = ({ site, callId }) => {
  const { t } = useTranslation();
  const nameRedacted = isRedactedValue(site.Name);
  const phoneRedacted = isRedactedValue(site.PhoneNumber);
  const hasAlerts = site.AlertNotes.length > 0 || site.Hazards.some((h) => h.ShouldAlert);

  return (
    <Box className="mb-4 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" testID={`site-contact-${site.ContactId}`}>
      <HStack space="sm" className="items-center border-b border-gray-100 p-3 dark:border-gray-800">
        <Box className="size-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
          {nameRedacted ? <LockIcon size={18} color="#6b7280" /> : site.ContactType === 1 ? <BuildingIcon size={18} color="#6366F1" /> : <UserIcon size={18} color="#6366F1" />}
        </Box>
        <VStack className="flex-1">
          {nameRedacted ? (
            <Text className="text-base font-semibold text-gray-500 dark:text-gray-400">{t('data_protection.protected_value', 'Protected')}</Text>
          ) : (
            <Text className="text-base font-semibold text-gray-900 dark:text-white">{site.Name}</Text>
          )}
          <Text className="text-xs text-gray-500 dark:text-gray-400">{site.CallContactType === 0 ? t('site_info.primary_contact') : t('site_info.additional_contact')}</Text>
        </VStack>
        {hasAlerts ? <ShieldAlertIcon size={20} color="#ef4444" /> : null}
      </HStack>

      <VStack className="p-3">
        {site.PhoneNumber && !phoneRedacted ? (
          <Pressable onPress={() => Linking.openURL(`tel:${site.PhoneNumber}`).catch(() => {})} className="mb-2" testID={`site-contact-phone-${site.ContactId}`}>
            <HStack space="xs" className="items-center">
              <PhoneIcon size={14} color="#6366F1" />
              <Text className="text-sm text-primary-600 dark:text-primary-400">{site.PhoneNumber}</Text>
            </HStack>
          </Pressable>
        ) : null}
        {site.EntranceGpsCoordinates && !isRedactedValue(site.EntranceGpsCoordinates) ? (
          <HStack space="xs" className="mb-2 items-center">
            <MapPinIcon size={14} color="#6b7280" />
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              {t('site_info.entrance')}: {site.EntranceGpsCoordinates}
            </Text>
          </HStack>
        ) : null}

        {site.AlertNotes.length > 0 ? (
          <Box className="mb-3">
            <Text className="mb-1 text-sm font-semibold text-red-700 dark:text-red-300">{t('site_info.alert_notes')}</Text>
            {site.AlertNotes.map((note) => (
              <Box key={note.ContactNoteId} className="mb-1 rounded-md bg-red-50 p-2 dark:bg-red-900/20" testID={`site-alert-note-${note.ContactNoteId}`}>
                {note.NoteType ? <Text className="text-xs font-medium text-red-700 dark:text-red-300">{note.NoteType}</Text> : null}
                <ProtectedText value={note.Note} fieldId="contactnotes.note" className="text-sm text-red-900 dark:text-red-100" />
              </Box>
            ))}
          </Box>
        ) : null}

        <PreplanSummary preplan={site.Preplan} hazards={site.Hazards} testID={`site-preplan-${site.ContactId}`} />

        {site.Attachments.length > 0 ? (
          <Box className="mt-2">
            <Text className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">{t('site_info.files')}</Text>
            <ContactFilesList files={site.Attachments} contextId={callId} />
          </Box>
        ) : null}
      </VStack>
    </Box>
  );
};

/**
 * Site Info tab of the call detail screen (Contacts plan Phase A, decision 3d): every contact linked to
 * the call with its pre-plan, hazards, alert notes and files from one GetCallSiteInfo round trip.
 * Re-fetches whenever the Protected Data Grant changes so a step-up replaces REDACTED values.
 */
export const CallSiteInfoTabPanel: React.FC<CallSiteInfoTabPanelProps> = ({ callId }) => {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const siteInfo = useSiteInfoStore((state) => state.siteInfo);
  const isLoading = useSiteInfoStore((state) => state.isLoading);
  const error = useSiteInfoStore((state) => state.error);
  const fetchSiteInfo = useSiteInfoStore((state) => state.fetchSiteInfo);
  const reset = useSiteInfoStore((state) => state.reset);
  const grantToken = dataProtectionStore((state) => state.grantToken);

  React.useEffect(() => {
    if (callId) {
      fetchSiteInfo(callId);
    }
    return () => {
      reset();
    };
  }, [callId, fetchSiteInfo, reset]);

  const previousGrant = React.useRef(grantToken);
  React.useEffect(() => {
    if (previousGrant.current !== grantToken) {
      previousGrant.current = grantToken;
      if (callId) {
        fetchSiteInfo(callId);
      }
    }
  }, [grantToken, callId, fetchSiteInfo]);

  React.useEffect(() => {
    if (siteInfo) {
      trackEvent('call_site_info_viewed', {
        callId,
        contactCount: siteInfo.Contacts.length,
        preplanCount: siteInfo.Contacts.filter((c) => !!c.Preplan).length,
        hazardCount: siteInfo.Contacts.reduce((sum, c) => sum + c.Hazards.length, 0),
        isProtected: siteInfo.IsProtected,
      });
    }
  }, [siteInfo, callId, trackEvent]);

  if (isLoading && !siteInfo) {
    return (
      <Box className="flex-1 items-center justify-center py-8" testID="site-info-loading">
        <Spinner size="large" className="mb-4" />
        <Text className="text-center text-gray-500 dark:text-gray-400">{t('site_info.loading')}</Text>
      </Box>
    );
  }

  if (error && !siteInfo) {
    return (
      <Box className="flex-1 items-center justify-center py-8" testID="site-info-error">
        <Text className="text-center text-red-600 dark:text-red-400">{t('site_info.load_failed')}</Text>
      </Box>
    );
  }

  if (!siteInfo || siteInfo.Contacts.length === 0) {
    return (
      <Box className="flex-1 items-center justify-center py-8" testID="site-info-empty">
        <VStack space="md" className="items-center">
          <Box className="size-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <BuildingIcon size={32} color="#6b7280" />
          </Box>
          <VStack space="xs" className="items-center">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white">{t('site_info.empty')}</Text>
            <Text className="text-center text-gray-500 dark:text-gray-400">{t('site_info.empty_description')}</Text>
          </VStack>
        </VStack>
      </Box>
    );
  }

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} testID="site-info-panel">
      <Box className="p-4">
        {siteInfo.Contacts.map((site) => (
          <SiteContactCard key={site.ContactId} site={site} callId={callId} />
        ))}
      </Box>
    </ScrollView>
  );
};
