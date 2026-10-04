import { type LocationHistoryResult } from '@/models/v4/calls/locationHistoryResult';

import { createApiEndpoint } from '../common/client';

// v4 Calls/GetCallLocationHistory: other calls at this call's location (address however it was typed, or nearby when one
// side has no street address) and calls linked to the same contacts, newest first with their notes. Needs Call_View and is
// limited to the calls the user may see. The client attaches the Protected Data Grant header automatically; without one,
// a protected department's call text and notes come back REDACTED.

const getCallLocationHistoryApi = createApiEndpoint('/Calls/GetCallLocationHistory');

export const getCallLocationHistory = async (callId: string, signal?: AbortSignal) => {
  const response = await getCallLocationHistoryApi.get<LocationHistoryResult>({ callId }, signal);
  return response.data;
};
