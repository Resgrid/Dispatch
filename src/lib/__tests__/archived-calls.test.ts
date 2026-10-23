import { type CallResultData } from '@/models/v4/calls/callResultData';

import {
  type ArchivedCallForm,
  archivedCallStateLabelKey,
  archivedCallTypes,
  buildArchivedCallRequest,
  countActiveArchivedCallFilters,
  EMPTY_ARCHIVED_CALL_FILTERS,
  filterArchivedCalls,
} from '../archived-calls';

const call = (overrides: Partial<CallResultData>): CallResultData =>
  ({
    CallId: '1',
    Number: '26-1',
    Name: 'Structure Fire',
    Nature: 'Smoke showing',
    Note: '',
    Address: '1 Main St',
    Type: 'Fire',
    Priority: 1,
    State: 1,
    LoggedOn: '2026-03-05T14:22:00',
    LoggedOnUtc: '2026-03-05T22:22:00',
    ...overrides,
  }) as CallResultData;

const calls = [
  call({ CallId: '1', Number: '26-1', Name: 'Structure Fire', Type: 'Fire', Priority: 1, State: 1, LoggedOn: '2026-01-10T08:00:00' }),
  call({ CallId: '2', Number: '26-2', Name: 'Welfare check', Nature: 'Adult in distress', Address: 'Exposition Park', Type: 'EMS', Priority: 2, State: 2, LoggedOn: '2026-02-14T12:00:00', IncidentId: 'INC-77' }),
  call({ CallId: '3', Number: '26-3', Name: 'Alarm', Nature: 'Commercial alarm', Type: 'Fire', Priority: 3, State: 7, LoggedOn: '2026-03-01T23:59:00', ContactName: 'Jordan Lee' }),
];

const ids = (list: CallResultData[]) => list.map((c) => c.CallId);

describe('filterArchivedCalls', () => {
  it('keeps every call with no filters', () => {
    expect(ids(filterArchivedCalls(calls, EMPTY_ARCHIVED_CALL_FILTERS))).toEqual(['1', '2', '3']);
  });

  it('matches every word of the search across the call, case-insensitively', () => {
    expect(ids(filterArchivedCalls(calls, { ...EMPTY_ARCHIVED_CALL_FILTERS, query: 'exposition DISTRESS' }))).toEqual(['2']);
    expect(ids(filterArchivedCalls(calls, { ...EMPTY_ARCHIVED_CALL_FILTERS, query: 'inc-77' }))).toEqual(['2']);
    expect(ids(filterArchivedCalls(calls, { ...EMPTY_ARCHIVED_CALL_FILTERS, query: 'jordan' }))).toEqual(['3']);
    expect(ids(filterArchivedCalls(calls, { ...EMPTY_ARCHIVED_CALL_FILTERS, query: '26-3' }))).toEqual(['3']);
    expect(ids(filterArchivedCalls(calls, { ...EMPTY_ARCHIVED_CALL_FILTERS, query: 'fire distress' }))).toEqual([]);
  });

  it('filters by close type, priority and type', () => {
    expect(ids(filterArchivedCalls(calls, { ...EMPTY_ARCHIVED_CALL_FILTERS, states: [2, 7] }))).toEqual(['2', '3']);
    expect(ids(filterArchivedCalls(calls, { ...EMPTY_ARCHIVED_CALL_FILTERS, priorities: [1] }))).toEqual(['1']);
    expect(ids(filterArchivedCalls(calls, { ...EMPTY_ARCHIVED_CALL_FILTERS, types: ['Fire'] }))).toEqual(['1', '3']);
    expect(ids(filterArchivedCalls(calls, { ...EMPTY_ARCHIVED_CALL_FILTERS, types: ['Fire'], states: [1] }))).toEqual(['1']);
  });

  it('reads a state sent as a numeric string', () => {
    expect(ids(filterArchivedCalls([call({ CallId: '9', State: '3' })], { ...EMPTY_ARCHIVED_CALL_FILTERS, states: [3] }))).toEqual(['9']);
  });

  it('filters by the department-local day the call was logged, both ends inclusive', () => {
    expect(ids(filterArchivedCalls(calls, { ...EMPTY_ARCHIVED_CALL_FILTERS, fromDate: '2026-02-14' }))).toEqual(['2', '3']);
    expect(ids(filterArchivedCalls(calls, { ...EMPTY_ARCHIVED_CALL_FILTERS, toDate: '2026-02-14' }))).toEqual(['1', '2']);
    // 23:59 local on March 1st is still March 1st, whatever the UTC date.
    expect(ids(filterArchivedCalls(calls, { ...EMPTY_ARCHIVED_CALL_FILTERS, fromDate: '2026-03-01', toDate: '2026-03-01' }))).toEqual(['3']);
  });

  it('counts the filters that narrow the list, not the search text', () => {
    expect(countActiveArchivedCallFilters({ ...EMPTY_ARCHIVED_CALL_FILTERS, query: 'fire' })).toBe(0);
    expect(countActiveArchivedCallFilters({ ...EMPTY_ARCHIVED_CALL_FILTERS, states: [1], types: ['Fire'], fromDate: '2026-01-01', toDate: '2026-02-01' })).toBe(3);
  });
});

