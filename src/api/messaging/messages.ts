import { type GetRecipientsResult } from '@/models/v4/messages/getRecipientsResult';

import { createCachedApiEndpoint } from '../common/cached-client';

const recipientsApi = createCachedApiEndpoint('/Messages/GetRecipients', {
  ttl: 15 * 60 * 1000, // Cache for 15 minutes -- operational data, must not go stale
  enabled: true,
});

export const getRecipients = async (disallowNoone: boolean, includeUnits: boolean) => {
  const response = await recipientsApi.get<GetRecipientsResult>({
    disallowNoone: disallowNoone,
    includeUnits: includeUnits,
  });
  return response.data;
};
