import { type DispatchListSelection, type UpdateCallRequest } from '@/api/calls/calls';
import { formatGeolocation } from '@/lib/call-geolocation';
import { isCallPending } from '@/lib/utils';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type NewCallFieldKey, NewCallFieldKeys } from '@/models/v4/calls/newCallFieldPolicyResultData';

/**
 * Shared pieces of the department's call field policy ("New Call Form Fields") for the new-call and
 * edit-call screens: field labels, the server's rejection message, and the edit-specific rules for
 * which requirements apply and how a hidden field is left alone.
 */

/**
 * The label each call form puts on the field a policy key controls. The policy speaks in stable wire
 * keys; a dispatcher told to fill in 'contactName' is being shown the protocol rather than their own
 * form, so messages name the field the way the screen does.
 */
export const CALL_FIELD_LABEL_KEYS: Record<NewCallFieldKey, string> = {
  [NewCallFieldKeys.Address]: 'calls.address',
  [NewCallFieldKeys.Geolocation]: 'calls.coordinates',
  [NewCallFieldKeys.What3Words]: 'calls.what3words',
  [NewCallFieldKeys.PlusCode]: 'calls.plus_code',
  [NewCallFieldKeys.DestinationPoi]: 'calls.destination_poi',
  [NewCallFieldKeys.IndoorLocation]: 'calls.indoor_location',
  [NewCallFieldKeys.Note]: 'calls.note',
  [NewCallFieldKeys.ContactName]: 'calls.contact_name',
  [NewCallFieldKeys.ContactInfo]: 'calls.contact_info',
  [NewCallFieldKeys.ExternalId]: 'call_detail.external_id',
  [NewCallFieldKeys.IncidentId]: 'calls.incident_id',
  [NewCallFieldKeys.ReferenceId]: 'call_detail.reference_id',
  [NewCallFieldKeys.Protocols]: 'calls.protocols.title',
  [NewCallFieldKeys.LinkedCall]: 'calls.linked_calls.title',
  [NewCallFieldKeys.DispatchOn]: 'calls.scheduled_on',
  [NewCallFieldKeys.DispatchList]: 'calls.dispatch_to',
};

/** Lowercased key -> canonical key, so a stored rule's or a server message's casing never leaks out. */
const CANONICAL_KEYS = new Map<string, NewCallFieldKey>(Object.values(NewCallFieldKeys).map((key) => [key.toLowerCase(), key]));

/** The canonical policy key for a key in any casing, or undefined for a key this build does not know. */
export const toNewCallFieldKey = (key: string | null | undefined): NewCallFieldKey | undefined => (key ? CANONICAL_KEYS.get(key.trim().toLowerCase()) : undefined);

/**
 * The fields, named the way the form names them, joined for a message. A key this build does not
 * know is shown as-is rather than dropped: it at least names something.
 */
export const describeCallFields = (keys: readonly string[], t: (key: string) => string): string =>
  keys
    .map((key) => {
      const canonical = toNewCallFieldKey(key);

      return canonical ? t(CALL_FIELD_LABEL_KEYS[canonical]) : key;
    })
    .join(', ');

/** True when a dispatch selection names anyone: everyone, or at least one person, group, role or unit. */
export const hasDispatchRecipients = (selection: DispatchListSelection | null | undefined): boolean =>
  !!selection && (!!selection.everyone || (selection.users?.length ?? 0) > 0 || (selection.groups?.length ?? 0) > 0 || (selection.roles?.length ?? 0) > 0 || (selection.units?.length ?? 0) > 0);

/**
 * The numeric dispatch protocol ids the save API takes, from the protocol picker's selection. Picker
 * entries without a usable id (the picker falls back to a positional key) cannot be attached and are
 * left out; duplicates are sent once.
 */
export const toProtocolIds = (selected: readonly { protocolId: string }[] | null | undefined): number[] => {
  const ids: number[] = [];

  for (const entry of selected ?? []) {
    const raw = String(entry?.protocolId ?? '').trim();

    if (!/^\d+$/.test(raw)) {
      continue;
    }

    const id = Number(raw);

    if (id > 0 && !ids.includes(id)) {
      ids.push(id);
    }
  }

  return ids;
};

const MISSING_FIELDS_PREFIX = 'required call fields are missing:';

