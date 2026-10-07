import { formatGeolocation } from '@/lib/call-geolocation';
import { type ActiveCallsResult } from '@/models/v4/calls/activeCallsResult';
import { type CallExtraDataResult } from '@/models/v4/calls/callExtraDataResult';
import { type CallResult } from '@/models/v4/calls/callResult';
import { type DispatchCallNowResult } from '@/models/v4/calls/dispatchCallNowResult';
import { type PendingCallsResult } from '@/models/v4/calls/pendingCallsResult';
import { type SaveCallResult } from '@/models/v4/calls/saveCallResult';
import { type ScheduledCallsResult } from '@/models/v4/calls/scheduledCallsResult';

import { createApiEndpoint } from '../common/client';

const callsApi = createApiEndpoint('/Calls/GetActiveCalls');
const pendingScheduledCallsApi = createApiEndpoint('/Calls/GetAllPendingScheduledCalls');
const pendingCallsApi = createApiEndpoint('/Calls/GetPendingCalls');
const dispatchCallNowApi = createApiEndpoint('/Calls/DispatchCallNow');
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

/**
 * Calls saved as Pending (State 8, "to be dispatched"): numbered, nobody notified, not on the field apps.
 * Oldest first. The server answers Status "NotFound" with an empty list when there are none.
 */
export const getPendingCalls = async () => {
  const response = await pendingCallsApi.get<PendingCallsResult>({ _t: Date.now() });
  return response.data;
};

/**
 * Dispatches a Pending call, or a scheduled call that has not gone out yet, immediately.
 *
 * Without a dispatch list (or with an empty one) the server uses the recipients already stored on the
 * call (a pending call's proposed dispatch, a scheduled call's list). A non-empty list ("0" = everyone,
 * otherwise the P:/G:/R:/U: entries from {@link buildDispatchList}) replaces the call's list first.
 */
export const dispatchCallNow = async (callId: string, dispatchList?: string) => {
  const data: { CallId: string; DispatchList?: string } = { CallId: callId };
  if (dispatchList) {
    data.DispatchList = dispatchList;
  }

  const response = await dispatchCallNowApi.put<DispatchCallNowResult>(data);
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
  /**
   * Saves the call as Pending (State 8) instead of dispatching it: nobody is notified, `scheduledOn` is
   * ignored, and the dispatch list is optional and kept as the proposed dispatch for whoever dispatches
   * it later. The department's "dispatch list required" rule does not apply.
   */
  isPending?: boolean;
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
  /**
   * Alert everyone attached to the call (dispatched personnel, groups, roles, units and the incident
   * command team) that it is closed. Omitted from the request when not set, leaving the server default.
   */
  sendNotification?: boolean;
}

/** Who to dispatch, in the shape the dispatch picker produces (`DispatchSelection` fits it). */
export interface DispatchListSelection {
  everyone?: boolean;
  users?: string[];
  groups?: string[];
  roles?: string[];
  units?: string[];
}

/**
 * Builds the server's DispatchList string: "0" for everyone, otherwise "|"-joined `P:` (personnel),
 * `G:` (group), `R:` (role) and `U:` (unit) entries. An empty selection yields an empty string.
 */
export const buildDispatchList = (selection: DispatchListSelection): string => {
  if (selection.everyone) {
    return '0';
  }

  const dispatchEntries: string[] = [];

  if (selection.users) {
    dispatchEntries.push(...selection.users.map((user) => `P:${user}`));
  }
  if (selection.groups) {
    dispatchEntries.push(...selection.groups.map((group) => `G:${group}`));
  }
  if (selection.roles) {
    dispatchEntries.push(...selection.roles.map((role) => `R:${role}`));
  }
  if (selection.units) {
    dispatchEntries.push(...selection.units.map((unit) => `U:${unit}`));
  }

  return dispatchEntries.join('|');
};

const dispatchListFor = (callData: CreateCallRequest | UpdateCallRequest): string =>
  buildDispatchList({
    everyone: callData.dispatchEveryone,
    users: callData.dispatchUsers,
    groups: callData.dispatchGroups,
    roles: callData.dispatchRoles,
    units: callData.dispatchUnits,
  });

export const createCall = async (callData: CreateCallRequest) => {
  const dispatchList = dispatchListFor(callData);

  const data = {
    Name: callData.name,
    Nature: callData.nature,
    Note: callData.note || '',
    Address: callData.address || '',
    DestinationPoiId: callData.destinationPoiId ?? null,
    Geolocation: formatGeolocation(callData.latitude, callData.longitude),
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
    // A pending call has no dispatch time; the server ignores one anyway.
    ScheduledOn: callData.isPending ? '' : callData.scheduledOn || '',
    IsPending: callData.isPending === true,
  };

  const response = await createCallApi.post<SaveCallResult>(data);
  return response.data;
};

export const updateCall = async (callData: UpdateCallRequest) => {
  const dispatchList = dispatchListFor(callData);

  const data = {
    Id: callData.callId,
    Name: callData.name,
    Nature: callData.nature,
    Note: callData.note || '',
    Address: callData.address || '',
    DestinationPoiId: callData.destinationPoiId ?? null,
    Geolocation: formatGeolocation(callData.latitude, callData.longitude),
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
    ...(callData.sendNotification !== undefined ? { SendNotification: callData.sendNotification } : {}),
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
