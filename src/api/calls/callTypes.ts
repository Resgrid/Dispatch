import { type CallTypesResult } from '@/models/v4/callTypes/callTypesResult';

import { createCachedApiEndpoint } from '../common/cached-client';

const callsTypesApi = createCachedApiEndpoint('/CallTypes/GetAllCallTypes', {
  ttl: 6 * 60 * 60 * 1000, // Cache for 6 hours -- reference data, changes rarely
  enabled: true,
});

export const getCallTypes = async () => {
  const response = await callsTypesApi.get<CallTypesResult>();
  return response.data;
};