/**
 * The policy keys a save was refused for, read from the server's 400 ("Required call fields are
 * missing: address, contactInfo"). Null when the error is anything else, so callers fall back to their
 * own message. Unknown keys are kept as sent so the message still names them.
 */
export const getMissingCallFieldsFromError = (error: unknown): string[] | null => {
  const response = (error as { response?: { status?: number; data?: unknown } } | null | undefined)?.response;

  if (!response || response.status !== 400) {
    return null;
  }

  let text: unknown = response.data;

  if (text && typeof text === 'object') {
    const body = text as Record<string, unknown>;
    text = body.Message ?? body.message ?? body.detail ?? body.title;
  }

  if (typeof text !== 'string') {
    return null;
  }

  let message = text.trim();

  // A JSON-encoded string body that reached us without being parsed.
  if (message.length > 1 && message.startsWith('"') && message.endsWith('"')) {
    try {
      message = String(JSON.parse(message)).trim();
    } catch {
      // Not JSON after all; read it as it is.
    }
  }

  const start = message.toLowerCase().indexOf(MISSING_FIELDS_PREFIX);

  if (start < 0) {
    return null;
  }

  const keys = message
    .slice(start + MISSING_FIELDS_PREFIX.length)
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0)
    .map((key) => toNewCallFieldKey(key) ?? key);

  return keys.length > 0 ? keys : null;
};

/** Where the edit screens' inputs stand at save time, in the shape they submit. */
export interface EditCallFieldInput {
  note?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  what3words?: string;
  plusCode?: string;
  contactName?: string;
  contactInfo?: string;
  externalId?: string;
  incidentId?: string;
  referenceId?: string;
  destinationPoiId?: number | null;
  dispatch?: DispatchListSelection | null;
  /** Protocols the edit adds (EditCall cannot remove the ones already attached). */
  addedProtocolIds?: readonly number[];
  /** Number of protocols already attached to the call, or null when they could not be read. */
  storedProtocolCount?: number | null;
  /** The call the edit links this one to, when one was picked. */
  linkedCallId?: string | null;
}

/** EditCall keeps the stored value for a blank text input, so blank means "what the call already has". */
const textOrStored = (value: string | undefined, stored: string | null | undefined): string => (value && value.trim() ? value : (stored ?? ''));

/** The point already stored on a call: its parsed coordinates, or the raw Geolocation pair. */
const storedGeolocation = (call: CallResultData): string => {
  const latitude = call.Latitude ? parseFloat(call.Latitude) : NaN;
  const longitude = call.Longitude ? parseFloat(call.Longitude) : NaN;
  const fromCoordinates = formatGeolocation(latitude, longitude);

  if (fromCoordinates) {
    return fromCoordinates;
  }

  const [lat, lng] = (call.Geolocation || '').split(',');

  return formatGeolocation(lat ? parseFloat(lat) : undefined, lng ? parseFloat(lng) : undefined);
};

/**
 * The policy values an edit is checked against: what the form will submit, merged with what the call
 * already stores wherever EditCall keeps the stored value (a blank text input, protocols already
 * attached).
 */
export const getEditCallFieldValues = (input: EditCallFieldInput, call: CallResultData): Partial<Record<NewCallFieldKey, unknown>> => ({
  [NewCallFieldKeys.Note]: textOrStored(input.note, call.Note),
  [NewCallFieldKeys.Address]: textOrStored(input.address, call.Address),
  [NewCallFieldKeys.Geolocation]: formatGeolocation(input.latitude, input.longitude) || storedGeolocation(call),
  [NewCallFieldKeys.What3Words]: textOrStored(input.what3words, call.What3Words),
  [NewCallFieldKeys.PlusCode]: input.plusCode,
  [NewCallFieldKeys.ContactName]: textOrStored(input.contactName, call.ContactName),
  [NewCallFieldKeys.ContactInfo]: textOrStored(input.contactInfo, call.ContactInfo),
  [NewCallFieldKeys.ExternalId]: textOrStored(input.externalId, call.ExternalId),
  [NewCallFieldKeys.IncidentId]: textOrStored(input.incidentId, call.IncidentId),
  [NewCallFieldKeys.ReferenceId]: textOrStored(input.referenceId, call.ReferenceId),
  [NewCallFieldKeys.DestinationPoi]: input.destinationPoiId,
  [NewCallFieldKeys.Protocols]: (input.storedProtocolCount ?? 0) > 0 || (input.addedProtocolIds?.length ?? 0) > 0,
  [NewCallFieldKeys.LinkedCall]: !!input.linkedCallId,
  // A blank list on an edit means "everyone" to the server. Requiring an explicit pick (Everyone is one of
  // the options) keeps a list cleared by accident from re-dispatching the whole department.
  [NewCallFieldKeys.DispatchList]: hasDispatchRecipients(input.dispatch),
});

