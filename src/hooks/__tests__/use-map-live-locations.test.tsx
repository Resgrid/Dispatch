import { act, renderHook } from '@testing-library/react-native';
import { useState } from 'react';

import { type LiveLocation, type LiveLocations } from '@/lib/live-locations';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

import { LIVE_LOCATION_REFRESH_DELAY_MS, UNKNOWN_PIN_REFRESH_COOLDOWN_MS, useMapLiveLocations } from '../use-map-live-locations';

// A real zustand store with just the slice the hook reads, so subscriptions behave as in the app.
jest.mock('@/stores/signalr/signalr-store', () => {
  const { create } = jest.requireActual('zustand');
  return { useSignalRStore: create(() => ({ liveLocations: {}, lastGeolocationJoinTimestamp: 0 })) };
});

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const T0 = new Date('2026-09-25T14:00:00.000Z').getTime();

const makePin = (id: string, type: number, latitude = 10, longitude = 20): MapMakerInfoData => ({
  Id: id,
  Latitude: latitude,
  Longitude: longitude,
  Title: id,
  zIndex: 0,
  ImagePath: '',
  InfoWindowContent: '',
  Color: '',
  Type: type,
  PoiImage: '',
  Marker: '',
  PoiTypeId: null,
  PoiTypeName: '',
  Address: '',
  Note: '',
  LayerId: '',
  LayerName: '',
});

const REST_PINS = [makePin('c1', 0), makePin('u12', 1), makePin('pABC', 3), makePin('s4', 2)];

const location = (pinId: string, latitude: number, longitude: number, receivedAt = Date.now()): LiveLocation => ({ pinId, latitude, longitude, timestamp: null, receivedAt });

/** Mimics a store push: an immutable update that replaces only the changed entries. */
const push = (...locations: LiveLocation[]) => {
  act(() => {
    const current = useSignalRStore.getState().liveLocations as LiveLocations;
    const next = { ...current };
    locations.forEach((entry) => {
      next[entry.pinId] = entry;
    });
    useSignalRStore.setState({ liveLocations: next });
  });
};

const renderMap = (requestRefresh: jest.Mock = jest.fn(), enabled = true) => {
  const hook = renderHook(() => {
    const [pins, setPins] = useState<MapMakerInfoData[]>([]);
    const live = useMapLiveLocations({ pins, setPins, requestRefresh, enabled });
    return { pins, setPins, ...live };
  });

  /** Runs a REST load the way the maps do: note the start, fetch, re-apply live positions, store. */
  const load = (fetchedPins: MapMakerInfoData[], fetchStartedAt: number) => {
    act(() => {
      hook.result.current.setPins(hook.result.current.applyToFetchedPins(fetchedPins, fetchStartedAt));
    });
  };

  return { ...hook, load, requestRefresh };
};

