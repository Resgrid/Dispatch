import {
  BuildingIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Edit2Icon,
  GlobeIcon,
  HomeIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  SettingsIcon,
  SmartphoneIcon,
  StarIcon,
  TrashIcon,
  UserIcon,
  X,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { UdfFieldsRenderer } from '@/components/calls/udf-fields-renderer';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { useAnalytics } from '@/hooks/use-analytics';
import { ContactType } from '@/models/v4/contacts/contactResultData';
import { useContactsStore } from '@/stores/contacts/store';

import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '../ui/actionsheet';
import { Box } from '../ui/box';
import { Button, ButtonText } from '../ui/button';
import { HStack } from '../ui/hstack';
import { Pressable } from '../ui/pressable';
import { Text } from '../ui/text';
import { VStack } from '../ui/vstack';
import { ContactNotesList } from './contact-notes-list';

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
}

const Section: React.FC<SectionProps> = ({ title, icon, children, isCollapsible = true, defaultExpanded = true }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <VStack space="md" className="border-b border-gray-200 pb-4 dark:border-gray-700">
      <Pressable onPress={isCollapsible ? () => setIsExpanded(!isExpanded) : undefined} className="flex-row items-center justify-between" disabled={!isCollapsible}>
        <HStack space="sm" className="items-center">
          <View className="size-8 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">{icon}</View>
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">{title}</Text>
        </HStack>
        {isCollapsible ? isExpanded ? <ChevronDownIcon size={20} color="#6366F1" /> : <ChevronRightIcon size={20} color="#6366F1" /> : null}
      </Pressable>
      {isExpanded ? <Box className="ml-10">{children}</Box> : null}
    </VStack>
  );
};

interface ContactFieldProps {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
  isLink?: boolean;
  linkPrefix?: string;
}

const ContactField: React.FC<ContactFieldProps> = ({ label, value, icon, isLink, linkPrefix }) => {
  if (!value || value.toString().trim() === '') return null;

  const displayValue = isLink && linkPrefix ? `${linkPrefix}${value}` : value.toString();

  return (
    <HStack space="md" className="items-start py-2">
      {icon ? <View className="size-6 items-center justify-center">{icon}</View> : null}
      <VStack space="xs" className="flex-1">
        <Text className="text-sm text-gray-500 dark:text-gray-400">{label}</Text>
        <Text className="text-base text-gray-900 dark:text-white">{displayValue}</Text>
      </VStack>
    </HStack>
  );
};

