import {
  type AwaitingResourcesActionResult,
  type AwaitingResourcesResult,
  type CallOutstandingRequirementData,
  type CallOutstandingRequirementsResult,
  type DispatchResponseCodesConfigData,
  type ResponseCodesResult,
} from '@/models/v4/awaitingResources/awaitingResourcesResultData';

import { createApiEndpoint } from '../common/client';

/**
 * Calls awaiting resources and response codes (conditional run cards).
 *
 * Gated server-side by the `Dispatch.RunCardConditions` feature toggle: GetAwaitingCalls answers `Enabled: false` with
 * an empty list, GetCallRequirements an empty list, and the two actions 404 when the department has it off. Callers
 * must check the flag before calling (`isRunCardConditionsEnabled` in the feature-flags store) rather than relying on
 * the error.
 */

const getAwaitingCallsApi = createApiEndpoint('/AwaitingResources/GetAwaitingCalls');
const getCallRequirementsApi = createApiEndpoint('/AwaitingResources/GetCallRequirements');
const dismissRequirementApi = createApiEndpoint('/AwaitingResources/DismissRequirement');
const dispatchUnitApi = createApiEndpoint('/AwaitingResources/DispatchUnit');
const getResponseCodesApi = createApiEndpoint('/AwaitingResources/GetResponseCodes');

/** Every active call still awaiting a required resource, highest priority then oldest, with the units now available that match. */
export const getAwaitingCalls = async (signal?: AbortSignal): Promise<AwaitingResourcesResult> => {
  // Timestamp so no cache in between hands back a list from before the last dispatch.
  const response = await getAwaitingCallsApi.get<AwaitingResourcesResult>({ _t: Date.now() }, signal);
  return response.data;
};

/** The call's open outstanding requirements, reconciled with its dispatches first. */
export const getCallRequirements = async (callId: string | number, signal?: AbortSignal): Promise<CallOutstandingRequirementData[]> => {
  const response = await getCallRequirementsApi.get<CallOutstandingRequirementsResult>({ callId, _t: Date.now() }, signal);
  return response.data?.Data ?? [];
};

/** Dismisses an open requirement the call no longer needs, with an optional note saying why. */
export const dismissRequirement = async (callId: number, requirementId: number, note?: string): Promise<AwaitingResourcesActionResult> => {
  const trimmed = note?.trim();
  const response = await dismissRequirementApi.post<AwaitingResourcesActionResult>({
    CallId: callId,
    RequirementId: requirementId,
    ...(trimmed ? { Note: trimmed } : {}),
  });
  return response.data;
};

/**
 * Adds a unit to a call awaiting resources in one step. Additive: the call keeps everything already on it and only this
 * unit is notified. Resolves the requirement the unit matches.
 */
export const dispatchUnitToAwaitingCall = async (callId: number, unitId: number): Promise<AwaitingResourcesActionResult> => {
  const response = await dispatchUnitApi.post<AwaitingResourcesActionResult>({ CallId: callId, UnitId: unitId });
  return response.data;
};

/** The department's response code catalog. Empty Codes means the department uses none and no code UI should show. */
export const getResponseCodes = async (signal?: AbortSignal): Promise<DispatchResponseCodesConfigData> => {
  const response = await getResponseCodesApi.get<ResponseCodesResult>(undefined, signal);
  const data = response.data?.Data;
  return { Codes: data?.Codes ?? [], ShowToCrews: !!data?.ShowToCrews };
};
