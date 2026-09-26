import { describe, expect, it } from '@jest/globals';

import {
  CustomStateDetailType,
  DestinationEntityType,
  MapMarkerEntityType,
  getDefaultDestinationTab,
  getDestinationCapabilities,
  getDestinationSelectionTypeFromValue,
  getDestinationSelectionTypeValue,
  getEffectiveDestinationType,
  getEnabledDestinationTabs,
  getSelectedDestinationId,
  getStatusDestinationCapabilities,
  getStatusDestinationPayload,
  isCallMarker,
  isPoiDestinationType,
  resolveDefaultDestinationCall,
} from '../destination-helpers';

describe('destination-helpers', () => {
  it('returns the correct capabilities for POI-enabled status details', () => {
    expect(getDestinationCapabilities(CustomStateDetailType.CallsAndPois)).toEqual({
      showCalls: true,
      showStations: false,
      showPois: true,
      supportsDestination: true,
    });
  });

  it('derives enabled tabs and default tabs from detail values', () => {
    expect(getEnabledDestinationTabs(CustomStateDetailType.CallsStationsAndPois)).toEqual(['calls', 'stations', 'pois']);
    expect(getDefaultDestinationTab(CustomStateDetailType.Pois)).toBe('pois');
    expect(getDefaultDestinationTab(undefined)).toBe('calls');
  });

  it('maps POI destination types to and from API values', () => {
    expect(getDestinationSelectionTypeValue('poi')).toBe(DestinationEntityType.Poi);
    expect(getDestinationSelectionTypeFromValue(DestinationEntityType.Poi)).toBe('poi');
    expect(isPoiDestinationType(DestinationEntityType.Poi)).toBe(true);
  });

  it('resolves selected POI destination ids', () => {
    expect(
      getSelectedDestinationId({
        selectedDestinationType: 'poi',
        selectedCall: null,
        selectedStation: null,
        selectedPoi: {
          PoiId: 42,
        } as any,
      })
    ).toBe('42');
  });

  it('recognizes call markers from marker type or image token', () => {
    expect(isCallMarker(MapMarkerEntityType.Call)).toBe(true);
    expect(isCallMarker(undefined, 'call')).toBe(true);
  });

  describe('status destination filtering', () => {
    const call = { CallId: 'call-7', Number: '7', Name: 'Structure Fire', State: 0 } as any;
    const station = { GroupId: 'station-3', Name: 'Station 3' } as any;
    const callSelection = { selectedDestinationType: 'call' as const, selectedCall: call, selectedStation: null, selectedPoi: null };
    const stationSelection = { selectedDestinationType: 'station' as const, selectedCall: null, selectedStation: station, selectedPoi: null };

    it('widens capabilities to calls only for an explicit call context', () => {
      expect(getStatusDestinationCapabilities(CustomStateDetailType.None)).toEqual({ showCalls: false, showStations: false, showPois: false, supportsDestination: false });
      expect(getStatusDestinationCapabilities(CustomStateDetailType.None, true)).toEqual({ showCalls: true, showStations: false, showPois: false, supportsDestination: true });
      expect(getStatusDestinationCapabilities(CustomStateDetailType.Stations, true)).toEqual({ showCalls: true, showStations: true, showPois: false, supportsDestination: true });
    });

    it('sends a call destination as RespondingTo = CallId / RespondingToType = Call when the status supports calls', () => {
      expect(getStatusDestinationPayload(callSelection, CustomStateDetailType.Calls)).toEqual({ respondingTo: 'call-7', respondingToType: DestinationEntityType.Call });
      expect(getStatusDestinationPayload(callSelection, CustomStateDetailType.CallsAndStations)).toEqual({ respondingTo: 'call-7', respondingToType: DestinationEntityType.Call });
    });

    it('drops a leftover destination the status does not support', () => {
      expect(getEffectiveDestinationType(callSelection, CustomStateDetailType.Stations)).toBe('none');
      expect(getStatusDestinationPayload(callSelection, CustomStateDetailType.Stations)).toEqual({ respondingTo: '', respondingToType: null });
      expect(getStatusDestinationPayload(callSelection, CustomStateDetailType.None)).toEqual({ respondingTo: '', respondingToType: null });
      expect(getStatusDestinationPayload(stationSelection, CustomStateDetailType.Calls)).toEqual({ respondingTo: '', respondingToType: null });
      expect(getStatusDestinationPayload(stationSelection, CustomStateDetailType.Stations)).toEqual({ respondingTo: 'station-3', respondingToType: DestinationEntityType.Station });
    });

    it('keeps the call for an explicit call context even when the status Detail does not list calls', () => {
      expect(getStatusDestinationPayload(callSelection, CustomStateDetailType.None, true)).toEqual({ respondingTo: 'call-7', respondingToType: DestinationEntityType.Call });
      expect(getStatusDestinationPayload(callSelection, CustomStateDetailType.Stations, true)).toEqual({ respondingTo: 'call-7', respondingToType: DestinationEntityType.Call });
      // The widening is for calls only — a station still needs a status that supports stations
      expect(getStatusDestinationPayload(stationSelection, CustomStateDetailType.None, true)).toEqual({ respondingTo: '', respondingToType: null });
    });

    it('never reports a destination for an empty selection', () => {
      expect(getEffectiveDestinationType({ selectedDestinationType: 'call', selectedCall: null, selectedStation: null, selectedPoi: null }, CustomStateDetailType.Calls)).toBe('none');
      expect(getEffectiveDestinationType({ selectedDestinationType: 'none', selectedCall: null, selectedStation: null, selectedPoi: null }, CustomStateDetailType.Calls, true)).toBe('none');
    });
  });

  describe('resolveDefaultDestinationCall', () => {
    const callA = { CallId: 'A', State: 0 } as any;
    const callB = { CallId: 'B', State: 0 } as any;
    const contextCall = { CallId: 'CTX', State: 0 } as any;

    it('prefers the explicit call context over everything else', () => {
      expect(resolveDefaultDestinationCall({ callContext: contextCall, currentDestinationId: 'A', selectedCallId: 'B', activeCalls: [callA, callB] })).toBe(contextCall);
    });

    it("falls back to the unit's/person's current destination when it is an active call", () => {
      expect(resolveDefaultDestinationCall({ currentDestinationId: 'A', selectedCallId: 'B', activeCalls: [callA, callB] })).toBe(callA);
    });

    it("uses the console's selected call when the current destination is not an active call", () => {
      expect(resolveDefaultDestinationCall({ currentDestinationId: 'closed-or-station', selectedCallId: 'B', activeCalls: [callA, callB] })).toBe(callB);
      expect(resolveDefaultDestinationCall({ currentDestinationId: '', selectedCallId: 'B', activeCalls: [callA, callB] })).toBe(callB);
    });

    it('returns null when neither the current destination nor the selected call is active', () => {
      expect(resolveDefaultDestinationCall({ currentDestinationId: 'X', selectedCallId: 'Y', activeCalls: [callA, callB] })).toBeNull();
      expect(resolveDefaultDestinationCall({ activeCalls: [] })).toBeNull();
    });
  });
});
