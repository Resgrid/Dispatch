import { type UpdateCallRequest } from '@/api/calls/calls';
import {
  CALL_FIELD_LABEL_KEYS,
  describeCallFields,
  getEditCallFieldValues,
  getEditCallMissingFields,
  getMissingCallFieldsFromError,
  hasDispatchRecipients,
  keepHiddenEditFieldsUnchanged,
  toNewCallFieldKey,
  toProtocolIds,
} from '@/lib/call-field-policy';
import { CallResultData } from '@/models/v4/calls/callResultData';
import { type NewCallFieldKey, NewCallFieldKeys } from '@/models/v4/calls/newCallFieldPolicyResultData';

const t = (key: string) => `t(${key})`;

const axiosError = (status: number, data?: unknown) => Object.assign(new Error(`Request failed with status code ${status}`), { isAxiosError: true, response: { status, data } });

const storedCall = (overrides: Partial<CallResultData> = {}): CallResultData => Object.assign(new CallResultData(), { CallId: '42', State: 0, ...overrides });

/** Stands in for the hook's missingRequired: every key in `required` that has no value is missing. */
const requiring =
  (...required: NewCallFieldKey[]) =>
  (values: Partial<Record<NewCallFieldKey, unknown>>): NewCallFieldKey[] =>
    required.filter((key) => {
      const value = values[key];
      if (typeof value === 'string') return value.trim().length === 0;
      if (typeof value === 'number') return value === 0;
      if (Array.isArray(value)) return value.length === 0;
      return !value;
    });

describe('call field labels', () => {
  it('has a label for every policy key', () => {
    for (const key of Object.values(NewCallFieldKeys)) {
      expect(CALL_FIELD_LABEL_KEYS[key]).toBeTruthy();
    }
  });

  it('names fields the way the form does, keeping unknown keys as sent', () => {
    expect(describeCallFields([NewCallFieldKeys.ContactInfo, 'LINKEDCALL', 'somethingNew'], t)).toBe('t(calls.contact_info), t(calls.linked_calls.title), somethingNew');
  });

  it('resolves keys in any casing', () => {
    expect(toNewCallFieldKey('contactinfo')).toBe(NewCallFieldKeys.ContactInfo);
    expect(toNewCallFieldKey(' DispatchList ')).toBe(NewCallFieldKeys.DispatchList);
    expect(toNewCallFieldKey('nope')).toBeUndefined();
    expect(toNewCallFieldKey(undefined)).toBeUndefined();
  });
});

describe('hasDispatchRecipients', () => {
  it('is true for everyone or any picked recipient', () => {
    expect(hasDispatchRecipients({ everyone: true, users: [], groups: [], roles: [], units: [] })).toBe(true);
    expect(hasDispatchRecipients({ units: ['5'] })).toBe(true);
  });

  it('is false for an empty or missing selection', () => {
    expect(hasDispatchRecipients({ everyone: false, users: [], groups: [], roles: [], units: [] })).toBe(false);
    expect(hasDispatchRecipients(null)).toBe(false);
  });
});

describe('toProtocolIds', () => {
  it('sends numeric ids once, skipping the picker positional fallbacks', () => {
    expect(toProtocolIds([{ protocolId: '3' }, { protocolId: 'protocol-index-1' }, { protocolId: '7' }, { protocolId: '3' }, { protocolId: '0' }])).toEqual([3, 7]);
  });

  it('is empty for no selection', () => {
    expect(toProtocolIds([])).toEqual([]);
    expect(toProtocolIds(undefined)).toEqual([]);
  });
});

describe('getMissingCallFieldsFromError', () => {
  it('reads the keys from the plain-text 400', () => {
    expect(getMissingCallFieldsFromError(axiosError(400, 'Required call fields are missing: address, contactinfo, mystery'))).toEqual([NewCallFieldKeys.Address, NewCallFieldKeys.ContactInfo, 'mystery']);
  });

  it('reads a JSON-quoted or wrapped body', () => {
    expect(getMissingCallFieldsFromError(axiosError(400, '"Required call fields are missing: note"'))).toEqual([NewCallFieldKeys.Note]);
    expect(getMissingCallFieldsFromError(axiosError(400, { Message: 'Required call fields are missing: protocols' }))).toEqual([NewCallFieldKeys.Protocols]);
  });

  it('is null for any other failure', () => {
    expect(getMissingCallFieldsFromError(axiosError(400, 'LinkedCallId is not a call in this department.'))).toBeNull();
    expect(getMissingCallFieldsFromError(axiosError(500, 'Required call fields are missing: note'))).toBeNull();
    expect(getMissingCallFieldsFromError(axiosError(400, 'Required call fields are missing: '))).toBeNull();
    expect(getMissingCallFieldsFromError(new Error('Network Error'))).toBeNull();
    expect(getMissingCallFieldsFromError(undefined)).toBeNull();
  });
});

