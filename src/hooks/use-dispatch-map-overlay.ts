import { useEffect, useMemo } from 'react';

import { buildDispatchMapOverlay, type DispatchMapOverlay } from '@/lib/dispatch-board';
import { boardKeyFor, useDispatchStore } from '@/stores/dispatch/store';

/**
 * What to draw on a call's location map while dispatching: the available units and personnel the nearest-unit board
 * placed for that location (unavailable ones stay in the recipient picker, with their status, but not on the map), and
 * every group boundary. Loads the board (shared with the recipient picker, so both rank alike) and the dispatch lists
 * once. Null until there is something to draw.
 */
export const useDispatchMapOverlay = (location?: { latitude: number; longitude: number } | null): DispatchMapOverlay | null => {
  const board = useDispatchStore((state) => state.board);
  const boardKey = useDispatchStore((state) => state.boardKey);
  const groups = useDispatchStore((state) => state.data.groups);
  const fetchNearestBoard = useDispatchStore((state) => state.fetchNearestBoard);
  const fetchDispatchData = useDispatchStore((state) => state.fetchDispatchData);

  const latitude = location?.latitude;
  const longitude = location?.longitude;
  const hasLocation = typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude) && Number.isFinite(longitude) && !(latitude === 0 && longitude === 0);

  // The boundaries come with the groups list; the picker loads it too, so only an empty store asks.
  useEffect(() => {
    if (useDispatchStore.getState().data.groups.length === 0) {
      void fetchDispatchData();
    }
  }, [fetchDispatchData]);

  useEffect(() => {
    if (hasLocation) {
      void fetchNearestBoard(latitude as number, longitude as number);
    }
  }, [hasLocation, latitude, longitude, fetchNearestBoard]);

  const locationBoard = hasLocation && boardKey === boardKeyFor(latitude as number, longitude as number) ? board : null;

  return useMemo(() => buildDispatchMapOverlay(locationBoard, groups), [locationBoard, groups]);
};
