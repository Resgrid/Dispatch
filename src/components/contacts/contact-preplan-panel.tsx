import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { PreplanSummary } from '@/components/contacts/preplan-summary';
import { Box } from '@/components/ui/box';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { useContactPreplanStore } from '@/stores/contacts/preplan-store';
import { dataProtectionStore } from '@/stores/data-protection/store';

interface ContactPreplanPanelProps {
  contactId: string;
}

/**
 * Pre-Plan tab of the contact details sheet (Contacts plan Phase A). Fetches once per contact and again
 * whenever the Protected Data Grant changes, so a step-up replaces REDACTED values in place.
 */
export const ContactPreplanPanel: React.FC<ContactPreplanPanelProps> = ({ contactId }) => {
  const { t } = useTranslation();
  const preplans = useContactPreplanStore((state) => state.preplans);
  const loadingPreplan = useContactPreplanStore((state) => state.loadingPreplan);
  const fetchPreplan = useContactPreplanStore((state) => state.fetchPreplan);
  const grantToken = dataProtectionStore((state) => state.grantToken);

  React.useEffect(() => {
    if (contactId) {
      fetchPreplan(contactId);
    }
  }, [contactId, fetchPreplan]);

  // A new grant (or its loss) changes what the server will decrypt: refetch, do not reuse the cache.
  const previousGrant = React.useRef(grantToken);
  React.useEffect(() => {
    if (previousGrant.current !== grantToken) {
      previousGrant.current = grantToken;
      if (contactId) {
        fetchPreplan(contactId, true);
      }
    }
  }, [grantToken, contactId, fetchPreplan]);

  const isLoading = !!loadingPreplan[contactId];
  const hasFetched = Object.prototype.hasOwnProperty.call(preplans, contactId);

  if (isLoading && !hasFetched) {
    return (
      <Box className="flex-1 items-center justify-center py-8" testID="contact-preplan-loading">
        <Spinner size="large" className="mb-4" />
        <Text className="text-center text-gray-500 dark:text-gray-400">{t('contacts.preplan.loading')}</Text>
      </Box>
    );
  }

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} testID="contact-preplan-panel">
      <Box className="p-4">
        <PreplanSummary preplan={preplans[contactId]} />
      </Box>
    </ScrollView>
  );
};
