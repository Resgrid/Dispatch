import { LockIcon } from 'lucide-react-native';
import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';

import { ProtectedRevealBar } from '@/components/data-protection/protected-reveal-bar';
import { HStack } from '@/components/ui/hstack';
import { HomeIcon, MapPinIcon, SettingsIcon } from '@/components/ui/lucide-icons';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { mapsUrls } from '@/lib/contacts/format';
import { logger } from '@/lib/logging';
import { type ContactAddressData, type ContactResultData } from '@/models/v4/contacts/contactResultData';
import { useContactsStore } from '@/stores/contacts/store';

interface ContactDetailsExtraProps {
  contact: ContactResultData & { WithheldFields?: string[] };
  /** Dispatch renders custom fields through its own UDF renderer. */
  showCustomFields?: boolean;
}

const openMaps = async (query: string) => {
  const { app, web } = mapsUrls(query);
  try {
    if (app && (await Linking.canOpenURL(app))) {
      await Linking.openURL(app);
      return;
    }
    await Linking.openURL(web);
  } catch (error) {
    logger.warn({ message: 'Could not open maps for contact address', context: { error } });
  }
};

const AddressRow = ({ label, address }: { label: string; address: ContactAddressData }) => {
  const line = address.Formatted || [address.Address1, address.City, address.State, address.PostalCode, address.Country].filter(Boolean).join(', ');
  if (!line) return null;
  return (
    <Pressable onPress={() => void openMaps(line)} accessibilityRole="link" accessibilityLabel={`${label}, ${line}`} testID="contact-address">
      <HStack space="md" className="items-start py-2">
        <View className="size-6 items-center justify-center">
          <HomeIcon size={16} color="#6366F1" />
        </View>
        <VStack space="xs" className="flex-1">
          <Text className="text-sm text-gray-500 dark:text-gray-400">{label}</Text>
          <Text className="text-base text-primary-600 dark:text-primary-400">{line}</Text>
        </VStack>
      </HStack>
    </Pressable>
  );
};

// What the slim contact list never carried, for every field app's detail sheet: the resolved physical and
// mailing addresses (tap to open in maps), the category, the department's mobile-visible custom fields, and
// — for a protected department — which details were withheld with the reveal that re-reads them.
export const ContactDetailsExtra: React.FC<ContactDetailsExtraProps> = ({ contact, showCustomFields = true }) => {
  const { t } = useTranslation();
  const contactId = contact.ContactId;

  // Opening a contact reads its notes fresh: a cached copy may predate an unlock and still be redacted.
  useEffect(() => {
    void useContactsStore.getState().fetchContactNotes(contactId, true);
  }, [contactId]);

  const refresh = useCallback(async () => {
    const store = useContactsStore.getState();
    await Promise.all([store.fetchContactDetails(contactId), store.fetchContactNotes(contactId, true)]);
  }, [contactId]);

  const withheld = contact.WithheldFields ?? [];
  const category = contact.CategoryName || contact.Category?.Name;
  const customFields = showCustomFields ? (contact.CustomFields ?? []) : [];

  return (
    <VStack space="sm" testID="contact-details-extra">
      {contact.IsProtected || withheld.length > 0 ? (
        <VStack space="xs" className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
          {withheld.length > 0 ? (
            <HStack space="sm" className="items-center">
              <LockIcon size={14} color="#6B7280" />
              <Text className="flex-1 text-sm text-gray-600 dark:text-gray-300">{t('contacts.withheld', { count: withheld.length })}</Text>
            </HStack>
          ) : null}
          <ProtectedRevealBar onRefresh={refresh} testID="contact-reveal" />
        </VStack>
      ) : null}
      {category ? (
        <HStack space="sm" className="items-center">
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: contact.CategoryColor || '#6366F1' }} />
          <Text className="text-sm text-gray-700 dark:text-gray-200">{t('contacts.categoryLabel', { name: category })}</Text>
        </HStack>
      ) : null}
      {contact.PhysicalAddress ? <AddressRow label={t('contacts.physicalAddress')} address={contact.PhysicalAddress} /> : null}
      {contact.MailingAddress ? <AddressRow label={t('contacts.mailingAddress')} address={contact.MailingAddress} /> : null}
      {contact.LocationGeofence ? (
        <HStack space="md" className="items-start py-2">
          <View className="size-6 items-center justify-center">
            <MapPinIcon size={16} color="#6366F1" />
          </View>
          <Text className="flex-1 text-sm text-gray-600 dark:text-gray-300">{t('contacts.hasGeofence')}</Text>
        </HStack>
      ) : null}
      {customFields.length > 0 ? (
        <VStack space="xs" className="border-b border-gray-200 pb-3 dark:border-gray-700" testID="contact-custom-fields">
          <HStack space="sm" className="items-center">
            <SettingsIcon size={16} color="#6366F1" />
            <Text className="font-semibold text-gray-900 dark:text-white">{t('contacts.customFields')}</Text>
          </HStack>
          {customFields.map((field) => (
            <VStack key={field.UdfFieldId} space="xs" className="py-1 pl-6">
              <Text className="text-sm text-gray-500 dark:text-gray-400">{field.GroupName ? `${field.GroupName} · ${field.Label}` : field.Label}</Text>
              <Text className="text-base text-gray-900 dark:text-white">{field.DisplayValue || field.Value}</Text>
            </VStack>
          ))}
        </VStack>
      ) : null}
    </VStack>
  );
};
