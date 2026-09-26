import { describe, expect, it } from '@jest/globals';

import { type StatusesResultData } from '@/models/v4/statuses/statusesResultData';
import { type UnitTypeStatusResultData } from '@/models/v4/statuses/unitTypeStatusResultData';

import { resolveUnitStatusOptions } from '../unit-status-helpers';

const status = (Id: number, Text: string, Detail: number): StatusesResultData => ({ Id, Type: 3, StateId: 0, Text, BColor: '', Color: '', Gps: false, Note: 0, Detail }) as StatusesResultData;

// The department default group ("0") as served by /Statuses/GetAllUnitStatuses, with real Detail types
const defaultGroup: UnitTypeStatusResultData = {
  UnitType: '0',
  StatusId: '',
  Statuses: [status(0, 'Available', 1), status(3, 'Responding', 2), status(6, 'On Scene', 2), status(8, 'Staging', 2)],
};

const engineGroup: UnitTypeStatusResultData = {
  UnitType: 'Engine',
  StatusId: '42',
  Statuses: [status(100, 'Engine Responding', 2), status(101, 'Engine In Quarters', 1)],
};

// What an older server returns from /Dispatch/GetSetUnitStatusData for a unit without a custom set: all Detail 0
const legacyServerList = [status(0, 'Available', 0), status(3, 'Responding', 0), status(6, 'On Scene', 0)];

describe('resolveUnitStatusOptions', () => {
  it('returns the custom status set matched by CustomStatusSetId', () => {
    expect(resolveUnitStatusOptions({ CustomStatusSetId: '42', Type: 'Something Else' }, [defaultGroup, engineGroup], legacyServerList)).toBe(engineGroup.Statuses);
  });

  it('returns the custom status set matched by unit type name', () => {
    expect(resolveUnitStatusOptions({ CustomStatusSetId: '', Type: 'Engine' }, [defaultGroup, engineGroup], legacyServerList)).toBe(engineGroup.Statuses);
  });

  it('prefers the department default group over the per-unit server list for a unit without a custom set', () => {
    const options = resolveUnitStatusOptions({ CustomStatusSetId: '', Type: 'Ladder' }, [defaultGroup, engineGroup], legacyServerList);

    expect(options).toBe(defaultGroup.Statuses);
    // Responding / On Scene / Staging accept a call destination
    expect(options.filter((s) => s.Detail === 2).map((s) => s.Text)).toEqual(['Responding', 'On Scene', 'Staging']);
  });

  it('prefers the default group when the unit has no type at all', () => {
    expect(resolveUnitStatusOptions({ CustomStatusSetId: '', Type: '' }, [defaultGroup], legacyServerList)).toBe(defaultGroup.Statuses);
  });

  it('falls back to the per-unit server list only when there is no default group', () => {
    expect(resolveUnitStatusOptions({ CustomStatusSetId: '', Type: 'Ladder' }, [engineGroup], legacyServerList)).toBe(legacyServerList);
    expect(resolveUnitStatusOptions({ CustomStatusSetId: '', Type: 'Ladder' }, undefined, legacyServerList)).toBe(legacyServerList);
    expect(resolveUnitStatusOptions({ CustomStatusSetId: '', Type: 'Ladder' }, [{ ...defaultGroup, Statuses: [] }], legacyServerList)).toBe(legacyServerList);
  });

  it('returns an empty list when nothing is available', () => {
    expect(resolveUnitStatusOptions(null, [], [])).toEqual([]);
  });
});
