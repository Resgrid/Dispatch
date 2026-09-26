import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef } from 'react';

import { applyLiveLocations, type LiveLocations } from '@/lib/live-locations';
import { logger } from '@/lib/logging';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

/** Unknown pins and reconnect catch-ups arriving within this window share one background refetch. */
export const LIVE_LOCATION_REFRESH_DELAY_MS = 4000;

/**
 * An unknown pin id may request a refetch at most once in this window. The realtime feed covers every entity in
 * the department, including ones this viewer is not allowed to see on the map; without the cooldown each of
 * their pushes would refetch the map.
 */
export const UNKNOWN_PIN_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

interface UseMapLiveLocationsOptions {
  /** The map's current pins (the state `setPins` writes). */
  pins: MapMakerInfoData[];
  /** The map's pin state setter; live moves are applied through a functional update. */
  setPins: Dispatch<SetStateAction<MapMakerInfoData[]>>;
  /** Re-runs the map's REST fetch in the background, without moving the camera. */
  requestRefresh?: () => void;
  /** Off for maps whose pins are owned by a parent. */
  enabled?: boolean;
}

interface UseMapLiveLocationsResult {
  /**
   * Call with every REST result before storing it. Re-applies live positions received since that fetch started,
   * because a push that arrived while the request was in flight is newer than the snapshot it returned.
   */
  applyToFetchedPins: (fetchedPins: MapMakerInfoData[], fetchStartedAt: number) => MapMakerInfoData[];
}

const getChangedPinIds = (next: LiveLocations, previous: LiveLocations): string[] => Object.keys(next).filter((pinId) => next[pinId] !== previous[pinId]);

/**
 * Moves a map's unit and personnel pins with the geolocation hub's realtime feed.
 *
 * Subscribes to the store outside React rendering, so a push costs one functional `setPins` (a no-op that keeps
 * the same array when nothing on this map moved) rather than a re-render of the whole map screen. Pushes for
 * pins the map does not have ask for one coalesced background refetch, rate-limited per pin, and so does a
 * geolocation re-join whose outage this map's data predates.
 */
export function useMapLiveLocations({ pins, setPins, requestRefresh, enabled = true }: UseMapLiveLocationsOptions): UseMapLiveLocationsResult {
  const pinsRef = useRef(pins);
  const requestRefreshRef = useRef(requestRefresh);
  const enabledRef = useRef(enabled);
  // Whether a REST snapshot has landed; before that every push would look like an unknown pin.
  const hasLoadedRef = useRef(false);
  // When the fetch behind the displayed snapshot started.
  const snapshotStartedAtRef = useRef(0);
  // A join acknowledged before the first snapshot landed, checked against that snapshot's start.
  const pendingJoinAtRef = useRef(0);
  const unknownRequestedAtRef = useRef(new Map<string, number>());
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);

  useEffect(() => {
    requestRefreshRef.current = requestRefresh;
  }, [requestRefresh]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const scheduleRefresh = useCallback((reason: string) => {
    if (!requestRefreshRef.current || refreshTimerRef.current) {
      return;
    }
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      logger.debug({ message: 'Refreshing map pins for realtime locations', context: { reason } });
      requestRefreshRef.current?.();
    }, LIVE_LOCATION_REFRESH_DELAY_MS);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleLiveLocationsChanged = (next: LiveLocations, previous: LiveLocations) => {
      const changedPinIds = getChangedPinIds(next, previous);
      if (changedPinIds.length === 0) {
        return;
      }

      setPins((currentPins) => applyLiveLocations(currentPins, next, { onlyPinIds: changedPinIds }).pins);

      if (!hasLoadedRef.current) {
        return;
      }
      const { unknownPinIds } = applyLiveLocations(pinsRef.current, next, { onlyPinIds: changedPinIds });
      if (unknownPinIds.length === 0) {
        return;
      }

      const now = Date.now();
      let shouldRefresh = false;
      unknownPinIds.forEach((pinId) => {
        const lastRequestedAt = unknownRequestedAtRef.current.get(pinId);
        if (lastRequestedAt === undefined || now - lastRequestedAt >= UNKNOWN_PIN_REFRESH_COOLDOWN_MS) {
          unknownRequestedAtRef.current.set(pinId, now);
          shouldRefresh = true;
        }
      });
      if (shouldRefresh) {
        scheduleRefresh('unknown-pin');
      }
    };

    // Positions pushed while the hub was away were never received, so a map whose data predates the
    // join catches up with one refetch.
    const handleGeolocationJoined = (joinedAt: number) => {
      if (!hasLoadedRef.current) {
        pendingJoinAtRef.current = joinedAt;
        return;
      }
      if (snapshotStartedAtRef.current < joinedAt) {
        scheduleRefresh('geolocation-join');
      }
    };

    const unsubscribe = useSignalRStore.subscribe((state, previousState) => {
      if (state.liveLocations !== previousState.liveLocations) {
        handleLiveLocationsChanged(state.liveLocations, previousState.liveLocations);
      }
      if (state.lastGeolocationJoinTimestamp !== previousState.lastGeolocationJoinTimestamp && state.lastGeolocationJoinTimestamp > 0) {
        handleGeolocationJoined(state.lastGeolocationJoinTimestamp);
      }
    });

    return () => {
      unsubscribe();
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [enabled, setPins, scheduleRefresh]);

  const applyToFetchedPins = useCallback(
    (fetchedPins: MapMakerInfoData[], fetchStartedAt: number): MapMakerInfoData[] => {
      if (!enabledRef.current) {
        return fetchedPins;
      }

      hasLoadedRef.current = true;
      snapshotStartedAtRef.current = fetchStartedAt;

      const pendingJoinAt = pendingJoinAtRef.current;
      pendingJoinAtRef.current = 0;
      if (pendingJoinAt > fetchStartedAt) {
        scheduleRefresh('geolocation-join');
      }

      // Only positions received after this request went out can be newer than what it returned.
      return applyLiveLocations(fetchedPins, useSignalRStore.getState().liveLocations, { receivedSince: fetchStartedAt }).pins;
    },
    [scheduleRefresh]
  );

  return { applyToFetchedPins };
}
