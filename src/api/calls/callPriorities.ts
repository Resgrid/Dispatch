import { type CallPrioritiesResult } from '@/models/v4/callPriorities/callPrioritiesResult';

import { createCachedApiEndpoint } from '../common/cached-client';

const callsPrioritesApi = createCachedApiEndpoint('/CallPriorities/GetAllCallPriorites', {
  ttl: 6 * 60 * 60 * 1000, // Cache for 6 hours -- reference data, changes rarely
  enabled: true,
});

export const getCallPriorities = async () => {
  const response = await callsPrioritesApi.get<CallPrioritiesResult>();
  return response.data;
};
