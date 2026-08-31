import { ContactIcon, Search, X } from 'lucide-react-native';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl } from 'react-native';

import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { ContactCard } from '@/components/contacts/contact-card';
import { ContactDetailsSheet } from '@/components/contacts/contact-details-sheet';
import { ProtectedRevealBar } from '@/components/data-protection/protected-reveal-bar';
import { FocusAwareStatusBar } from '@/components/ui';
import { Box } from '@/components/ui/box';
import { FlatList } from '@/components/ui/flat-list';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { View } from '@/components/ui/view';
import { useAnalytics } from '@/hooks/use-analytics';
import { useContactsStore } from '@/stores/contacts/store';

export default function Contacts() {
  const { t } = useTranslation();
  const { contacts, searchQuery, setSearchQuery, selectContact, isLoading, fetchContacts } = useContactsStore();
  const { trackEvent } = useAnalytics();
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Track when contacts view is rendered
  React.useEffect(() => {
    trackEvent('contacts_view_rendered', {
      contactsCount: contacts.length,
      hasSearchQuery: searchQuery.length > 0,
    });
  }, [trackEvent, contacts.length, searchQuery]);

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchContacts(true); // Force refresh to bypass cache
    } finally {
      setRefreshing(false);
    }
  }, [fetchContacts]);

  const filteredContacts = React.useMemo(() => {
    if (!searchQuery.trim()) return contacts;

    const query = searchQuery.toLowerCase();
    return contacts.filter(
      (contact) =>
        (contact.FirstName?.toLowerCase().includes(query) ?? false) ||
        (contact.LastName?.toLowerCase().includes(query) ?? false) ||
        (contact.Email?.toLowerCase().includes(query) ?? false) ||
        (contact.CompanyName?.toLowerCase().includes(query) ?? false) ||
        (contact.OtherName?.toLowerCase().includes(query) ?? false)
    );
  }, [contacts, searchQuery]);

  // Show loading page during initial fetch (when no contacts are loaded yet)
  if (isLoading && contacts.length === 0) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-gray-900">
        <Loading />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      <FocusAwareStatusBar />
      <Box className="flex-1 px-4 pt-4">
        {/*
          Contacts are heavily cataloged - names, phone numbers, email, government identifiers and
          location. They arrive REDACTED and only come back decrypted on a request carrying a grant,
          so revealing has to re-read the list. Renders nothing without the addon.
        */}
        <ProtectedRevealBar onRefresh={() => fetchContacts(true)} />

        <Input className="mb-4 rounded-lg bg-white dark:bg-gray-800" size="md" variant="outline">
          <InputSlot className="pl-3">
            <InputIcon as={Search} />
          </InputSlot>
          <InputField placeholder={t('contacts.search')} value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery ? (
            <InputSlot className="pr-3" onPress={() => setSearchQuery('')} testID="clear-search-button">
              <InputIcon as={X} />
            </InputSlot>
          ) : null}
        </Input>

        {filteredContacts.length > 0 ? (
          <FlatList
            testID="contacts-list"
            data={filteredContacts}
            keyExtractor={(item) => item.ContactId}
            renderItem={({ item }) => <ContactCard contact={item} onPress={selectContact} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          />
        ) : (
          <ZeroState icon={ContactIcon} heading={t('contacts.empty')} description={t('contacts.emptyDescription')} />
        )}
      </Box>

      <ContactDetailsSheet />
    </View>
  );
}
