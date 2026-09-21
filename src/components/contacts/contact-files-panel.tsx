import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { ContactFilesList } from '@/components/contacts/contact-files-list';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useContactPreplanStore } from '@/stores/contacts/preplan-store';
import { dataProtectionStore } from '@/stores/data-protection/store';

interface ContactFilesPanelProps {
  contactId: string;
}

/**
 * Files tab of the contact details sheet (Contacts plan Phase A): site documents, pre-plans, floor plans,
 * photos and drawings. Fetches once per contact and again when the Protected Data Grant changes.
 */
export const ContactFilesPanel: React.FC<ContactFilesPanelProps> = ({ contactId }) => {
  const { t } = useTranslation();
  const files = useContactPreplanStore((state) => state.files);
  const loadingFiles = useContactPreplanStore((state) => state.loadingFiles);
  const fileErrors = useContactPreplanStore((state) => state.fileErrors);
  const fetchFiles = useContactPreplanStore((state) => state.fetchFiles);
  const grantToken = dataProtectionStore((state) => state.grantToken);

  React.useEffect(() => {
    if (contactId) {
      fetchFiles(contactId);
    }
  }, [contactId, fetchFiles]);

  const previousGrant = React.useRef(grantToken);
  React.useEffect(() => {
    if (previousGrant.current !== grantToken) {
      previousGrant.current = grantToken;
      if (contactId) {
        fetchFiles(contactId, true);
      }
    }
  }, [grantToken, contactId, fetchFiles]);

  const hasFetched = Object.prototype.hasOwnProperty.call(files, contactId);
  const isLoading = !!loadingFiles[contactId];
  const loadFailed = !!fileErrors[contactId];

  const handleRetry = React.useCallback(() => {
    fetchFiles(contactId, true);
  }, [contactId, fetchFiles]);

  // A failed read is not "no files": the list may well exist, so say it could not be loaded.
  if (loadFailed && !hasFetched && !isLoading) {
    return (
      <Box className="flex-1 items-center justify-center py-8" testID="contact-files-error">
        <Text className="mb-4 text-center text-gray-500 dark:text-gray-400" accessibilityRole="alert">
          {t('contacts.files.load_failed')}
        </Text>
        <Button variant="outline" size="sm" onPress={handleRetry} testID="contact-files-retry">
          <ButtonText>{t('common.retry')}</ButtonText>
        </Button>
      </Box>
    );
  }

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} testID="contact-files-panel">
      <ContactFilesList files={files[contactId] ?? []} isLoading={isLoading && !hasFetched} contextId={contactId} />
    </ScrollView>
  );
};
