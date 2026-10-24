import { type CreateArchivedCallRequest } from '@/api/calls/calls';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type DispatchSelection } from '@/stores/dispatch/store';

import { parseCoordinateEntry } from './call-coordinates';
import { CallState } from './utils';

/** The close types an archived call can have, Closed (1) through False Alarm (7), with the close sheet's labels. */
export const ARCHIVED_CALL_STATES: readonly { value: number; labelKey: string }[] = [
  { value: CallState.CLOSED, labelKey: 'call_detail.close_call_types.closed' },
  { value: CallState.CANCELLED, labelKey: 'call_detail.close_call_types.cancelled' },
  { value: CallState.UNFOUNDED, labelKey: 'call_detail.close_call_types.unfounded' },
  { value: CallState.FOUNDED, labelKey: 'call_detail.close_call_types.founded' },
  { value: CallState.MINOR, labelKey: 'call_detail.close_call_types.minor' },
  { value: CallState.TRANSFERRED, labelKey: 'call_detail.close_call_types.transferred' },
  { value: CallState.FALSE_ALARM, labelKey: 'call_detail.close_call_types.false_alarm' },
];

/** The translation key for an archived call's close type, or null for a state that is not one. */
export const archivedCallStateLabelKey = (state: number | string | null | undefined): string | null => ARCHIVED_CALL_STATES.find((s) => s.value === Number(state))?.labelKey ?? null;

export interface ArchivedCallFilters {
  /** Free text; every word must appear somewhere in the call (number, name, nature, notes, address, ids, contact). */
  query: string;
  /** Close types to keep; empty keeps all. */
  states: number[];
  /** Priority ids to keep; empty keeps all. */
  priorities: number[];
  /** Call type names to keep; empty keeps all. */
  types: string[];
  /** First day (YYYY-MM-DD, the department's calendar) a call may have been logged on; empty for no limit. */
  fromDate: string;
  /** Last day (YYYY-MM-DD) a call may have been logged on; empty for no limit. */
  toDate: string;
}

export const EMPTY_ARCHIVED_CALL_FILTERS: ArchivedCallFilters = { query: '', states: [], priorities: [], types: [], fromDate: '', toDate: '' };

/** How many of the filters narrow the list, the search text not counted. */
export const countActiveArchivedCallFilters = (filters: ArchivedCallFilters): number =>
  (filters.states.length > 0 ? 1 : 0) + (filters.priorities.length > 0 ? 1 : 0) + (filters.types.length > 0 ? 1 : 0) + (filters.fromDate || filters.toDate ? 1 : 0);

const searchableText = (call: CallResultData): string =>
  [call.Number, call.CallId, call.Name, call.Nature, call.Note, call.Address, call.Type, call.DestinationName, call.IncidentId, call.ReferenceId, call.ExternalId, call.ContactName, call.ContactInfo]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join('\n')
    .toLowerCase();

/**
 * The calendar day a call was logged, YYYY-MM-DD in the department's time (LoggedOn is department-local), so a
 * date filter means the same day the dispatcher sees in the list.
 */
const loggedOnDay = (call: CallResultData): string => (call.LoggedOn || call.LoggedOnUtc || '').slice(0, 10);

/** The calls that pass every filter, in the order given. */
export const filterArchivedCalls = (calls: readonly CallResultData[], filters: ArchivedCallFilters): CallResultData[] => {
  const terms = filters.query.toLowerCase().split(/\s+/).filter(Boolean);
  const states = new Set(filters.states);
  const priorities = new Set(filters.priorities);
  const types = new Set(filters.types);

  return calls.filter((call) => {
    if (states.size > 0 && !states.has(Number(call.State))) return false;
    if (priorities.size > 0 && !priorities.has(call.Priority)) return false;
    if (types.size > 0 && !types.has(call.Type || '')) return false;

    if (filters.fromDate || filters.toDate) {
      const day = loggedOnDay(call);
      if (!day) return false;
      if (filters.fromDate && day < filters.fromDate) return false;
      if (filters.toDate && day > filters.toDate) return false;
    }

    if (terms.length > 0) {
      const text = searchableText(call);
      return terms.every((term) => text.includes(term));
    }

    return true;
  });
};

