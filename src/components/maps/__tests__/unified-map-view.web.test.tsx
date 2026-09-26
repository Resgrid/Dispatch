import { act, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { getMapDataAndMarkers } from '@/api/mapping/mapping';
import { LIVE_LOCATION_REFRESH_DELAY_MS } from '@/hooks/use-map-live-locations';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

import UnifiedMapView from '../unified-map-view.web';

// Minimal mapbox-gl stand-in that records what the component does to the map and its markers.
interface MockMarker {
  lngLat: [number, number];
  setLngLat: jest.Mock;
  remove: jest.Mock;
}
interface MockMap {
  handlers: Record<string, () => void>;
  flyTo: jest.Mock;
}
const mockMarkers: MockMarker[] = [];
const mockMaps: MockMap[] = [];

jest.mock('mapbox-gl', () => {
  class Popup {
    setHTML = jest.fn(() => this);
  }
  class Marker {
    lngLat: [number, number] = [0, 0];
    popup: Popup | undefined;
    setLngLat = jest.fn((lngLat: [number, number]) => {
      this.lngLat = lngLat;
      return this;
    });
    remove = jest.fn();
    constructor() {
      mockMarkers.push(this as unknown as MockMarker);
    }
    setPopup(popup: Popup) {
      this.popup = popup;
      return this;
    }
    getPopup() {
      return this.popup;
    }
    addTo() {
      return this;
    }
  }
  class MapboxMap {
    handlers: Record<string, () => void> = {};
    flyTo = jest.fn();
    constructor() {
      mockMaps.push(this as unknown as MockMap);
    }
    addControl() {}
    on(event: string, handler: () => void) {
      this.handlers[event] = handler;
    }
    once() {}
    off() {}
    remove() {}
    setStyle() {}
    getLayer() {
      return undefined;
    }
    getSource() {
      return undefined;
    }
    addSource() {}
    addLayer() {}
  }
  class Control {}
  return { __esModule: true, default: { Map: MapboxMap, Marker, Popup, NavigationControl: Control, GeolocateControl: Control, accessToken: '' } };
});

jest.mock('@/stores/signalr/signalr-store', () => {
  const { create } = jest.requireActual('zustand');
  return { useSignalRStore: create(() => ({ liveLocations: {}, lastGeolocationJoinTimestamp: 0 })) };
});

jest.mock('@/api/mapping/mapping', () => ({ getMapDataAndMarkers: jest.fn() }));
jest.mock('@/lib/map-markers-web', () => ({ buildMapPinPopupHtml: jest.fn(() => '<div></div>'), createMapMarkerElement: jest.fn(() => ({})) }));
jest.mock('@/lib/map-center', () => ({ getDepartmentMapCenter: () => ({ latitude: 39, longitude: -119, zoomLevel: 9 }) }));
jest.mock('@/lib/env', () => ({ Env: { MAPBOX_PUBKEY: 'pk.test' } }));
jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
jest.mock('@/stores/app/location-store', () => ({ useLocationStore: { getState: () => ({ latitude: null, longitude: null }) } }));
jest.mock('nativewind', () => ({ useColorScheme: () => ({ colorScheme: 'light' }) }));

const mockGetMapDataAndMarkers = getMapDataAndMarkers as jest.MockedFunction<typeof getMapDataAndMarkers>;

const makePin = (id: string, type: number, latitude: number, longitude: number) => ({ Id: id, Type: type, Latitude: latitude, Longitude: longitude, Title: id }) as MapMakerInfoData;

const mapResponse = (pins: MapMakerInfoData[]) => ({ Data: { MapMakerInfos: pins, CenterLat: '39.5', CenterLon: '-119.8', ZoomLevel: '11', PoiLayers: [] } }) as any;

const REST_PINS = [makePin('c1', 0, 39.1, -119.1), makePin('u12', 1, 39.2, -119.2), makePin('pABC', 3, 39.3, -119.3)];

describe('UnifiedMapView (web) realtime locations', () => {
  const originalDocument = (global as any).document;

  beforeEach(() => {
    jest.useFakeTimers();
    mockMarkers.length = 0;
    mockMaps.length = 0;
    mockGetMapDataAndMarkers.mockReset();
    mockGetMapDataAndMarkers.mockResolvedValue(mapResponse(REST_PINS));
    useSignalRStore.setState({ liveLocations: {}, lastGeolocationJoinTimestamp: 0 });
    // Only the stylesheet injection touches document; report it as already present.
    (global as any).document = { getElementById: () => ({}) };
  });

  afterEach(() => {
    (global as any).document = originalDocument;
    jest.useRealTimers();
  });

  const renderLoadedMap = async () => {
    const view = render(<UnifiedMapView autoFetchPins />, { createNodeMock: () => ({}) });
    act(() => mockMaps[0].handlers.load());
    await waitFor(() => expect(mockMarkers).toHaveLength(REST_PINS.length));
    return view;
  };

  const markerAt = (latitude: number, longitude: number) => mockMarkers.find((marker) => marker.lngLat[0] === longitude && marker.lngLat[1] === latitude);

  it('moves the pushed pin in place without rebuilding markers or moving the camera', async () => {
    await renderLoadedMap();
    const unitMarker = markerAt(39.2, -119.2)!;
    expect(mockMaps[0].flyTo).toHaveBeenCalledTimes(1);

    act(() => {
      useSignalRStore.setState({ liveLocations: { u12: { pinId: 'u12', latitude: 40, longitude: -120, timestamp: null, receivedAt: Date.now() } } });
    });

    expect(unitMarker.setLngLat).toHaveBeenLastCalledWith([-120, 40]);
    expect(mockMarkers).toHaveLength(REST_PINS.length);
    mockMarkers.forEach((marker) => expect(marker.remove).not.toHaveBeenCalled());
    expect(mockMaps[0].flyTo).toHaveBeenCalledTimes(1);
  });

  it('refetches in the background for a pin it does not have, without moving the camera', async () => {
    await renderLoadedMap();
    mockGetMapDataAndMarkers.mockResolvedValue(mapResponse([...REST_PINS, makePin('u99', 1, 38, -118)]));

    act(() => {
      useSignalRStore.setState({ liveLocations: { u99: { pinId: 'u99', latitude: 38.5, longitude: -118.5, timestamp: null, receivedAt: Date.now() } } });
    });
    expect(mockMarkers).toHaveLength(REST_PINS.length);

    await act(async () => {
      jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS);
    });

    await waitFor(() => expect(mockMarkers).toHaveLength(REST_PINS.length + 1));
    expect(mockGetMapDataAndMarkers).toHaveBeenCalledTimes(2);
    // The push arrived before the refetch started, so the fresh REST position stands.
    expect(markerAt(38, -118)).toBeDefined();
    expect(mockMaps[0].flyTo).toHaveBeenCalledTimes(1);
  });
});
