import { describe, expect, it } from '@jest/globals';

import { type StatusesResultData } from '@/models/v4/statuses/statusesResultData';
import { type UnitTypeStatusResultData } from '@/models/v4/statuses/unitTypeStatusResultData';

import { CustomStateDetailType } from '../destination-helpers';
import { resolveCommonUnitStatusOptions, resolveUnitStatusOptions } from '../unit-status-helpers';

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

describe('resolveCommonUnitStatusOptions', () => {
  // Belgian EMS: the ambulance (ZW) and the emergency physician unit (MUG) have their own status sets with the same statuses
  const noted = (Id: number, Text: string, Detail: number, Note: number): StatusesResultData => ({ ...status(Id, Text, Detail), Note }) as StatusesResultData;
  const ambulanceGroup: UnitTypeStatusResultData = {
    UnitType: 'Ziekenwagen',
    StatusId: '10',
    Statuses: [status(200, 'Ter Plaatse', 2), status(201, 'Vertrek naar ziekenhuis', 4), status(202, 'In ziekenhuis', 4), noted(203, 'Patiënt geweigerd', 0, 2)],
  };
  const mugGroup: UnitTypeStatusResultData = {
    UnitType: 'MUG',
    StatusId: '11',
    Statuses: [status(300, 'ter plaatse ', 2), status(301, 'Vertrek naar ziekenhuis', 5), status(302, 'In ziekenhuis', 4), noted(303, 'Patiënt geweigerd', 0, 1), status(304, 'MUG Only', 0)],
  };
  const ambulance = { UnitId: 'zw', CustomStatusSetId: '10', Type: 'Ziekenwagen' };
  const mug = { UnitId: 'mug', CustomStatusSetId: '11', Type: 'MUG' };

  it('offers only the statuses every unit has, matched by text, in the first unit’s order', () => {
    const options = resolveCommonUnitStatusOptions([ambulance, mug], [ambulanceGroup, mugGroup]);

    expect(options.map((o) => o.status.Text)).toEqual(['Ter Plaatse', 'Vertrek naar ziekenhuis', 'In ziekenhuis', 'Patiënt geweigerd']);
  });

  it('keeps each unit’s own status id for the shared status', () => {
    const [onScene] = resolveCommonUnitStatusOptions([ambulance, mug], [ambulanceGroup, mugGroup]);

    expect(onScene.statusByUnitId.zw.Id).toBe(200);
    expect(onScene.statusByUnitId.mug.Id).toBe(300);
  });

  it('offers every destination kind any unit’s status takes, and requires a note when any unit’s status does', () => {
    const options = resolveCommonUnitStatusOptions([ambulance, mug], [ambulanceGroup, mugGroup]);
    const departing = options.find((o) => o.key === 'vertrek naar ziekenhuis')!;
    const refused = options.find((o) => o.key === 'patiënt geweigerd')!;

    expect(departing.detail).toBe(CustomStateDetailType.CallsAndPois);
    expect(refused.noteRequired).toBe(true);
    expect(options.find((o) => o.key === 'ter plaatse')!.noteRequired).toBe(false);
  });

  it('gives units of the same status set the full set', () => {
    const options = resolveCommonUnitStatusOptions([ambulance, { ...ambulance, UnitId: 'zw2' }], [ambulanceGroup, mugGroup]);

    expect(options).toHaveLength(ambulanceGroup.Statuses.length);
  });

  it('returns nothing for no units', () => {
    expect(resolveCommonUnitStatusOptions([], [ambulanceGroup])).toEqual([]);
  });

  it('uses a per-unit fallback list only for the unit it was fetched for', () => {
    const ambulanceOwnList = ambulanceGroup.Statuses;

    // Without the grouped statuses, the MUG has no list of its own: the ambulance's ids are never sent for it
    expect(resolveCommonUnitStatusOptions([ambulance, mug], undefined, { zw: ambulanceOwnList })).toEqual([]);

    const [onScene] = resolveCommonUnitStatusOptions([ambulance, mug], undefined, { zw: ambulanceOwnList, mug: mugGroup.Statuses });
    expect(onScene.statusByUnitId.zw.Id).toBe(200);
    expect(onScene.statusByUnitId.mug.Id).toBe(300);
  });
});
