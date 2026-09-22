import { type ActiveCallsResult } from '@/models/v4/calls/activeCallsResult';
import { type CallExtraDataResult } from '@/models/v4/calls/callExtraDataResult';
import { type CallResult } from '@/models/v4/calls/callResult';
import { type SaveCallResult } from '@/models/v4/calls/saveCallResult';
import { type ScheduledCallsResult } from '@/models/v4/calls/scheduledCallsResult';

import { createApiEndpoint } from '../common/client';

const callsApi = createApiEndpoint('/Calls/GetActiveCalls');
const pendingScheduledCallsApi = createApiEndpoint('/Calls/GetAllPendingScheduledCalls');
const getCallApi = createApiEndpoint('/Calls/GetCall');
const getCallExtraDataApi = createApiEndpoint('/Calls/GetCallExtraData');
const createCallApi = createApiEndpoint('/Calls/SaveCall');
const updateCallApi = createApiEndpoint('/Calls/EditCall');
const closeCallApi = createApiEndpoint('/Calls/CloseCall');
const deleteCallApi = createApiEndpoint('/Calls/DeleteCall');
const updateScheduledDispatchTimeApi = createApiEndpoint('/Calls/UpdateScheduledDispatchTime');

export const getCalls = async () => {
  // Add timestamp to prevent any caching
  const response = await callsApi.get<ActiveCallsResult>({ _t: Date.now() });
  return response.data;
};

export const getPendingScheduledCalls = async () => {
  const response = await pendingScheduledCallsApi.get<ScheduledCallsResult>({ _t: Date.now() });
  return response.data;
};

export const getCallExtraData = async (callId: string) => {
  const response = await getCallExtraDataApi.get<CallExtraDataResult>({
    callId: encodeURIComponent(callId),
  });
  return response.data;
};

export const getCall = async (callId: string) => {
  const response = await getCallApi.get<CallResult>({
    callId: encodeURIComponent(callId),
  });
  return response.data;
};

export interface CreateCallRequest {
  name: string;
  nature: string;
  note?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  priority: number;
  type?: string;
  contactName?: string;
  contactInfo?: string;
  /** Primary Contact (premises/customer record) to link; the contact must belong to the department. */
  contactId?: string | null;
  /** Additional Contacts to link. On update, supplying either list replaces the existing links; omitting both leaves them alone. */
  additionalContactIds?: string[];
  what3words?: string;
  plusCode?: string;
  dispatchUsers?: string[];
  dispatchGroups?: string[];
  dispatchRoles?: string[];
  dispatchUnits?: string[];
  dispatchEveryone?: boolean;
  callFormData?: string;
  linkedCallId?: string;
  externalId?: string;
  referenceId?: string;
  scheduledOn?: string;
  destinationPoiId?: number | null;
}

export interface UpdateCallRequest {
  callId: string;
  name: string;
  nature: string;
  note?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  priority: number;
  type?: string;
  contactName?: string;
  contactInfo?: string;
  /** Primary Contact (premises/customer record) to link; the contact must belong to the department. */
  contactId?: string | null;
  /** Additional Contacts to link. On update, supplying either list replaces the existing links; omitting both leaves them alone. */
  additionalContactIds?: string[];
  what3words?: string;
  plusCode?: string;
  dispatchUsers?: string[];
  dispatchGroups?: string[];
  dispatchRoles?: string[];
  dispatchUnits?: string[];
  dispatchEveryone?: boolean;
  callFormData?: string;
  linkedCallId?: string;
  externalId?: string;
  referenceId?: string;
  destinationPoiId?: number | null;
  /** When true, re-sends the dispatch to all currently dispatched entities. */
  rebroadcastCall?: boolean;
  /** When true, notifies entities that were removed from the dispatch list on this edit. */
  notifyCancelledEntities?: boolean;
}

export interface CloseCallRequest {
  callId: string;
  type: number;
  note?: string;
}

