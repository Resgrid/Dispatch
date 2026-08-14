import { type DispatchRecommendationResultData } from '@/models/v4/runcards/dispatchRecommendationResultData';
import { type RunCardResultData } from '@/models/v4/runcards/runCardResultData';

import { api, createApiEndpoint } from '../common/client';

/**
 * Run card endpoints.
 *
 * Every one of these is gated server-side by the `Dispatch.RunCards` feature toggle:
 * `GetRecommendation` answers 404 and `EscalateCall` answers 400 when the department has it off.
 * Callers must check the flag before calling rather than relying on the error — see
 * `isRunCardsEnabled` in the feature-flags store.
 */

const getRecommendationApi = createApiEndpoint('/RunCards/GetRecommendation');
const getAllRunCardsApi = createApiEndpoint('/RunCards/GetAllRunCards');

interface RunCardRecommendationResult {
  Data: DispatchRecommendationResultData | null;
  /** 'success' when a card matched; 'not_found' is a valid answer meaning no card applies. */
  Status?: string;
}

interface RunCardsResult {
  Data: RunCardResultData[];
}

export interface EscalateCallResultData {
  Id: string;
  /** False when no run card matched or the next alarm level adds nothing new. */
  Success: boolean;
  /** Alarm level after the escalation; unchanged when Success is false. */
  NewAlarmLevel: number;
  AddedUnits: number;
  AddedPersonnel: number;
}

export interface RecommendationRequest {
  /** Call priority — system 0-3 or a DepartmentCallPriorityId. */
  priority: number;
  /** Call type *name*; the server resolves it case-insensitively against the department's types. */
  type: string;
  latitude?: number | null;
  longitude?: number | null;
  /** Alarm level whose requirements to fill. Levels below it are assumed already handled. */
  alarmLevel?: number;
}

/**
 * Previews what the department's run cards would dispatch for a prospective call. Nothing is
 * dispatched. Returns null when no card matches — the caller falls back to the manual flow.
 */
export const getDispatchRecommendation = async (request: RecommendationRequest, signal?: AbortSignal): Promise<DispatchRecommendationResultData | null> => {
  const response = await getRecommendationApi.get<RunCardRecommendationResult>(
    {
      priority: request.priority,
      type: request.type,
      ...(typeof request.latitude === 'number' ? { latitude: request.latitude } : {}),
      ...(typeof request.longitude === 'number' ? { longitude: request.longitude } : {}),
      alarmLevel: request.alarmLevel ?? 1,
    },
    signal
  );

  const data = response.data?.Data ?? null;

  // A result with no matched card carries empty collections and means "no card applies here";
  // collapsing it to null keeps that out of the UI entirely.
  return data && data.MatchedRunCardId ? data : null;
};

/** All run cards for the department. Read-only here — authoring lives in the web admin. */
export const getAllRunCards = async (signal?: AbortSignal): Promise<RunCardResultData[]> => {
  const response = await getAllRunCardsApi.get<RunCardsResult>(undefined, signal);
  return response.data?.Data ?? [];
};

/**
 * "Strike Next Alarm": escalates the call to its next alarm level, additively dispatching that
 * level's requirements and notifying only the newly added resources.
 */
export const escalateCall = async (callId: string, signal?: AbortSignal): Promise<EscalateCallResultData> => {
  const response = await api.put<EscalateCallResultData>(`/Calls/EscalateCall?callId=${encodeURIComponent(callId)}`, undefined, { signal });
  return response.data;
};