describe('useMapLiveLocations', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(T0);
    useSignalRStore.setState({ liveLocations: {}, lastGeolocationJoinTimestamp: 0 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('moves a unit pin in place and keeps every other pin object', () => {
    const { result, load } = renderMap();
    load(REST_PINS, Date.now());
    const before = result.current.pins;

    push(location('u12', 11, 21));

    expect(result.current.pins).not.toBe(before);
    expect(result.current.pins[1]).toMatchObject({ Id: 'u12', Latitude: 11, Longitude: 21 });
    expect(result.current.pins[0]).toBe(before[0]);
    expect(result.current.pins[2]).toBe(before[2]);
    expect(result.current.pins[3]).toBe(before[3]);
  });

  it('matches personnel pins case-insensitively', () => {
    const { result, load } = renderMap();
    load(REST_PINS, Date.now());

    push(location('pabc', 12, 22));

    expect(result.current.pins[2]).toMatchObject({ Id: 'pABC', Latitude: 12, Longitude: 22 });
  });

  it('keeps the same array when a push moves nothing on this map', () => {
    const { result, load } = renderMap();
    load(REST_PINS, Date.now());
    const before = result.current.pins;

    push(location('u12', 10, 20));

    expect(result.current.pins).toBe(before);
  });

  it('never creates a pin from a push and asks for one coalesced refetch instead', () => {
    const { result, load, requestRefresh } = renderMap();
    load(REST_PINS, Date.now());

    push(location('u99', 1, 1));
    push(location('u98', 2, 2));

    expect(result.current.pins).toHaveLength(REST_PINS.length);
    expect(requestRefresh).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS);
    });

    expect(requestRefresh).toHaveBeenCalledTimes(1);
  });

  it('lets an unknown pin request a refetch at most once per cooldown', () => {
    const { load, requestRefresh } = renderMap();
    load(REST_PINS, Date.now());

    push(location('u99', 1, 1));
    act(() => {
      jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS);
    });
    expect(requestRefresh).toHaveBeenCalledTimes(1);

    // Still not visible to this viewer after the refetch: its pushes keep coming.
    push(location('u99', 1.1, 1.1));
    act(() => {
      jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS * 2);
    });
    expect(requestRefresh).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(UNKNOWN_PIN_REFRESH_COOLDOWN_MS);
    });
    push(location('u99', 1.2, 1.2));
    act(() => {
      jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS);
    });
    expect(requestRefresh).toHaveBeenCalledTimes(2);
  });

  it('does not treat pushes before the first load as unknown pins', () => {
    const { requestRefresh } = renderMap();

    push(location('u12', 11, 21));
    act(() => {
      jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS * 2);
    });

    expect(requestRefresh).not.toHaveBeenCalled();
  });

  it('re-applies positions pushed while a refetch was in flight, but not older ones', () => {
    const { result, load } = renderMap();
    load(REST_PINS, Date.now());

    // Received before the refetch started: the REST snapshot supersedes it.
    push(location('pabc', 30, 30));
    jest.setSystemTime(T0 + 1000);
    const fetchStartedAt = Date.now();
    jest.setSystemTime(T0 + 2000);
    // Received while the request was in flight: newer than what it will return.
    push(location('u12', 40, 40));

    load(REST_PINS, fetchStartedAt);

    expect(result.current.pins[1]).toMatchObject({ Id: 'u12', Latitude: 40, Longitude: 40 });
    expect(result.current.pins[2]).toBe(REST_PINS[2]);
  });

  it('catches up with one refetch after the geolocation hub re-joins', () => {
    const { load, requestRefresh } = renderMap();
    load(REST_PINS, Date.now());

    jest.setSystemTime(T0 + 60_000);
    act(() => useSignalRStore.setState({ lastGeolocationJoinTimestamp: Date.now() }));
    act(() => {
      jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS);
    });

    expect(requestRefresh).toHaveBeenCalledTimes(1);
  });

  it('skips the catch-up when the displayed data was fetched after the join', () => {
    const { load, requestRefresh } = renderMap();
    act(() => useSignalRStore.setState({ lastGeolocationJoinTimestamp: Date.now() }));
    jest.setSystemTime(T0 + 500);
    load(REST_PINS, Date.now());

    act(() => {
      jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS * 2);
    });

    expect(requestRefresh).not.toHaveBeenCalled();
  });

  it('catches up when the join landed while the first load was in flight', () => {
    const { load, requestRefresh } = renderMap();
    const fetchStartedAt = Date.now();
    jest.setSystemTime(T0 + 500);
    act(() => useSignalRStore.setState({ lastGeolocationJoinTimestamp: Date.now() }));

    load(REST_PINS, fetchStartedAt);
    act(() => {
      jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS);
    });

    expect(requestRefresh).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled', () => {
    const { result, requestRefresh } = renderMap(jest.fn(), false);
    act(() => {
      result.current.setPins(REST_PINS);
    });

    push(location('u12', 11, 21), location('u99', 1, 1));
    act(() => {
      jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS * 2);
    });

    expect(result.current.pins).toBe(REST_PINS);
    expect(result.current.applyToFetchedPins(REST_PINS, 0)).toBe(REST_PINS);
    expect(requestRefresh).not.toHaveBeenCalled();
  });

  it('drops a pending refetch when the map unmounts', () => {
    const { load, requestRefresh, unmount } = renderMap();
    load(REST_PINS, Date.now());
    push(location('u99', 1, 1));

    unmount();
    act(() => {
      jest.advanceTimersByTime(LIVE_LOCATION_REFRESH_DELAY_MS * 2);
    });

    expect(requestRefresh).not.toHaveBeenCalled();
  });
});
