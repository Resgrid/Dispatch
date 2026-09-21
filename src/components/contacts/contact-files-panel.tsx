import React from 'react';
import { ScrollView } from 'react-native';

import { ContactFilesList } from '@/components/contacts/contact-files-list';
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
  const files = useContactPreplanStore((state) => state.files);
  const loadingFiles = useContactPreplanStore((state) => state.loadingFiles);
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

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} testID="contact-files-panel">
      <ContactFilesList files={files[contactId] ?? []} isLoading={!!loadingFiles[contactId] && !hasFetched} contextId={contactId} />
    </ScrollView>
  );
};
