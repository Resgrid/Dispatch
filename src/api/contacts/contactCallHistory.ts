import { type LocationHistoryResult } from '@/models/v4/calls/locationHistoryResult';

import { createApiEndpoint } from '../common/client';

// v4 Contacts/GetContactCallHistory: calls linked to a contact plus calls at every occupancy it is linked to (one contact can
// have several, such as a business with more than one location), newest first with their notes. Needs Contacts_View and is
// limited to the calls the user may see.

const getContactCallHistoryApi = createApiEndpoint('/Contacts/GetContactCallHistory');

export const getContactCallHistory = async (contactId: string, signal?: AbortSignal) => {
  const response = await getContactCallHistoryApi.get<LocationHistoryResult>({ contactId }, signal);
  return response.data;
};