describe('archivedCallTypes', () => {
  it('lists the distinct types the calls carry, A-Z', () => {
    expect(archivedCallTypes([...calls, call({ CallId: '4', Type: '' })])).toEqual(['EMS', 'Fire']);
  });
});

describe('archivedCallStateLabelKey', () => {
  it('names the close types and nothing else', () => {
    expect(archivedCallStateLabelKey(1)).toBe('call_detail.close_call_types.closed');
    expect(archivedCallStateLabelKey('7')).toBe('call_detail.close_call_types.false_alarm');
    expect(archivedCallStateLabelKey(0)).toBeNull();
    expect(archivedCallStateLabelKey(8)).toBeNull();
  });
});

describe('buildArchivedCallRequest', () => {
  const now = Date.parse('2026-10-23T16:00:00Z');
  const form = (overrides: Partial<ArchivedCallForm> = {}): ArchivedCallForm => ({
    name: ' Structure Fire ',
    nature: 'Smoke showing',
    note: '',
    priority: '2',
    type: 'Fire',
    address: '1 Main St',
    latitude: '',
    longitude: '',
    contactName: '',
    contactInfo: '',
    incidentId: '',
    referenceId: '',
    externalId: '',
    loggedOn: '2026-10-01T10:00:00.000Z',
    closedOn: '',
    state: '1',
    closedNotes: 'Knocked down',
    recalculateCallNumbers: false,
    dispatch: { everyone: false, users: ['u1'], groups: [], roles: [], units: ['5'] },
    ...overrides,
  });

  const errorOf = (overrides: Partial<ArchivedCallForm>) => {
    const result = buildArchivedCallRequest(form(overrides), now);
    return 'errorKey' in result ? result.errorKey : null;
  };

  it('builds the request from a complete form', () => {
    const result = buildArchivedCallRequest(form({ closedOn: '2026-10-01T11:30:00.000Z', recalculateCallNumbers: true }), now);

    expect(result).toEqual({
      request: expect.objectContaining({
        name: 'Structure Fire',
        nature: 'Smoke showing',
        note: undefined,
        address: '1 Main St',
        latitude: undefined,
        longitude: undefined,
        priority: 2,
        type: 'Fire',
        dispatchEveryone: false,
        dispatchUsers: ['u1'],
        dispatchUnits: ['5'],
        loggedOnUtc: '2026-10-01T10:00:00.000Z',
        closedOnUtc: '2026-10-01T11:30:00.000Z',
        state: 1,
        closedNotes: 'Knocked down',
        recalculateCallNumbers: true,
      }),
    });
  });

  it('leaves the close time to the server when none was picked, and sends no type for "no type"', () => {
    const result = buildArchivedCallRequest(form({ type: '' }), now);

    expect('request' in result && result.request.closedOnUtc).toBeUndefined();
    expect('request' in result && result.request.type).toBeUndefined();
  });

  it('requires a name, a nature, a priority and a close type', () => {
    expect(errorOf({ name: '  ' })).toBe('archived_calls.name_required');
    expect(errorOf({ nature: '' })).toBe('archived_calls.nature_required');
    expect(errorOf({ priority: '' })).toBe('archived_calls.priority_required');
    expect(errorOf({ state: '0' })).toBe('archived_calls.state_required');
    expect(errorOf({ state: '8' })).toBe('archived_calls.state_required');
  });

  it('refuses a call logged in the future, or closed before it was logged or in the future', () => {
    expect(errorOf({ loggedOn: '' })).toBe('archived_calls.logged_on_required');
    expect(errorOf({ loggedOn: '2026-10-24T10:00:00.000Z' })).toBe('archived_calls.logged_on_future');
    expect(errorOf({ closedOn: '2026-10-01T09:59:00.000Z' })).toBe('archived_calls.closed_on_before_logged');
    expect(errorOf({ closedOn: '2026-10-24T10:00:00.000Z' })).toBe('archived_calls.closed_on_future');
    // A little clock drift is not the future.
    expect(errorOf({ loggedOn: '2026-10-23T16:02:00.000Z' })).toBeNull();
  });

  it('takes both coordinates or neither', () => {
    expect(errorOf({ latitude: '39.12' })).toBe('archived_calls.coordinates_invalid');
    expect(errorOf({ latitude: '91', longitude: '10' })).toBe('archived_calls.coordinates_invalid');
    expect(errorOf({ latitude: 'abc', longitude: '10' })).toBe('archived_calls.coordinates_invalid');

    const result = buildArchivedCallRequest(form({ latitude: ' 39.122639 ', longitude: '-119.758773' }), now);
    expect('request' in result && [result.request.latitude, result.request.longitude]).toEqual([39.122639, -119.758773]);
  });
});