export const createCall = async (callData: CreateCallRequest) => {
  let dispatchList = '';

  if (callData.dispatchEveryone) {
    dispatchList = '0';
  } else {
    const dispatchEntries: string[] = [];

    if (callData.dispatchUsers) {
      dispatchEntries.push(...callData.dispatchUsers.map((user) => `P:${user}`));
    }
    if (callData.dispatchGroups) {
      dispatchEntries.push(...callData.dispatchGroups.map((group) => `G:${group}`));
    }
    if (callData.dispatchRoles) {
      dispatchEntries.push(...callData.dispatchRoles.map((role) => `R:${role}`));
    }
    if (callData.dispatchUnits) {
      dispatchEntries.push(...callData.dispatchUnits.map((unit) => `U:${unit}`));
    }

    dispatchList = dispatchEntries.join('|');
  }

  const data = {
    Name: callData.name,
    Nature: callData.nature,
    Note: callData.note || '',
    Address: callData.address || '',
    DestinationPoiId: callData.destinationPoiId ?? null,
    Geolocation: `${callData.latitude?.toString() || ''},${callData.longitude?.toString() || ''}`,
    Priority: callData.priority,
    Type: callData.type || '',
    ContactName: callData.contactName || '',
    ContactInfo: callData.contactInfo || '',
    ...(callData.contactId !== undefined ? { ContactId: callData.contactId || '' } : {}),
    ...(callData.additionalContactIds !== undefined ? { AdditionalContactIds: callData.additionalContactIds } : {}),
    What3Words: callData.what3words || '',
    PlusCode: callData.plusCode || '',
    DispatchList: dispatchList,
    CallFormData: callData.callFormData || '',
    IncidentId: callData.linkedCallId || '',
    ExternalId: callData.externalId || '',
    ReferenceId: callData.referenceId || '',
    ScheduledOn: callData.scheduledOn || '',
  };

  const response = await createCallApi.post<SaveCallResult>(data);
  return response.data;
};

export const updateCall = async (callData: UpdateCallRequest) => {
  let dispatchList = '';

  if (callData.dispatchEveryone) {
    dispatchList = '0';
  } else {
    const dispatchEntries: string[] = [];

    if (callData.dispatchUsers) {
      dispatchEntries.push(...callData.dispatchUsers.map((user) => `P:${user}`));
    }
    if (callData.dispatchGroups) {
      dispatchEntries.push(...callData.dispatchGroups.map((group) => `G:${group}`));
    }
    if (callData.dispatchRoles) {
      dispatchEntries.push(...callData.dispatchRoles.map((role) => `R:${role}`));
    }
    if (callData.dispatchUnits) {
      dispatchEntries.push(...callData.dispatchUnits.map((unit) => `U:${unit}`));
    }

    dispatchList = dispatchEntries.join('|');
  }

  const data = {
    Id: callData.callId,
    Name: callData.name,
    Nature: callData.nature,
    Note: callData.note || '',
    Address: callData.address || '',
    DestinationPoiId: callData.destinationPoiId ?? null,
    Geolocation: `${callData.latitude?.toString() || ''},${callData.longitude?.toString() || ''}`,
    Priority: callData.priority,
    Type: callData.type || '',
    ContactName: callData.contactName || '',
    ContactInfo: callData.contactInfo || '',
    ...(callData.contactId !== undefined ? { ContactId: callData.contactId || '' } : {}),
    ...(callData.additionalContactIds !== undefined ? { AdditionalContactIds: callData.additionalContactIds } : {}),
    What3Words: callData.what3words || '',
    PlusCode: callData.plusCode || '',
    DispatchList: dispatchList,
    CallFormData: callData.callFormData || '',
    IncidentId: callData.linkedCallId || '',
    ExternalId: callData.externalId || '',
    ReferenceId: callData.referenceId || '',
    RebroadcastCall: callData.rebroadcastCall ?? false,
    NotifyCancelledEntities: callData.notifyCancelledEntities ?? false,
  };

  const response = await updateCallApi.put<SaveCallResult>(data);
  return response.data;
};

export const closeCall = async (callData: CloseCallRequest) => {
  const data = {
    Id: callData.callId,
    Type: callData.type,
    Notes: callData.note || '',
  };

  const response = await closeCallApi.put<SaveCallResult>(data);
  return response.data;
};

/** Soft-deletes a call. The server only allows deleting a call that has not yet been dispatched. */
export const deleteCall = async (callId: string) => {
  const response = await deleteCallApi.delete<SaveCallResult>({
    callId: encodeURIComponent(callId),
  });
  return response.data;
};

export interface UpdateScheduledDispatchTimeRequest {
  callId: string;
  /** Department-local dispatch date/time (ISO string). */
  date: string;
}

/** Reschedules the dispatch time of a not-yet-dispatched scheduled call. */
export const updateScheduledDispatchTime = async (request: UpdateScheduledDispatchTimeRequest) => {
  const data = {
    Id: request.callId,
    Date: request.date,
  };

  const response = await updateScheduledDispatchTimeApi.put<SaveCallResult>(data);
  return response.data;
};
