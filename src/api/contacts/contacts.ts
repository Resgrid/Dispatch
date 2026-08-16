import { cacheManager } from '@/lib/cache/cache-manager';
import { type ContactResult } from '@/models/v4/contacts/contactResult';
import { type ContactsCategoriesResult } from '@/models/v4/contacts/contactsCategoriesResult';
import { type ContactsResult } from '@/models/v4/contacts/contactsResult';

import { createCachedApiEndpoint } from '../common/cached-client';
import { createApiEndpoint } from '../common/client';

// Define API endpoints
const getAllContactsApi = createCachedApiEndpoint('/Contacts/GetAllContacts', {
  ttl: 15 * 60 * 1000, // Cache for 15 minutes -- operational data, must not go stale
  enabled: true,
});

const getAllContactCategoriesApi = createCachedApiEndpoint('/Contacts/GetAllContactCategories', {
  ttl: 15 * 60 * 1000, // Cache for 15 minutes -- operational data, must not go stale
  enabled: true,
});

const getContactApi = createApiEndpoint('/Contacts/GetContactById');

export const getAllContacts = async (forceRefresh: boolean = false) => {
  if (forceRefresh) {
    // Clear cache before making the request
    cacheManager.remove('/Contacts/GetAllContacts');
  }

  const response = await getAllContactsApi.get<ContactsResult>();
  return response.data;
};

export const getContact = async (contactId: string) => {
  const response = await getContactApi.get<ContactResult>({
    contactId,
  });
  return response.data;
};

export const getAllContactCategories = async () => {
  const response = await getAllContactCategoriesApi.get<ContactsCategoriesResult>();
  return response.data;
};
