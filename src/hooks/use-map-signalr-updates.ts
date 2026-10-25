import { useCallback, useEffect, useRef } from 'react';

import { getMapDataAndMarkers } from '@/api/mapping/mapping';
import { logger } from '@/lib/logging';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { type PoiLayerData } from '@/models/v4/mapping/poiLayerData';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

// Debounce delay in milliseconds to prevent rapid consecutive API calls
const DEBOUNCE_DELAY = 1000;

/**
 * Refetches the map's markers (debounced) whenever the update hub reports a change.
 *
 * `onMarkersUpdate` receives the fetched markers and the time the request started, so realtime positions received
 * while it was in flight can be re-applied on top. The returned `requestRefresh` runs the same fetch on demand
 * (e.g. for a pin the realtime feed knows about but the map does not).
 */
export const useMapSignalRUpdates = (onMarkersUpdate: (markers: MapMakerInfoData[], fetchStartedAt: number) => void, onPoiLayersUpdate?: (poiLayers: PoiLayerData[]) => void) => {
  const lastProcessedTimestamp = useRef<number>(0);
  const isUpdating = useRef<boolean>(false);
  const pendingTimestamp = useRef<number | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const lastUpdateTimestamp = useSignalRStore((state) => state.lastUpdateTimestamp);

  const fetchAndUpdateMarkers = useCallback(
    async (requestedTimestamp?: number) => {
      const timestampToProcess = requestedTimestamp || lastUpdateTimestamp;

      // If a fetch is in progress, queue the latest timestamp for processing after completion
      if (isUpdating.current) {
        pendingTimestamp.current = timestampToProcess;
        logger.debug({
          message: 'Map markers update already in progress, queuing timestamp',
          context: { timestamp: timestampToProcess, pendingTimestamp: pendingTimestamp.current },
        });
        return;
      }

      // Cancel any previous request
      if (abortController.current) {
        abortController.current.abort();
      }

      // Create new abort controller for this request
      abortController.current = new AbortController();
      isUpdating.current = true;

      try {
        logger.debug({
          message: 'Fetching map markers from SignalR update',
          context: { timestamp: timestampToProcess },
        });

        const fetchStartedAt = Date.now();
        const mapDataAndMarkers = await getMapDataAndMarkers(abortController.current.signal);

        // Check if request was aborted
        if (abortController.current?.signal.aborted) {
          logger.debug({
            message: 'Map markers request was aborted',
            context: { timestamp: timestampToProcess },
          });
          return;
        }

        if (mapDataAndMarkers && mapDataAndMarkers.Data) {
          logger.info({
            message: 'Updating map markers from SignalR update',
            context: {
              markerCount: mapDataAndMarkers.Data.MapMakerInfos.length,
              timestamp: timestampToProcess,
            },
          });

          onMarkersUpdate(mapDataAndMarkers.Data.MapMakerInfos, fetchStartedAt);

          if (onPoiLayersUpdate) {
            onPoiLayersUpdate(mapDataAndMarkers.Data.PoiLayers ?? []);
          }
        }

        // Update the last processed timestamp after successful API call
        lastProcessedTimestamp.current = timestampToProcess;
      } catch (error) {
        // Don't log aborted requests as errors
        if (error instanceof Error && error.name === 'AbortError') {
          logger.debug({
            message: 'Map markers request was aborted',
            context: { timestamp: timestampToProcess },
          });
          return;
        }

        // Handle axios cancel errors as well
        if (error instanceof Error && error.message === 'canceled') {
          logger.debug({
            message: 'Map markers request was canceled',
            context: { timestamp: timestampToProcess },
          });
          return;
        }

        logger.error({
          message: 'Failed to update map markers from SignalR update',
          context: { error, timestamp: timestampToProcess },
        });
        // Don't update lastProcessedTimestamp on error so it can be retried
      } finally {
        isUpdating.current = false;
        abortController.current = null;

        // Check if there's a pending timestamp and trigger another fetch
        if (pendingTimestamp.current !== null) {
          const nextTimestamp = pendingTimestamp.current;
          pendingTimestamp.current = null;
          logger.debug({
            message: 'Processing queued timestamp after fetch completion',
            context: { nextTimestamp },
          });
          // Use setTimeout to avoid potential stack overflow in case of rapid updates
          setTimeout(() => fetchAndUpdateMarkers(nextTimestamp), 0);
        }
      }
    },
    [lastUpdateTimestamp, onMarkersUpdate, onPoiLayersUpdate]
  );

  useEffect(() => {
    // Clear any existing debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Only process if we have a valid timestamp and it's different from the last processed one
    if (lastUpdateTimestamp > 0 && lastUpdateTimestamp !== lastProcessedTimestamp.current) {
      logger.debug({
        message: 'Debouncing map markers update',
        context: {
          lastUpdateTimestamp,
          lastProcessed: lastProcessedTimestamp.current,
          delay: DEBOUNCE_DELAY,
        },
      });

      // Debounce the API call to prevent rapid consecutive requests
      debounceTimer.current = setTimeout(() => {
        fetchAndUpdateMarkers();
      }, DEBOUNCE_DELAY);
    }

    // Cleanup function
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [lastUpdateTimestamp, fetchAndUpdateMarkers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear debounce timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Abort any ongoing request
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  // Stable across renders: callers hold on to it from timers and store subscriptions.
  const fetchAndUpdateMarkersRef = useRef(fetchAndUpdateMarkers);
  useEffect(() => {
    fetchAndUpdateMarkersRef.current = fetchAndUpdateMarkers;
  }, [fetchAndUpdateMarkers]);

  const requestRefresh = useCallback(() => {
    void fetchAndUpdateMarkersRef.current();
  }, []);

  return { requestRefresh };
};

/** How long the update hub must stay quiet before `useMapSignalRRefetch` refetches. */
export const MAP_SIGNALR_REFETCH_DELAY_MS = DEBOUNCE_DELAY;

/**
 * Runs `refetch` (debounced) whenever the update hub reports a change (a unit or person status, a call added, updated
 * or closed) after the map mounted, for a map that already owns its marker fetch. Status and priority changes reach the
 * pins only through such a refetch: the pin images (`PinIconUrl`, `IconUrl`) change with them. `refetch` must be a
 * background refresh that leaves the camera where the user put it; the change already recorded when the map mounted is
 * covered by the map's own first load and is skipped.
 */
export const useMapSignalRRefetch = (refetch: () => void, enabled: boolean = true) => {
  const lastUpdateTimestamp = useSignalRStore((state) => state.lastUpdateTimestamp);
  const handledTimestampRef = useRef(lastUpdateTimestamp);

  // The latest refetch, so a new callback identity neither cancels a pending refresh nor schedules an extra one.
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  useEffect(() => {
    if (!enabled || !(lastUpdateTimestamp > 0) || lastUpdateTimestamp === handledTimestampRef.current) return;

    const timer = setTimeout(() => {
      handledTimestampRef.current = lastUpdateTimestamp;
      logger.debug({
        message: 'Refetching map markers after an update hub change',
        context: { timestamp: lastUpdateTimestamp },
      });
      refetchRef.current();
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(timer);
  }, [enabled, lastUpdateTimestamp]);
};