describe('getEditCallFieldValues', () => {
  it('falls back to the stored value where EditCall keeps it', () => {
    const call = storedCall({ Note: 'stored note', Address: '1 Main St', ContactName: 'Ann', ContactInfo: '555', What3Words: 'a.b.c', ExternalId: 'EXT', IncidentId: 'INC', ReferenceId: 'REF', Latitude: '39.5', Longitude: '-119.8' });

    const values = getEditCallFieldValues({ note: '  ', address: '', contactName: '', contactInfo: 'new info' }, call);

    expect(values[NewCallFieldKeys.Note]).toBe('stored note');
    expect(values[NewCallFieldKeys.Address]).toBe('1 Main St');
    expect(values[NewCallFieldKeys.ContactName]).toBe('Ann');
    expect(values[NewCallFieldKeys.ContactInfo]).toBe('new info');
    expect(values[NewCallFieldKeys.What3Words]).toBe('a.b.c');
    expect(values[NewCallFieldKeys.ExternalId]).toBe('EXT');
    expect(values[NewCallFieldKeys.IncidentId]).toBe('INC');
    expect(values[NewCallFieldKeys.ReferenceId]).toBe('REF');
    expect(values[NewCallFieldKeys.Geolocation]).toBe('39.5,-119.8');
  });

  it('uses the stored Geolocation pair when the call has no parsed coordinates', () => {
    expect(getEditCallFieldValues({}, storedCall({ Geolocation: '12.5,7.25' }))[NewCallFieldKeys.Geolocation]).toBe('12.5,7.25');
    expect(getEditCallFieldValues({}, storedCall({ Geolocation: ',' }))[NewCallFieldKeys.Geolocation]).toBe('');
  });

  it('counts protocols already attached plus the ones added', () => {
    expect(getEditCallFieldValues({ storedProtocolCount: 1, addedProtocolIds: [] }, storedCall())[NewCallFieldKeys.Protocols]).toBe(true);
    expect(getEditCallFieldValues({ storedProtocolCount: 0, addedProtocolIds: [4] }, storedCall())[NewCallFieldKeys.Protocols]).toBe(true);
    expect(getEditCallFieldValues({ storedProtocolCount: 0, addedProtocolIds: [] }, storedCall())[NewCallFieldKeys.Protocols]).toBe(false);
  });
});

