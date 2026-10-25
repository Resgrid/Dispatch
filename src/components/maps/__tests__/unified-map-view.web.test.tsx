import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { getMapDataAndMarkers } from '@/api/mapping/mapping';
import { LIVE_LOCATION_REFRESH_DELAY_MS } from '@/hooks/use-map-live-locations';
import { MAP_SIGNALR_REFETCH_DELAY_MS } from '@/hooks/use-map-signalr-updates';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

import UnifiedMapView from '../unified-map-view.web';

// Minimal mapbox-gl stand-in that records what the component does to the map and its markers.
interface MockMarker {
  pinId: string;
  anchor?: string;
  popup?: { options: { offset?: unknown } };
  lngLat: [number, number];
  setLngLat: jest.Mock;
  remove: jest.Mock;
}
interface MockMap {
  handlers: Record<string, () => void>;
  flyTo: jest.Mock;
  fitBounds: jest.Mock;
}
const mockMarkers: MockMarker[] = [];
const mockMaps: MockMap[] = [];
// What getBounds reports as on screen; the whole world unless a test narrows it.
const mockVisibleBox = { west: -180, south: -90, east: 180, north: 90 };

jest.mock('mapbox-gl', () => {
  class Popup {
    options: { offset?: unknown };
    setHTML = jest.fn(() => this);
    constructor(options: { offset?: unknown } = {}) {
      this.options = options;
    }
  }
  class Marker {
    pinId: string;
    anchor: string | undefined;
    lngLat: [number, number] = [0, 0];
    popup: Popup | undefined;
    setLngLat = jest.fn((lngLat: [number, number]) => {
      this.lngLat = lngLat;
      return this;
    });
    remove = jest.fn();
    constructor(options: { element: { pinId: string }; anchor?: string }) {
      this.pinId = options.element.pinId;
      this.anchor = options.anchor;
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
    fitBounds = jest.fn();
    getBounds = jest.fn(() => ({
      contains: ([lng, lat]: [number, number]) => lng >= mockVisibleBox.west && lng <= mockVisibleBox.east && lat >= mockVisibleBox.south && lat <= mockVisibleBox.north,
    }));
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
  return { useSignalRStore: create(() => ({ liveLocations: {}, lastGeolocationJoinTimestamp: 0, lastUpdateTimestamp: 0 })) };
});

jest.mock('@/api/mapping/mapping', () => ({ getMapDataAndMarkers: jest.fn() }));
jest.mock('@/lib/map-markers-web', () => ({
  buildMapPinPopupHtml: jest.fn(() => '<div></div>'),
  createMapMarkerElement: jest.fn((pin: { Id: string }) => ({ pinId: pin.Id })),
  getMapMarkerPopupOffset: jest.fn(() => ({ bottom: [0, -36] })),
  // The real signature, so the test sees exactly which pin changes rebuild a marker.
  getMapMarkerSignature: jest.requireActual('@/lib/map-markers-web').getMapMarkerSignature,
  MAP_MARKER_ANCHOR: 'bottom',
}));
jest.mock('@/lib/map-center', () => ({ getDepartmentMapCenter: () => ({ latitude: 39, longitude: -119, zoomLevel: 9 }) }));
jest.mock('@/lib/env', () => ({ Env: { MAPBOX_PUBKEY: 'pk.test' } }));
jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
jest.mock('@/stores/app/location-store', () => ({ useLocationStore: { getState: () => ({ latitude: null, longitude: null }) } }));
jest.mock('nativewind', () => ({ useColorScheme: () => ({ colorScheme: 'light' }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: Record<string, unknown>) => (options ? `${key}:${JSON.stringify(options)}` : key) }),
}));
jest.mock('@/components/ui/icon', () => ({ Icon: () => null }));
jest.mock('lucide-react-native', () => ({ LocateFixed: () => null }));

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
    useSignalRStore.setState({ liveLocations: {}, lastGeolocationJoinTimestamp: 0, lastUpdateTimestamp: 0 });
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

  it('bottom-anchors pin markers and rebuilds only the marker whose uploaded icon changed', async () => {
    const ROLE_ICON_URL = 'https://api.resgrid.dev/api/v4/TypeIcons/r4.png';
    const { createMapMarkerElement } = jest.requireMock('@/lib/map-markers-web') as { createMapMarkerElement: jest.Mock };
    const liveMarker = (pinId: string) => mockMarkers.filter((marker) => marker.pinId === pinId && marker.remove.mock.calls.length === 0);
    await renderLoadedMap();

    const [personMarker] = liveMarker('pABC');
    const [unitMarker] = liveMarker('u12');
    expect(personMarker.anchor).toBe('bottom');
    expect(personMarker.popup?.options.offset).toEqual({ bottom: [0, -36] });

    // A background refetch brings the same pins, the person now carrying their role's icon.
    mockGetMapDataAndMarkers.mockResolvedValue(mapResponse(REST_PINS.map((pin) => (pin.Id === 'pABC' ? ({ ...pin, IconUrl: ROLE_ICON_URL } as MapMakerInfoData) : pin))));
    act(() => {
      useSignalRStore.setState({ liveLocations: { u99: { pinId: 'u99', latitude: 38.5, longitude: -118.5, timestamp: null, receivedAt: Date.now() } } });
    });
    await act(async () => {
      jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS);
    });
    await waitFor(() => expect(personMarker.remove).toHaveBeenCalled());

    const [rebuiltPersonMarker] = liveMarker('pABC');
    expect(rebuiltPersonMarker).not.toBe(personMarker);
    expect(rebuiltPersonMarker.anchor).toBe('bottom');
    expect(createMapMarkerElement).toHaveBeenLastCalledWith(expect.objectContaining({ Id: 'pABC', IconUrl: ROLE_ICON_URL }), 'light', expect.any(Function));
    // The pins that did not change keep their markers.
    expect(liveMarker('u12')).toEqual([unitMarker]);
    expect(mockMarkers).toHaveLength(REST_PINS.length + 1);
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

  it('refetches after an update hub change and rebuilds only the marker whose status pin changed, without moving the camera', async () => {
    const RESPONDING_PIN = 'https://api.resgrid.dev/api/v4/TypeIcons/Pins/engine-responding?v=1';
    const { createMapMarkerElement } = jest.requireMock('@/lib/map-markers-web') as { createMapMarkerElement: jest.Mock };
    const liveMarker = (pinId: string) => mockMarkers.filter((marker) => marker.pinId === pinId && marker.remove.mock.calls.length === 0);
    await renderLoadedMap();
    const [unitMarker] = liveMarker('u12');
    const [personMarker] = liveMarker('pABC');

    // The unit went responding: same pin, same place, only the status pin (and its style) changed.
    mockGetMapDataAndMarkers.mockResolvedValue(mapResponse(REST_PINS.map((pin) => (pin.Id === 'u12' ? ({ ...pin, PinIconUrl: RESPONDING_PIN, IconStyle: 'responding' } as MapMakerInfoData) : pin))));
    act(() => {
      useSignalRStore.setState({ lastUpdateTimestamp: 1000 });
    });
    act(() => {
      useSignalRStore.setState({ lastUpdateTimestamp: 1001 });
    });
    expect(mockGetMapDataAndMarkers).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(MAP_SIGNALR_REFETCH_DELAY_MS);
    });
    await waitFor(() => expect(unitMarker.remove).toHaveBeenCalled());

    // One refetch for the burst of hub events.
    expect(mockGetMapDataAndMarkers).toHaveBeenCalledTimes(2);
    expect(createMapMarkerElement).toHaveBeenLastCalledWith(expect.objectContaining({ Id: 'u12', PinIconUrl: RESPONDING_PIN, IconStyle: 'responding' }), 'light', expect.any(Function));
    expect(liveMarker('u12')).toHaveLength(1);
    expect(liveMarker('pABC')).toEqual([personMarker]);
    expect(mockMaps[0].flyTo).toHaveBeenCalledTimes(1);
  });

  it('leaves the refresh of pins passed in by a parent to the parent', async () => {
    render(<UnifiedMapView pins={REST_PINS} />, { createNodeMock: () => ({}) });
    act(() => mockMaps[0].handlers.load());

    act(() => {
      useSignalRStore.setState({ lastUpdateTimestamp: 2000 });
    });
    await act(async () => {
      jest.advanceTimersByTime(MAP_SIGNALR_REFETCH_DELAY_MS * 2);
    });

    expect(mockGetMapDataAndMarkers).not.toHaveBeenCalled();
  });
});

