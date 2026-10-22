import { describe, expect, it } from '@jest/globals';

import { ActionBaseTypes } from '@/lib/base-types';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type PoiResultData } from '@/models/v4/mapping/poiResultData';

import { CustomStateDetailType, type DestinationSelectionState, isTransportStatus, resolveTransportDestinationPoi } from '../destination-helpers';

const poi = (PoiId: number, Name: string): PoiResultData => ({ PoiId, Name, Address: '', Note: '', PoiTypeName: 'Hospital' }) as PoiResultData;
const zottegem = poi(11, 'AZ Sint-Elisabeth Zottegem');
const uzGent = poi(12, 'UZ Gent');
const availablePois = [zottegem, uzGent];

const call = { CallId: 'A', Number: '20-10-2026-4', Name: 'AGRESSIE', DestinationPoiId: 11 } as CallResultData;

const onCall: DestinationSelectionState = { selectedDestinationType: 'call', selectedCall: call, selectedStation: null, selectedPoi: null };
const noDestination: DestinationSelectionState = { selectedDestinationType: 'none', selectedCall: null, selectedStation: null, selectedPoi: null };
const toPoi = (selected: PoiResultData): DestinationSelectionState => ({ selectedDestinationType: 'poi', selectedCall: null, selectedStation: null, selectedPoi: selected });

const status = (Detail: number, BaseType?: number | null) => ({ Detail, BaseType });

describe('isTransportStatus', () => {
  it('is true for Transporting and At Hospital only', () => {
    expect(isTransportStatus(ActionBaseTypes.Transporting)).toBe(true);
    expect(isTransportStatus(ActionBaseTypes.AtHospital)).toBe(true);
    expect(isTransportStatus(ActionBaseTypes.OnScene)).toBe(false);
    expect(isTransportStatus(ActionBaseTypes.None)).toBe(false);
    expect(isTransportStatus(undefined)).toBe(false);
    expect(isTransportStatus(null)).toBe(false);
  });
});

describe('resolveTransportDestinationPoi', () => {
  it("defaults a Transporting status to the call's destination POI, replacing the call", () => {
    expect(resolveTransportDestinationPoi({ status: status(CustomStateDetailType.CallsAndPois, ActionBaseTypes.Transporting), selection: onCall, callDestinationPoiId: 11, availablePois })).toBe(zottegem);
  });

  it('defaults At Hospital the same way', () => {
    expect(resolveTransportDestinationPoi({ status: status(CustomStateDetailType.Pois, ActionBaseTypes.AtHospital), selection: onCall, callDestinationPoiId: 11, availablePois })).toBe(zottegem);
  });

  it('prefers the POI the unit is already transporting to over the call destination', () => {
    expect(resolveTransportDestinationPoi({ status: status(CustomStateDetailType.Pois, ActionBaseTypes.AtHospital), selection: onCall, callDestinationPoiId: 11, transportPoiId: '12', availablePois })).toBe(uzGent);
  });

  it("keeps a POI already chosen (the crew's change of hospital)", () => {
    expect(resolveTransportDestinationPoi({ status: status(CustomStateDetailType.Pois, ActionBaseTypes.AtHospital), selection: toPoi(uzGent), callDestinationPoiId: 11, availablePois })).toBeNull();
  });

  it('does not touch a status that takes no POIs', () => {
    expect(resolveTransportDestinationPoi({ status: status(CustomStateDetailType.Calls, ActionBaseTypes.Transporting), selection: onCall, callDestinationPoiId: 11, availablePois })).toBeNull();
  });

  it('keeps the call for a status with another meaning', () => {
    expect(resolveTransportDestinationPoi({ status: status(CustomStateDetailType.CallsAndPois, ActionBaseTypes.Responding), selection: onCall, callDestinationPoiId: 11, availablePois })).toBeNull();
    expect(resolveTransportDestinationPoi({ status: status(CustomStateDetailType.Pois, ActionBaseTypes.OnScene), selection: onCall, callDestinationPoiId: 11, availablePois })).toBeNull();
  });

  describe('for a status the department has given no meaning', () => {
    it('fills in the call destination when the status would otherwise go without one', () => {
      expect(resolveTransportDestinationPoi({ status: status(CustomStateDetailType.Pois), selection: onCall, callDestinationPoiId: 11, availablePois })).toBe(zottegem);
      expect(resolveTransportDestinationPoi({ status: status(CustomStateDetailType.Pois, ActionBaseTypes.None), selection: noDestination, callDestinationPoiId: 11, availablePois })).toBe(zottegem);
    });

    it('keeps a call the status takes', () => {
      expect(resolveTransportDestinationPoi({ status: status(CustomStateDetailType.CallsAndPois), selection: onCall, callDestinationPoiId: 11, availablePois })).toBeNull();
    });
  });

  it('keeps an explicit call context for a status with no meaning, but not for a transport status', () => {
    expect(resolveTransportDestinationPoi({ status: status(CustomStateDetailType.Pois), selection: onCall, hasCallContext: true, callDestinationPoiId: 11, availablePois })).toBeNull();
    expect(resolveTransportDestinationPoi({ status: status(CustomStateDetailType.Pois, ActionBaseTypes.Transporting), selection: onCall, hasCallContext: true, callDestinationPoiId: 11, availablePois })).toBe(zottegem);
  });

  it('never picks a POI the status cannot go to', () => {
    expect(resolveTransportDestinationPoi({ status: status(CustomStateDetailType.Pois, ActionBaseTypes.Transporting), selection: onCall, callDestinationPoiId: 99, availablePois })).toBeNull();
    expect(resolveTransportDestinationPoi({ status: status(CustomStateDetailType.Pois, ActionBaseTypes.Transporting), selection: onCall, callDestinationPoiId: null, availablePois })).toBeNull();
  });
});
