import { type NewCallFieldPolicyResultData } from '@/models/v4/calls/newCallFieldPolicyResultData';

import { createApiEndpoint } from '../common/client';

const getNewCallFieldPolicyApi = createApiEndpoint('/Calls/GetNewCallFieldPolicy');

interface NewCallFieldPolicyResult {
  Data: NewCallFieldPolicyResultData | null;
}

/**
 * Fetches the department's new-call field policy.
 *
 * An empty rule list means the stock form — every field visible, nothing extra required — which is
 * also what a failure degrades to, since hiding fields a dispatcher needs is far worse than showing
 * one they were told to hide. The server enforces the same policy on save regardless.
 */
export const getNewCallFieldPolicy = async (signal?: AbortSignal): Promise<NewCallFieldPolicyResultData> => {
  const response = await getNewCallFieldPolicyApi.get<NewCallFieldPolicyResult>(undefined, signal);

  return response.data?.Data ?? { Rules: [] };
};
