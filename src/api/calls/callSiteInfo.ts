import { type CallSiteInfoResult } from '@/models/v4/calls/callSiteInfoResult';

import { createApiEndpoint } from '../common/client';

// v4 Calls/GetCallSiteInfo (Contacts plan Phase A, decision 3b): every contact linked to a call with its
// pre-plan, premise hazards, live alert notes and site file metadata in one round trip. Needs Call_View.
// The client attaches the Protected Data Grant header automatically; without one, a protected
// department's contact identity, note text and pre-plan text come back REDACTED.

const getCallSiteInfoApi = createApiEndpoint('/Calls/GetCallSiteInfo');

export const getCallSiteInfo = async (callId: string, signal?: AbortSignal) => {
  const response = await getCallSiteInfoApi.get<CallSiteInfoResult>({ callId }, signal);
  return response.data;
};