describe('UnifiedMapView (web) selected unit focus', () => {
  const originalDocument = (global as any).document;
  // A unit with two of its three seated members reporting; DEF has a pin, GHI does not.
  const FOCUS_PINS = [makePin('c1', 0, 39.1, -119.1), makePin('u12', 1, 39.2, -119.2), makePin('pABC', 3, 39.21, -119.21), makePin('pDEF', 3, 39.22, -119.22), makePin('pXYZ', 3, 39.9, -119.9)];
  const focusFor = (crewPinIds: string[], unitId = '12') => ({ key: `unit:${unitId}`, label: `Engine ${unitId}`, unitPinId: `u${unitId}`, crewPinIds });

  beforeEach(() => {
    jest.useFakeTimers();
    mockMarkers.length = 0;
    mockMaps.length = 0;
    Object.assign(mockVisibleBox, { west: -180, south: -90, east: 180, north: 90 });
    mockGetMapDataAndMarkers.mockReset();
    mockGetMapDataAndMarkers.mockResolvedValue(mapResponse(FOCUS_PINS));
    useSignalRStore.setState({ liveLocations: {}, lastGeolocationJoinTimestamp: 0, lastUpdateTimestamp: 0 });
    (global as any).document = { getElementById: () => ({}) };
  });

  afterEach(() => {
    (global as any).document = originalDocument;
    jest.useRealTimers();
  });

  const renderFocusedMap = async (focus: ReturnType<typeof focusFor> | null) => {
    const view = render(<UnifiedMapView autoFetchPins focus={focus} />, { createNodeMock: () => ({}) });
    act(() => mockMaps[0].handlers.load());
    await waitFor(() => expect(mockMarkers).toHaveLength(FOCUS_PINS.length));
    return view;
  };

  const pushLocation = (pinId: string, latitude: number, longitude: number) =>
    act(() => {
      useSignalRStore.setState({ liveLocations: { [pinId]: { pinId, latitude, longitude, timestamp: null, receivedAt: Date.now() } } });
    });

  it('frames the unit and its located crew instead of flying to the department center', async () => {
    const view = await renderFocusedMap(focusFor(['pabc', 'pdef', 'pghi']));

    expect(mockMaps[0].flyTo).not.toHaveBeenCalled();
    expect(mockMaps[0].fitBounds).toHaveBeenCalledTimes(1);
    const [[sw, ne]] = mockMaps[0].fitBounds.mock.calls[0];
    // Every framed position is inside the bounds, and the member far away who is not on the unit is not framed.
    [
      [-119.2, 39.2],
      [-119.21, 39.21],
      [-119.22, 39.22],
    ].forEach(([lng, lat]) => {
      expect(lng).toBeGreaterThanOrEqual(sw[0]);
      expect(lng).toBeLessThanOrEqual(ne[0]);
      expect(lat).toBeGreaterThanOrEqual(sw[1]);
      expect(lat).toBeLessThanOrEqual(ne[1]);
    });
    expect(ne[1]).toBeLessThan(39.9);
    expect(view.getByTestId('map-focus-banner-detail').props.children).toBe('dispatch.unit_map_focus_crew_located:{"located":2,"total":3}');
  });

  it('frames the crew alone, as close as it allows, when the unit has no position', async () => {
    const view = await renderFocusedMap(focusFor(['pabc'], '77'));

    expect(mockMaps[0].fitBounds).toHaveBeenCalledTimes(1);
    const [[sw, ne], options] = mockMaps[0].fitBounds.mock.calls[0];
    expect(ne[0] - sw[0]).toBeCloseTo(0.0025, 6);
    expect(ne[1] - sw[1]).toBeCloseTo(0.0025, 6);
    expect((sw[1] + ne[1]) / 2).toBeCloseTo(39.21, 6);
    expect(options).toEqual(expect.objectContaining({ maxZoom: 17 }));
    expect(view.getByTestId('map-focus-banner-detail').props.children).toBe('dispatch.unit_map_focus_no_unit_position · dispatch.unit_map_focus_crew_located:{"located":1,"total":1}');
  });

  it('leaves the camera alone and says so when nobody on the unit has a position', async () => {
    const view = await renderFocusedMap(focusFor(['pghi'], '77'));

    expect(mockMaps[0].fitBounds).not.toHaveBeenCalled();
    expect(view.getByTestId('map-focus-banner-detail').props.children).toBe('dispatch.unit_map_focus_no_positions');
    expect(view.queryByTestId('map-focus-recenter')).toBeNull();
  });

  it('keeps the frame while the crew moves on screen, and follows a member who moves off it', async () => {
    await renderFocusedMap(focusFor(['pabc', 'pdef']));
    Object.assign(mockVisibleBox, { west: -119.3, south: 39.1, east: -119.1, north: 39.3 });

    pushLocation('pabc', 39.25, -119.25);
    expect(mockMaps[0].fitBounds).toHaveBeenCalledTimes(1);

    pushLocation('pabc', 39.6, -119.6);
    expect(mockMaps[0].fitBounds).toHaveBeenCalledTimes(2);
    const [[sw, ne]] = mockMaps[0].fitBounds.mock.calls[1];
    expect(ne[1]).toBeGreaterThanOrEqual(39.6);
    expect(sw[0]).toBeLessThanOrEqual(-119.6);
  });

  it('does not pull the camera back to a member the dispatcher panned away from', async () => {
    await renderFocusedMap(focusFor(['pabc', 'pdef']));
    // The dispatcher has moved the map somewhere else entirely.
    Object.assign(mockVisibleBox, { west: -100, south: 30, east: -99, north: 31 });

    pushLocation('pabc', 39.25, -119.25);

    expect(mockMaps[0].fitBounds).toHaveBeenCalledTimes(1);
  });

  it('frames again when the crew changes, but not when the same crew is refetched', async () => {
    const view = await renderFocusedMap(focusFor(['pabc']));
    expect(mockMaps[0].fitBounds).toHaveBeenCalledTimes(1);

    view.rerender(<UnifiedMapView autoFetchPins focus={focusFor(['pabc'])} />);
    expect(mockMaps[0].fitBounds).toHaveBeenCalledTimes(1);

    view.rerender(<UnifiedMapView autoFetchPins focus={focusFor(['pabc', 'pdef'])} />);
    expect(mockMaps[0].fitBounds).toHaveBeenCalledTimes(2);
  });

  it('re-centers on request and leaves the camera where it is once the unit is deselected', async () => {
    const view = await renderFocusedMap(focusFor(['pabc']));

    fireEvent.press(view.getByTestId('map-focus-recenter'));
    expect(mockMaps[0].fitBounds).toHaveBeenCalledTimes(2);
    const framedCount = 2;

    view.rerender(<UnifiedMapView autoFetchPins focus={null} />);
    pushLocation('pabc', 39.6, -119.6);

    expect(mockMaps[0].fitBounds).toHaveBeenCalledTimes(framedCount);
    expect(mockMaps[0].flyTo).not.toHaveBeenCalled();
    expect(view.queryByTestId('map-focus-banner')).toBeNull();
  });
});