describe('getEditCallMissingFields', () => {
  it('reports a required field the edit would leave blank', () => {
    const missing = getEditCallMissingFields(requiring(NewCallFieldKeys.ContactInfo, NewCallFieldKeys.Address), { contactInfo: '', address: '' }, storedCall({ Address: '1 Main St' }));

    expect(missing).toEqual([NewCallFieldKeys.ContactInfo]);
  });

  it('checks the identifiers as typed, falling back to what the call stores', () => {
    const required = requiring(NewCallFieldKeys.ExternalId, NewCallFieldKeys.IncidentId, NewCallFieldKeys.ReferenceId);
    const call = storedCall({ ExternalId: 'EXT', IncidentId: '', ReferenceId: '' });

    expect(getEditCallMissingFields(required, { externalId: '', incidentId: '', referenceId: 'REF-9' }, call)).toEqual([NewCallFieldKeys.IncidentId]);
    expect(getEditCallMissingFields(required, { externalId: '', incidentId: 'INC-9', referenceId: 'REF-9' }, call)).toEqual([]);
  });

  it('never requires the dispatch time, indoor location or (unpicked) linked call on an edit', () => {
    const missing = getEditCallMissingFields(requiring(NewCallFieldKeys.DispatchOn, NewCallFieldKeys.IndoorLocation, NewCallFieldKeys.LinkedCall), {}, storedCall());

    expect(missing).toEqual([]);
  });

  it('requires recipients on a dispatched call but not on a pending one', () => {
    const empty = { everyone: false, users: [], groups: [], roles: [], units: [] };

    expect(getEditCallMissingFields(requiring(NewCallFieldKeys.DispatchList), { dispatch: empty }, storedCall({ State: 0 }))).toEqual([NewCallFieldKeys.DispatchList]);
    expect(getEditCallMissingFields(requiring(NewCallFieldKeys.DispatchList), { dispatch: empty }, storedCall({ State: 8 }))).toEqual([]);
    expect(getEditCallMissingFields(requiring(NewCallFieldKeys.DispatchList), { dispatch: { ...empty, units: ['5'] } }, storedCall({ State: 0 }))).toEqual([]);
  });

  it('requires a protocol only when the attached ones are known', () => {
    expect(getEditCallMissingFields(requiring(NewCallFieldKeys.Protocols), { storedProtocolCount: 0, addedProtocolIds: [] }, storedCall())).toEqual([NewCallFieldKeys.Protocols]);
    expect(getEditCallMissingFields(requiring(NewCallFieldKeys.Protocols), { storedProtocolCount: 2, addedProtocolIds: [] }, storedCall())).toEqual([]);
    expect(getEditCallMissingFields(requiring(NewCallFieldKeys.Protocols), { storedProtocolCount: null, addedProtocolIds: [] }, storedCall())).toEqual([]);
  });
});

describe('keepHiddenEditFieldsUnchanged', () => {
  const request: UpdateCallRequest = {
    callId: '42',
    name: 'Fire',
    nature: 'Smoke',
    priority: 1,
    note: 'typed note',
    address: '2 Side St',
    latitude: 39.5,
    longitude: -119.8,
    contactName: 'Ann',
    contactInfo: '555',
    destinationPoiId: null,
    protocolIds: [3],
    linkedCallId: '17',
    externalId: 'EXT-2',
    incidentId: 'INC-2',
    referenceId: 'REF-2',
    dispatchOnUtc: '2026-10-09T14:30:00.000Z',
    dispatchUnits: ['5'],
  };

  it('leaves a request alone when everything is visible', () => {
    expect(keepHiddenEditFieldsUnchanged(request, () => true, storedCall({ DestinationPoiId: 9 }))).toEqual(request);
  });

  it('sends hidden fields as unchanged and keeps the stored destination', () => {
    const hidden = new Set<NewCallFieldKey>([
      NewCallFieldKeys.Note,
      NewCallFieldKeys.Address,
      NewCallFieldKeys.Geolocation,
      NewCallFieldKeys.ContactName,
      NewCallFieldKeys.ContactInfo,
      NewCallFieldKeys.DestinationPoi,
      NewCallFieldKeys.Protocols,
      NewCallFieldKeys.LinkedCall,
      NewCallFieldKeys.DispatchList,
      NewCallFieldKeys.ExternalId,
      NewCallFieldKeys.IncidentId,
      NewCallFieldKeys.ReferenceId,
      NewCallFieldKeys.DispatchOn,
    ]);

    const result = keepHiddenEditFieldsUnchanged(request, (key) => !hidden.has(key), storedCall({ DestinationPoiId: 9 }));

    expect(result.externalId).toBe('');
    expect(result.incidentId).toBe('');
    expect(result.referenceId).toBe('');
    // No time sent keeps the call's schedule.
    expect(result.dispatchOnUtc).toBeUndefined();

    expect(result.note).toBe('');
    expect(result.address).toBe('');
    expect(result.latitude).toBeUndefined();
    expect(result.longitude).toBeUndefined();
    expect(result.contactName).toBe('');
    expect(result.contactInfo).toBe('');
    expect(result.destinationPoiId).toBe(9);
    expect(result.protocolIds).toBeUndefined();
    expect(result.linkedCallId).toBeUndefined();
    // The recipients loaded from the call go back unchanged rather than blank ("everyone").
    expect(result.dispatchUnits).toEqual(['5']);
    // Untouched fields keep their values.
    expect(result.name).toBe('Fire');
  });
});