export const ContactDetailsSheet: React.FC = () => {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { contacts, selectedContactId, isDetailsOpen, closeDetails } = useContactsStore();
  const [activeTab, setActiveTab] = useState<'details' | 'notes'>('details');

  const selectedContact = React.useMemo(() => {
    if (!selectedContactId) return null;
    return contacts.find((contact) => contact.ContactId === selectedContactId);
  }, [contacts, selectedContactId]);

  // Track when contact details sheet is opened/rendered
  React.useEffect(() => {
    if (isDetailsOpen && selectedContact) {
      trackEvent('contact_details_sheet_opened', {
        contactId: selectedContact.ContactId,
        contactType: selectedContact.ContactType === ContactType.Person ? 'person' : 'company',
        hasImage: !!selectedContact.ImageUrl,
        isImportant: !!selectedContact.IsImportant,
        hasCategory: !!selectedContact.Category?.Name,
        hasEmail: !!selectedContact.Email,
        hasPhone: !!(selectedContact.Phone || selectedContact.Mobile || selectedContact.HomePhoneNumber || selectedContact.CellPhoneNumber || selectedContact.OfficePhoneNumber),
        hasAddress: !!(selectedContact.Address || selectedContact.City || selectedContact.State || selectedContact.Zip),
        hasNotes: !!selectedContact.Notes,
        activeTab: activeTab,
      });
    }
  }, [isDetailsOpen, selectedContact, trackEvent, activeTab]);

  const handleDelete = async () => {
    if (selectedContactId) {
      //await removeContact(selectedContactId);
      closeDetails();
    }
  };

  if (!selectedContact) return null;

  const getDisplayName = () => {
    if (selectedContact.ContactType === ContactType.Person) {
      const firstName = selectedContact.FirstName?.trim() || '';
      const middleName = selectedContact.MiddleName?.trim() || '';
      const lastName = selectedContact.LastName?.trim() || '';
      const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
      return fullName || selectedContact.Name || 'Unknown Person';
    } else {
      return selectedContact.CompanyName?.trim() || selectedContact.Name || 'Unknown Company';
    }
  };

  const displayName = getDisplayName();

  const hasContactInfo =
    selectedContact.Email || selectedContact.Phone || selectedContact.Mobile || selectedContact.HomePhoneNumber || selectedContact.CellPhoneNumber || selectedContact.OfficePhoneNumber || selectedContact.FaxPhoneNumber;

  const hasLocationInfo =
    selectedContact.Address ||
    selectedContact.City ||
    selectedContact.State ||
    selectedContact.Zip ||
    selectedContact.LocationGpsCoordinates ||
    selectedContact.EntranceGpsCoordinates ||
    selectedContact.ExitGpsCoordinates;

  const hasSocialMedia =
    selectedContact.Website ||
    selectedContact.Twitter ||
    selectedContact.Facebook ||
    selectedContact.LinkedIn ||
    selectedContact.Instagram ||
    selectedContact.Threads ||
    selectedContact.Bluesky ||
    selectedContact.Mastodon;

  const hasIdentification = selectedContact.CountryIssuedIdNumber || selectedContact.StateIdNumber;

  const hasAdditionalInfo = selectedContact.Description || selectedContact.Notes || selectedContact.OtherInfo;

  const hasSystemInfo = selectedContact.AddedOn || selectedContact.AddedByUserName || selectedContact.EditedOn || selectedContact.EditedByUserName;

  return (
    <Actionsheet isOpen={isDetailsOpen} onClose={closeDetails} snapPoints={[85]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="w-full rounded-t-xl bg-white dark:bg-gray-800">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <Box className="w-full flex-1 p-4">
          <HStack className="mb-4 items-center justify-between">
            <Text className="text-xl font-semibold text-gray-900 dark:text-white">{t('contacts.details')}</Text>
            <Button variant="link" onPress={closeDetails} className="p-1">
              <X size={24} className="text-gray-600 dark:text-gray-400" />
            </Button>
          </HStack>

          {/* Contact Header */}
          <VStack space="md" className="items-center pb-4">
            <Avatar size="xl" className="mb-2">
              {selectedContact.ImageUrl ? (
                <AvatarImage source={{ uri: selectedContact.ImageUrl }} alt={displayName} />
              ) : (
                <View className="size-full items-center justify-center bg-primary-500">
                  {selectedContact.ContactType === ContactType.Person ? <UserIcon size={48} color="#000" /> : <BuildingIcon size={48} color="#000" />}
                </View>
              )}
            </Avatar>

            <VStack space="xs" className="items-center">
              <HStack space="xs" className="items-center">
                <Text className="text-2xl font-bold text-gray-900 dark:text-white">{displayName}</Text>
                {selectedContact.IsImportant ? <StarIcon size={20} color="#FFD700" /> : null}
              </HStack>
              <Text className="text-sm text-gray-500 dark:text-gray-400">{selectedContact.ContactType === ContactType.Person ? t('contacts.person') : t('contacts.company')}</Text>
              {selectedContact.OtherName ? <Text className="text-sm text-gray-600 dark:text-gray-300">({selectedContact.OtherName})</Text> : null}
              {selectedContact.Category?.Name ? <Text className="text-sm text-primary-600 dark:text-primary-400">{selectedContact.Category.Name}</Text> : null}
            </VStack>
          </VStack>

          {/* Tab Navigation */}
          <HStack className="mb-4 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            <Pressable onPress={() => setActiveTab('details')} className={`flex-1 rounded-md ${isLandscape ? 'px-4 py-2' : 'px-3 py-1.5'} ${activeTab === 'details' ? 'bg-white shadow-xs dark:bg-gray-700' : ''}`}>
              <Text className={`text-center font-medium ${isLandscape ? 'text-sm' : 'text-xs'} ${activeTab === 'details' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'}`}>
                {t('contacts.tabs.details')}
              </Text>
            </Pressable>
            <Pressable onPress={() => setActiveTab('notes')} className={`flex-1 rounded-md ${isLandscape ? 'px-4 py-2' : 'px-3 py-1.5'} ${activeTab === 'notes' ? 'bg-white shadow-xs dark:bg-gray-700' : ''}`}>
              <Text className={`text-center font-medium ${isLandscape ? 'text-sm' : 'text-xs'} ${activeTab === 'notes' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'}`}>
                {t('contacts.tabs.notes')}
              </Text>
            </Pressable>
          </HStack>

          {/* Tab Content */}
          {activeTab === 'details' ? (
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <VStack space="lg" className="flex-1">
                {/* Contact Information Section */}
                {hasContactInfo ? (
                  <Section title={t('contacts.contactInformation')} icon={<PhoneIcon size={16} color="#6366F1" />}>
                    <VStack space="xs">
                      <ContactField label={t('contacts.email')} value={selectedContact.Email} icon={<MailIcon size={16} color="#6366F1" />} />
                      <ContactField label={t('contacts.phone')} value={selectedContact.Phone} icon={<PhoneIcon size={16} color="#6366F1" />} />
                      <ContactField label={t('contacts.mobile')} value={selectedContact.Mobile} icon={<SmartphoneIcon size={16} color="#6366F1" />} />
                      <ContactField label={t('contacts.homePhone')} value={selectedContact.HomePhoneNumber} icon={<HomeIcon size={16} color="#6366F1" />} />
                      <ContactField label={t('contacts.cellPhone')} value={selectedContact.CellPhoneNumber} icon={<SmartphoneIcon size={16} color="#6366F1" />} />
                      <ContactField label={t('contacts.officePhone')} value={selectedContact.OfficePhoneNumber} icon={<PhoneIcon size={16} color="#6366F1" />} />
                      <ContactField label={t('contacts.faxPhone')} value={selectedContact.FaxPhoneNumber} icon={<PhoneIcon size={16} color="#6366F1" />} />
                    </VStack>
                  </Section>
                ) : null}

                {/* Location Information Section */}
                {hasLocationInfo ? (
                  <Section title={t('contacts.locationInformation')} icon={<MapPinIcon size={16} color="#6366F1" />}>
                    <VStack space="xs">
                      <ContactField label={t('contacts.address')} value={selectedContact.Address} icon={<HomeIcon size={16} color="#6366F1" />} />
                      {selectedContact.City || selectedContact.State || selectedContact.Zip ? (
                        <ContactField
                          label={t('contacts.cityStateZip')}
                          value={[selectedContact.City, selectedContact.State, selectedContact.Zip].filter(Boolean).join(', ')}
                          icon={<MapPinIcon size={16} color="#6366F1" />}
                        />
                      ) : null}
                      <ContactField label={t('contacts.locationCoordinates')} value={selectedContact.LocationGpsCoordinates} icon={<MapPinIcon size={16} color="#6366F1" />} />
                      <ContactField label={t('contacts.entranceCoordinates')} value={selectedContact.EntranceGpsCoordinates} icon={<MapPinIcon size={16} color="#6366F1" />} />
                      <ContactField label={t('contacts.exitCoordinates')} value={selectedContact.ExitGpsCoordinates} icon={<MapPinIcon size={16} color="#6366F1" />} />
                    </VStack>
                  </Section>
                ) : null}

                {/* Social Media & Web Section */}
                {hasSocialMedia ? (
                  <Section title={t('contacts.socialMediaWeb')} icon={<GlobeIcon size={16} color="#6366F1" />} defaultExpanded={false}>
                    <VStack space="xs">
                      <ContactField label={t('contacts.website')} value={selectedContact.Website} icon={<GlobeIcon size={16} color="#6366F1" />} isLink />
                      <ContactField label={t('contacts.twitter')} value={selectedContact.Twitter} isLink linkPrefix="@" />
                      <ContactField label={t('contacts.facebook')} value={selectedContact.Facebook} />
                      <ContactField label={t('contacts.linkedin')} value={selectedContact.LinkedIn} />
                      <ContactField label={t('contacts.instagram')} value={selectedContact.Instagram} isLink linkPrefix="@" />
                      <ContactField label={t('contacts.threads')} value={selectedContact.Threads} isLink linkPrefix="@" />
                      <ContactField label={t('contacts.bluesky')} value={selectedContact.Bluesky} isLink linkPrefix="@" />
                      <ContactField label={t('contacts.mastodon')} value={selectedContact.Mastodon} isLink linkPrefix="@" />
                    </VStack>
                  </Section>
                ) : null}

                {/* Identification Section */}
                {hasIdentification ? (
                  <Section title={t('contacts.identification')} icon={<SettingsIcon size={16} color="#6366F1" />} defaultExpanded={false}>
                    <VStack space="xs">
                      <ContactField label={selectedContact.CountryIdName || t('contacts.countryId')} value={selectedContact.CountryIssuedIdNumber} />
                      <ContactField
                        label={`${selectedContact.StateIdName || t('contacts.stateId')} ${selectedContact.StateIdCountryName ? `(${selectedContact.StateIdCountryName})` : ''}`}
                        value={selectedContact.StateIdNumber}
                      />
                    </VStack>
                  </Section>
                ) : null}

                {/* Additional Information Section */}
                {hasAdditionalInfo ? (
                  <Section title={t('contacts.additionalInformation')} icon={<SettingsIcon size={16} color="#6366F1" />} defaultExpanded={false}>
                    <VStack space="xs">
                      <ContactField label={t('contacts.description')} value={selectedContact.Description} />
                      <ContactField label={t('contacts.notes')} value={selectedContact.Notes} />
                      <ContactField label={t('contacts.otherInfo')} value={selectedContact.OtherInfo} />
                    </VStack>
                  </Section>
                ) : null}

                {/* System Information Section */}
                {hasSystemInfo ? (
                  <Section title={t('contacts.systemInformation')} icon={<CalendarIcon size={16} color="#6366F1" />} defaultExpanded={false}>
                    <VStack space="xs">
                      <ContactField label={t('contacts.addedOn')} value={selectedContact.AddedOn ? new Date(selectedContact.AddedOn).toLocaleDateString() : undefined} icon={<CalendarIcon size={16} color="#6366F1" />} />
                      <ContactField label={t('contacts.addedBy')} value={selectedContact.AddedByUserName} icon={<UserIcon size={16} color="#6366F1" />} />
                      <ContactField
                        label={t('contacts.editedOn')}
                        value={selectedContact.EditedOn ? new Date(selectedContact.EditedOn).toLocaleDateString() : undefined}
                        icon={<CalendarIcon size={16} color="#6366F1" />}
                      />
                      <ContactField label={t('contacts.editedBy')} value={selectedContact.EditedByUserName} icon={<UserIcon size={16} color="#6366F1" />} />
                    </VStack>
                  </Section>
                ) : null}

                {/* Additional Fields (UDF) Section */}
                <Section title={t('contacts.additionalFields', 'Additional Fields')} icon={<SettingsIcon size={16} color="#6366F1" />} defaultExpanded={false}>
                  <UdfFieldsRenderer entityType={3} entityId={selectedContact.ContactId} onValuesChange={() => {}} readOnly={true} />
                </Section>
              </VStack>
            </ScrollView>
          ) : (
            <ContactNotesList contactId={selectedContact.ContactId} />
          )}
        </Box>
      </ActionsheetContent>
    </Actionsheet>
  );
};