/** The call types the loaded calls carry, A-Z: archived calls can have types the department has since removed. */
export const archivedCallTypes = (calls: readonly CallResultData[]): string[] =>
  Array.from(new Set(calls.map((call) => call.Type).filter((type): type is string => typeof type === 'string' && type.length > 0))).sort((a, b) => a.localeCompare(b));

/** The Add Archived Call form, as entered. Dates are ISO instants from the date-time picker; '' when not picked. */
export interface ArchivedCallForm {
  name: string;
  nature: string;
  note: string;
  priority: string;
  type: string;
  address: string;
  latitude: string;
  longitude: string;
  contactName: string;
  contactInfo: string;
  incidentId: string;
  referenceId: string;
  externalId: string;
  loggedOn: string;
  closedOn: string;
  state: string;
  closedNotes: string;
  recalculateCallNumbers: boolean;
  dispatch: DispatchSelection;
}

/** How far ahead of this device's clock a time may be and still count as now (clocks drift). */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * The save request for the form, or the translation key of the first thing wrong with it. Mirrors the server's
 * checks so a dispatcher hears about a time in the future or a close before the call before anything is sent.
 */
export const buildArchivedCallRequest = (form: ArchivedCallForm, now: number = Date.now()): { request: CreateArchivedCallRequest } | { errorKey: string } => {
  if (!form.name.trim()) return { errorKey: 'archived_calls.name_required' };
  if (!form.nature.trim()) return { errorKey: 'archived_calls.nature_required' };

  const priority = Number(form.priority);
  if (form.priority === '' || !Number.isInteger(priority)) return { errorKey: 'archived_calls.priority_required' };

  const state = Number(form.state);
  if (!ARCHIVED_CALL_STATES.some((s) => s.value === state)) return { errorKey: 'archived_calls.state_required' };

  const loggedOn = Date.parse(form.loggedOn);
  if (!form.loggedOn || Number.isNaN(loggedOn)) return { errorKey: 'archived_calls.logged_on_required' };
  if (loggedOn > now + CLOCK_SKEW_MS) return { errorKey: 'archived_calls.logged_on_future' };

  const closedOn = form.closedOn ? Date.parse(form.closedOn) : null;
  if (closedOn !== null) {
    if (Number.isNaN(closedOn)) return { errorKey: 'archived_calls.closed_on_invalid' };
    if (closedOn < loggedOn) return { errorKey: 'archived_calls.closed_on_before_logged' };
    if (closedOn > now + CLOCK_SKEW_MS) return { errorKey: 'archived_calls.closed_on_future' };
  }

  // Both or neither, in decimal degrees as the new and edit call screens take them: one coordinate alone is not a place.
  const coordinates = parseCoordinateEntry(form.latitude, form.longitude);
  if (coordinates.status === 'invalid' || coordinates.status === 'incomplete') return { errorKey: 'archived_calls.coordinates_invalid' };
  const latitude = coordinates.status === 'valid' ? coordinates.latitude : undefined;
  const longitude = coordinates.status === 'valid' ? coordinates.longitude : undefined;

  return {
    request: {
      name: form.name.trim(),
      nature: form.nature.trim(),
      note: form.note.trim() || undefined,
      address: form.address.trim() || undefined,
      latitude,
      longitude,
      priority,
      type: form.type || undefined,
      contactName: form.contactName.trim() || undefined,
      contactInfo: form.contactInfo.trim() || undefined,
      incidentId: form.incidentId.trim() || undefined,
      referenceId: form.referenceId.trim() || undefined,
      externalId: form.externalId.trim() || undefined,
      dispatchEveryone: form.dispatch.everyone,
      dispatchUsers: form.dispatch.users,
      dispatchGroups: form.dispatch.groups,
      dispatchRoles: form.dispatch.roles,
      dispatchUnits: form.dispatch.units,
      loggedOnUtc: new Date(loggedOn).toISOString(),
      closedOnUtc: closedOn !== null ? new Date(closedOn).toISOString() : undefined,
      state,
      closedNotes: form.closedNotes.trim() || undefined,
      recalculateCallNumbers: form.recalculateCallNumbers,
    },
  };
};