/**
 * The required fields an edit leaves blank, by the same rules EditCall applies:
 * - the dispatch time is never required on an edit;
 * - a pending call's dispatch list is not required (it is decided when the call is dispatched);
 * - indoor location is not enforced, as these screens have no indoor picker and do not send one;
 * - linked call is only known to be satisfied when the edit picks one: the links already on a call
 *   are not part of what the app reads, so an edit that picks none is left to the server, which
 *   counts the existing links and answers with the same message when there are none;
 * - protocols are not judged when the call's attached protocols could not be read.
 */
export const getEditCallMissingFields = (missingRequired: (values: Partial<Record<NewCallFieldKey, unknown>>) => NewCallFieldKey[], input: EditCallFieldInput, call: CallResultData): NewCallFieldKey[] => {
  const isPending = isCallPending(call.State);
  // Unknown, not none: an edit that adds a protocol is satisfied either way and never reaches here.
  const protocolsUnknown = input.storedProtocolCount === null || input.storedProtocolCount === undefined;

  return missingRequired(getEditCallFieldValues(input, call)).filter((key) => {
    switch (key) {
      case NewCallFieldKeys.DispatchOn:
      case NewCallFieldKeys.IndoorLocation:
      case NewCallFieldKeys.LinkedCall:
        return false;
      case NewCallFieldKeys.DispatchList:
        return !isPending;
      case NewCallFieldKeys.Protocols:
        return !protocolsUnknown;
      default:
        return true;
    }
  });
};

/**
 * Leaves every field the policy hides exactly as the call stores it. A hidden field has no input, so
 * whatever the form holds for it is not the dispatcher's choice and must not overwrite the call:
 * - text fields go up blank, which EditCall reads as "keep the stored value";
 * - no point is posted for a hidden location, so the stored one stays (unless the address changes);
 * - the destination is sent as stored, because a missing destination clears it on servers that do
 *   not yet ignore hidden fields;
 * - protocols and linked call are left out, which tells the server this edit does not touch them;
 * - no dispatch time is sent, which keeps the call's schedule.
 *
 * The dispatch list needs nothing here: with its picker hidden the selection is still the one loaded
 * from the call, and sending that back keeps the recipients on every server version (a blank list
 * would mean "everyone" on servers that do not yet ignore hidden fields).
 */
export const keepHiddenEditFieldsUnchanged = (request: UpdateCallRequest, isVisible: (key: NewCallFieldKey) => boolean, call: CallResultData): UpdateCallRequest => {
  const next: UpdateCallRequest = { ...request };

  if (!isVisible(NewCallFieldKeys.Note)) next.note = '';
  if (!isVisible(NewCallFieldKeys.Address)) next.address = '';
  if (!isVisible(NewCallFieldKeys.Geolocation)) {
    next.latitude = undefined;
    next.longitude = undefined;
  }
  if (!isVisible(NewCallFieldKeys.What3Words)) next.what3words = '';
  if (!isVisible(NewCallFieldKeys.PlusCode)) next.plusCode = '';
  if (!isVisible(NewCallFieldKeys.ContactName)) next.contactName = '';
  if (!isVisible(NewCallFieldKeys.ContactInfo)) next.contactInfo = '';
  if (!isVisible(NewCallFieldKeys.ExternalId)) next.externalId = '';
  if (!isVisible(NewCallFieldKeys.IncidentId)) next.incidentId = '';
  if (!isVisible(NewCallFieldKeys.ReferenceId)) next.referenceId = '';
  if (!isVisible(NewCallFieldKeys.DestinationPoi)) next.destinationPoiId = call.DestinationPoiId ?? null;
  if (!isVisible(NewCallFieldKeys.Protocols)) next.protocolIds = undefined;
  if (!isVisible(NewCallFieldKeys.LinkedCall)) next.linkedCallId = undefined;
  if (!isVisible(NewCallFieldKeys.DispatchOn)) next.dispatchOnUtc = undefined;

  return next;
};
