import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { getMapDataAndMarkers } from '@/api/mapping/mapping';
import { LIVE_LOCATION_REFRESH_DELAY_MS } from '@/hooks/use-map-live-locations';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

import MapWeb from '../../app/(app)/map.web';

// Minimal mapbox-gl stand-in that records what the screen does to the map and its markers.
interface MockMarker {
  pinId: string;
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
    pinId: string;
    lngLat: [number, number] = [0, 0];
    popup: Popup | undefined;
    setLngLat = jest.fn((lngLat: [number, number]) => {
      this.lngLat = lngLat;
      return this;
    });
    remove = jest.fn();
    constructor(options: { element: { pinId: string } }) {
      this.pinId = options.element.pinId;
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
jest.mock('@/lib/map-markers-web', () => ({ buildMapPinPopupHtml: jest.fn(() => '<div></div>'), createMapMarkerElement: jest.fn((pin: { Id: string }) => ({ pinId: pin.Id })) }));
jest.mock('@/lib/map-center', () => ({ getDepartmentMapCenter: () => ({ latitude: 39, longitude: -119, zoomLevel: 9 }) }));
jest.mock('@/lib/env', () => ({ Env: { MAPBOX_PUBKEY: 'pk.test' } }));
jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
jest.mock('@/stores/app/location-store', () => ({ useLocationStore: (selector: (state: object) => unknown) => selector({ latitude: null, longitude: null }) }));
jest.mock('nativewind', () => ({ useColorScheme: () => ({ colorScheme: 'light' }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, useFocusEffect: jest.fn() }));
jest.mock('@/components/ui/focus-aware-status-bar', () => ({ FocusAwareStatusBar: () => null }));
jest.mock('@/hooks/use-active-map-layers', () => ({ useActiveMapLayers: () => ({ activeLayers: [] }) }));
jest.mock('@/hooks/use-analytics', () => ({ useAnalytics: () => ({ trackEvent: jest.fn() }) }));
jest.mock('@/hooks/use-map-layers', () => {
  const layerState = {
    layers: [],
    visibleLayers: new Set(),
    isLoading: false,
    fetchLayers: () => {},
    toggleLayer: () => {},
    showAllLayers: () => {},
    hideAllLayers: () => {},
    getVisibleLayerData: () => [],
  };
  return { useMapLayers: () => layerState, MapLayerType: { ALL: 'ALL' } };
});

const mockGetMapDataAndMarkers = getMapDataAndMarkers as jest.MockedFunction<typeof getMapDataAndMarkers>;

const makePin = (id: string, type: number, latitude: number, longitude: number, poiTypeId: number | null = null) =>
  ({ Id: id, Type: type, Latitude: latitude, Longitude: longitude, Title: id, PoiTypeId: poiTypeId }) as MapMakerInfoData;

const HYDRANTS = { PoiTypeId: 7, Name: 'Hydrants', Color: '#f00', ImagePath: '', PoiImage: '', Marker: '', IsDestination: false };

const mapResponse = (pins: MapMakerInfoData[]) => ({ Data: { MapMakerInfos: pins, CenterLat: '39.5', CenterLon: '-119.8', ZoomLevel: '11', PoiLayers: [HYDRANTS] } }) as any;

const REST_PINS = [makePin('c1', 0, 39.1, -119.1), makePin('u12', 1, 39.2, -119.2), makePin('pABC', 3, 39.3, -119.3), makePin('poi5', 4, 39.4, -119.4, 7)];

const liveMarker = (pinId: string) => mockMarkers.filter((marker) => marker.pinId === pinId && marker.remove.mock.calls.length === 0);

describe('Map screen (web) realtime locations', () => {
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
    render(<MapWeb />, { createNodeMock: () => ({}) });
    act(() => mockMaps[0].handlers.load());
    await waitFor(() => expect(mockMarkers).toHaveLength(REST_PINS.length));
  };

  const pushUnknownPin = () => {
    act(() => {
      useSignalRStore.setState({ liveLocations: { u99: { pinId: 'u99', latitude: 38, longitude: -118, timestamp: null, receivedAt: Date.now() } } });
    });
  };

  it('moves a pushed pin in place and never re-centres the camera', async () => {
    await renderLoadedMap();
    expect(mockMaps[0].flyTo).toHaveBeenCalledTimes(1);

    act(() => {
      useSignalRStore.setState({ liveLocations: { pabc: { pinId: 'pabc', latitude: 40, longitude: -120, timestamp: null, receivedAt: Date.now() } } });
    });

    const [personMarker] = liveMarker('pABC');
    expect(personMarker.setLngLat).toHaveBeenLastCalledWith([-120, 40]);
    expect(mockMarkers).toHaveLength(REST_PINS.length);
    mockMarkers.forEach((marker) => expect(marker.remove).not.toHaveBeenCalled());

    pushUnknownPin();
    await act(async () => {
      jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS);
    });
    await waitFor(() => expect(mockGetMapDataAndMarkers).toHaveBeenCalledTimes(2));
    expect(mockMaps[0].flyTo).toHaveBeenCalledTimes(1);
  });

  it("keeps the user's POI layer toggles across a background refetch", async () => {
    await renderLoadedMap();

    fireEvent.press(screen.getByTestId('layers-button'));
    fireEvent.press(screen.getByText('Hydrants'));
    expect(liveMarker('poi5')).toHaveLength(0);

    pushUnknownPin();
    await act(async () => {
      jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS);
    });
    await waitFor(() => expect(mockGetMapDataAndMarkers).toHaveBeenCalledTimes(2));
    await act(async () => {});

    expect(liveMarker('poi5')).toHaveLength(0);
    expect(liveMarker('u12')).toHaveLength(1);
  });
});
