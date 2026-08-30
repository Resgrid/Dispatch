import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { ProtectedText } from '@/components/data-protection/protected-text';
import { isFieldRedacted, ProtectedFieldIds } from '@/lib/data-protection/redacted';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { BuildingIcon, MailIcon, PhoneIcon, StarIcon, UserIcon } from '@/components/ui/lucide-icons';
import { type ContactResultData, ContactType } from '@/models/v4/contacts/contactResultData';

interface ContactCardProps {
  contact: ContactResultData;
  onPress: (id: string) => void;
}

export const ContactCard: React.FC<ContactCardProps> = ({ contact, onPress }) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  const getDisplayName = (contact: ContactResultData) => {
    if (contact.ContactType === ContactType.Person) {
      const firstName = contact.FirstName?.trim() || '';
      const lastName = contact.LastName?.trim() || '';
      return `${firstName} ${lastName}`.trim() || contact.Name || 'Unknown Person';
    } else {
      return contact.CompanyName?.trim() || contact.Name || 'Unknown Company';
    }
  };

  const displayName = getDisplayName(contact);

  return (
    <Pressable className="mb-3 overflow-hidden rounded-lg bg-white shadow-xs dark:bg-gray-800" onPress={() => onPress(contact.ContactId)}>
      <View className="flex-row items-center p-4">
        <Avatar size="md" className="mr-4 bg-gray-100 dark:bg-gray-700">
          {contact.ImageUrl ? (
            <AvatarImage source={{ uri: contact.ImageUrl }} alt={displayName} />
          ) : (
            <View className="size-full items-center justify-center bg-gray-100 dark:bg-gray-700">
              {contact.ContactType === ContactType.Person ? <UserIcon size={24} color="#6B7280" /> : <BuildingIcon size={24} color="#6B7280" />}
            </View>
          )}
        </Avatar>

        <View className="flex-1">
          <View className="flex-row items-center">
            {/*
              A contact's name is composed from first/last/company, so when those are withheld the
              composed value reads "REDACTED REDACTED" — a name, apparently. The list now carries
              per-row RedactedFields, so this asks the server's answer rather than sniffing the
              value, and a member who types REDACTED into a name still sees it back.
            */}
            {isFieldRedacted(contact.RedactedFields, ProtectedFieldIds.contactFirstName, contact.FirstName) ||
            isFieldRedacted(contact.RedactedFields, ProtectedFieldIds.contactLastName, contact.LastName) ||
            isFieldRedacted(contact.RedactedFields, ProtectedFieldIds.contactCompanyName, contact.CompanyName) ? (
              <View className="flex-1">
                <ProtectedText value={undefined} fieldId={ProtectedFieldIds.contactLastName} redactedFields={[ProtectedFieldIds.contactLastName]} size="md" />
              </View>
            ) : (
              <Text className="flex-1 text-lg font-semibold text-gray-900 dark:text-white">{displayName}</Text>
            )}
            {contact.IsImportant ? <StarIcon size={16} color="#FFD700" /> : null}
          </View>

          {contact.Email ? (
            <View className="mt-1 flex-row items-center">
              <MailIcon size={14} className="mr-1" color="#6B7280" />
              <ProtectedText value={contact.Email} fieldId={ProtectedFieldIds.contactEmail} redactedFields={contact.RedactedFields} size="sm" className="text-gray-600 dark:text-gray-300" />
            </View>
          ) : null}

          {contact.Phone ? (
            <View className="mt-1 flex-row items-center">
              <PhoneIcon size={14} className="mr-1" color="#6B7280" />
              <ProtectedText value={contact.Phone} fieldId={ProtectedFieldIds.contactCellPhone} redactedFields={contact.RedactedFields} size="sm" className="text-gray-600 dark:text-gray-300" />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};
