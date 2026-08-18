import { type CallPersonnelCheckInStatusResult } from '@/models/v4/checkIn/callPersonnelCheckInStatusResult';
import { type CheckInRecordResult } from '@/models/v4/checkIn/checkInRecordResult';
import { type CheckInTimerStatusResult } from '@/models/v4/checkIn/checkInTimerStatusResult';
import { type PerformCheckInResult } from '@/models/v4/checkIn/performCheckInResult';
import { type ResolvedCheckInTimerResult } from '@/models/v4/checkIn/resolvedCheckInTimerResult';

import { createApiEndpoint } from '../common/client';

const getTimerStatusesApi = createApiEndpoint('/CheckInTimers/GetTimerStatuses');
const getTimersForCallApi = createApiEndpoint('/CheckInTimers/GetTimersForCall');
const performCheckInApi = createApiEndpoint('/CheckInTimers/PerformCheckIn');
const getCheckInHistoryApi = createApiEndpoint('/CheckInTimers/GetCheckInHistory');
const toggleCallTimersApi = createApiEndpoint('/CheckInTimers/ToggleCallTimers');
const getCallPersonnelCheckInStatusesApi = createApiEndpoint('/CheckInTimers/GetCallPersonnelCheckInStatuses');

export const getTimerStatuses = async (callId: number) => {
  const response = await getTimerStatusesApi.get<CheckInTimerStatusResult>({ callId });
  return response.data;
};

// The endpoint is per-call, so a busy department turns one refresh into one request per active
// call. Chunked rather than fired all at once: this runs on a 30s poll and would otherwise put the
// whole burst on the connection pool at the same moment, ahead of user-initiated requests.
const STATUS_FETCH_CONCURRENCY = 4;

export const getTimerStatusesForCalls = async (callIds: number[]): Promise<CheckInTimerStatusResult> => {
  const results: PromiseSettledResult<{ callId: number; data: CheckInTimerStatusResult['Data'] }>[] = [];
  for (let i = 0; i < callIds.length; i += STATUS_FETCH_CONCURRENCY) {
    const chunk = callIds.slice(i, i + STATUS_FETCH_CONCURRENCY);
    const chunkResults = await Promise.allSettled(
      chunk.map((callId) =>
        getTimerStatuses(callId).then((result) => ({
          callId,
          data: result.Data || [],
        }))
      )
    );
    results.push(...chunkResults);
  }

  const allData = results
    .filter((r): r is PromiseFulfilledResult<{ callId: number; data: CheckInTimerStatusResult['Data'] }> => r.status === 'fulfilled')
    .flatMap((r) => r.value.data.map((timer) => ({ ...timer, CallId: r.value.callId })));

  return {
    Data: allData,
    PageSize: 0,
    Timestamp: '',
    Version: '',
    Node: '',
    RequestId: '',
    Status: '',
    Environment: '',
  } as CheckInTimerStatusResult;
};

export const getTimersForCall = async (callId: number) => {
  const response = await getTimersForCallApi.get<ResolvedCheckInTimerResult>({ callId });
  return response.data;
};

export interface PerformCheckInInput {
  CallId: number;
  CheckInType: number;
  UnitId?: number;
  Latitude?: string;
  Longitude?: string;
  Note?: string;
}

export const performCheckIn = async (input: PerformCheckInInput) => {
  const response = await performCheckInApi.post<PerformCheckInResult>({
    CallId: input.CallId,
    CheckInType: input.CheckInType,
    UnitId: input.UnitId ?? 0,
    Latitude: input.Latitude ?? '',
    Longitude: input.Longitude ?? '',
    Note: input.Note ?? '',
  });
  return response.data;
};

export const getCheckInHistory = async (callId: number) => {
  const response = await getCheckInHistoryApi.get<CheckInRecordResult>({ callId });
  return response.data;
};

export const toggleCallTimers = async (callId: number, enabled: boolean) => {
  const response = await toggleCallTimersApi.put<PerformCheckInResult>({ callId, enabled });
  return response.data;
};

/** Per-personnel accountability (PAR) roster for a call. */
export const getCallPersonnelCheckInStatuses = async (callId: number) => {
  const response = await getCallPersonnelCheckInStatusesApi.get<CallPersonnelCheckInStatusResult>({ callId });
  return response.data;
};
