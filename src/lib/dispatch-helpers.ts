import { type UpdateCallRequest } from '@/api/calls/calls';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type DispatchedEventResultData } from '@/models/v4/calls/dispatchedEventResultData';
import { type DispatchSelection } from '@/stores/dispatch/store';

/** An empty dispatch selection — used to reset the picker for a purely-additive "add resources" flow. */
export const EMPTY_DISPATCH_SELECTION: DispatchSelection = { everyone: false, users: [], groups: [], roles: [], units: [] };

/**
 * Maps a call's current dispatches (`GetCallExtraData` → `Dispatches`) into a {@link DispatchSelection}.
 *
 * The server returns each dispatched entity as `{ Type, Id }` where `Id` is the raw entity id
 * (userId / groupId / unitId / roleId). This is the authoritative set of who is already on the call,
 * used to preserve existing dispatches when adding new resources.
 */
export function dispatchesToSelection(dispatches: DispatchedEventResultData[] | undefined | null): DispatchSelection {
  const selection: DispatchSelection = { everyone: false, users: [], groups: [], roles: [], units: [] };

  (dispatches ?? []).forEach((dispatch) => {
    if (!dispatch?.Id) return;
    const type = (dispatch.Type || '').toLowerCase();
    if (type === 'personnel' || type === 'user' || type === 'users' || type === 'p') selection.users.push(dispatch.Id);
    else if (type === 'group' || type === 'groups' || type === 'g') selection.groups.push(dispatch.Id);
    else if (type === 'role' || type === 'roles' || type === 'r') selection.roles.push(dispatch.Id);
    else if (type === 'unit' || type === 'units' || type === 'u') selection.units.push(dispatch.Id);
  });

  return selection;
}

/**
 * Unions the newly-picked resources with the call's existing dispatches, de-duplicating each bucket.
 *
 * This keeps the "dispatch additional resources" action purely additive: existing dispatches are always
 * preserved (never treated as removed by the server's `EditCall` diff), so only the newly-added resources
 * are notified.
 */
export function mergeDispatchSelections(existing: DispatchSelection, added: DispatchSelection): DispatchSelection {
  if (existing.everyone || added.everyone) {
    return { everyone: true, users: [], groups: [], roles: [], units: [] };
  }

  const union = (a: string[], b: string[]) => Array.from(new Set([...a, ...b]));

  return {
    everyone: false,
    users: union(existing.users, added.users),
    groups: union(existing.groups, added.groups),
    roles: union(existing.roles, added.roles),
    units: union(existing.units, added.units),
  };
}

/**
 * Builds an {@link UpdateCallRequest} that adds the picked resources to a call while preserving all of
 * its other fields. The picked resources are unioned with the call's existing dispatches so the server's
 * `EditCall` diff treats them as additions only — notifying just the newly-added resources
 * (`rebroadcastCall` stays false, nothing is reported as cancelled).
 *
 * Shared by the call-detail screens and the dispatch console so every "add resources" entry point
 * submits an identical, field-preserving payload.
 */
export function buildAddResourcesUpdateRequest(
  call: CallResultData,
  existingDispatches: DispatchedEventResultData[] | undefined | null,
  added: DispatchSelection,
  callFormData?: string,
  plusCode?: string
): UpdateCallRequest {
  const merged = mergeDispatchSelections(dispatchesToSelection(existingDispatches), added);

  let latitude: number | undefined;
  let longitude: number | undefined;
  if (call.Latitude && call.Longitude) {
    latitude = parseFloat(call.Latitude);
    longitude = parseFloat(call.Longitude);
  } else if (call.Geolocation) {
    const [lat, lng] = call.Geolocation.split(',');
    latitude = lat ? parseFloat(lat) : undefined;
    longitude = lng ? parseFloat(lng) : undefined;
  }

  return {
    callId: call.CallId,
    name: call.Name,
    nature: call.Nature,
    note: call.Note,
    address: call.Address,
    latitude,
    longitude,
    priority: call.Priority,
    type: call.Type,
    contactName: call.ContactName,
    contactInfo: call.ContactInfo,
    what3words: call.What3Words,
    plusCode,
    // CallFormData is not on CallResultData; thread it from the call's extra data so updateCall
    // (which sends `CallFormData: value || ''`) does not blank an existing form submission.
    callFormData,
    destinationPoiId: call.DestinationPoiId,
    referenceId: call.ReferenceId,
    externalId: call.ExternalId,
    linkedCallId: call.IncidentId,
    dispatchUsers: merged.users,
    dispatchGroups: merged.groups,
    dispatchRoles: merged.roles,
    dispatchUnits: merged.units,
    dispatchEveryone: merged.everyone,
    rebroadcastCall: false,
    notifyCancelledEntities: false,
  };
}
