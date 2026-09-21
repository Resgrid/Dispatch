import { useMemo } from 'react';

import { type FieldRecordContextInput } from '@/models/v4/records';
import { useCallDetailStore } from '@/stores/calls/detail-store';

/**
 * The field context this app authors in (RMS plan RMS-1D). Dispatch authors against the Call open on
 * the console; with no Call open the console's own shift-context definitions are what the server
 * offers. Every identifier is re-checked server-side, so a stale selection narrows the catalog.
 */
export const useRecordsContext = (): FieldRecordContextInput => {
  const call = useCallDetailStore((state) => state.call);

  return useMemo(() => {
    const callId = call?.CallId ? Number.parseInt(String(call.CallId), 10) : Number.NaN;
    return Number.isFinite(callId) && callId > 0 ? { CallId: callId } : {};
  }, [call?.CallId]);
};
