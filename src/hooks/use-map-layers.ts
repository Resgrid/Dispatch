import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getMayLayers } from '@/api/mapping/mapping';
import { logger } from '@/lib/logging';
import { type GetMapLayersData } from '@/models/v4/mapping/getMapLayersResultData';

export enum MapLayerType {
  ALL = 0,
  PERSONNEL = 1,
  UNITS = 2,
  CALLS = 3,
  POIS = 4,
  CUSTOM = 5,
}

interface UseMapLayersOptions {
  initialLayerType?: MapLayerType;
  autoFetch?: boolean;
}

interface UseMapLayersResult {
  layers: GetMapLayersData[];
  visibleLayers: Set<string>;
  isLoading: boolean;
  error: Error | null;
  fetchLayers: (type?: MapLayerType) => Promise<void>;
  toggleLayer: (layerId: string) => void;
  setLayerVisibility: (layerId: string, visible: boolean) => void;
  showAllLayers: () => void;
  hideAllLayers: () => void;
  /**
   * Stable array of the currently visible layers.
   *
   * Prefer this over `getVisibleLayerData()` when passing layers to a component: the getter
   * allocates a fresh array on every call, so calling it inline in JSX changes the prop identity
   * on every render and forces consumers to tear down and rebuild their GeoJSON sources.
   */
  visibleLayerData: GetMapLayersData[];
  getVisibleLayerData: () => GetMapLayersData[];
}

/**
 * Hook to manage map layers fetched from the getMayLayers API.
 * Handles fetching, caching, and visibility toggling of map layers.
 */
export const useMapLayers = (options: UseMapLayersOptions = {}): UseMapLayersResult => {
  const { initialLayerType = MapLayerType.ALL, autoFetch = true } = options;

  const [layers, setLayers] = useState<GetMapLayersData[]>([]);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const fetchLayers = useCallback(
    async (type: MapLayerType = initialLayerType) => {
      // Cancel any previous request
      if (abortController.current) {
        abortController.current.abort();
      }

      abortController.current = new AbortController();
      setIsLoading(true);
      setError(null);

      try {
        logger.debug({
          message: 'Fetching map layers',
          context: { type },
        });

        const response = await getMayLayers(type, abortController.current.signal);

        if (response?.Data?.Layers) {
          const fetchedLayers = response.Data.Layers;
          setLayers(fetchedLayers);

          // Initialize visibility based on IsOnByDefault
          const defaultVisible = new Set<string>();
          fetchedLayers.forEach((layer) => {
            if (layer.IsOnByDefault) {
              defaultVisible.add(layer.Id);
            }
          });
          setVisibleLayers(defaultVisible);

          logger.info({
            message: 'Map layers fetched successfully',
            context: {
              layerCount: fetchedLayers.length,
              defaultVisibleCount: defaultVisible.size,
            },
          });
        }
      } catch (err) {
        // Don't log aborted requests as errors
        if (err instanceof Error && (err.name === 'AbortError' || err.message === 'canceled')) {
          logger.debug({
            message: 'Map layers fetch was aborted',
          });
          return;
        }

        const error = err instanceof Error ? err : new Error('Failed to fetch map layers');
        setError(error);
        logger.error({
          message: 'Failed to fetch map layers',
          context: { error: err },
        });
      } finally {
        setIsLoading(false);
      }
    },
    [initialLayerType]
  );

  const toggleLayer = useCallback((layerId: string) => {
    setVisibleLayers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(layerId)) {
        newSet.delete(layerId);
      } else {
        newSet.add(layerId);
      }
      return newSet;
    });
  }, []);

  const setLayerVisibility = useCallback((layerId: string, visible: boolean) => {
    setVisibleLayers((prev) => {
      const newSet = new Set(prev);
      if (visible) {
        newSet.add(layerId);
      } else {
        newSet.delete(layerId);
      }
      return newSet;
    });
  }, []);

  const showAllLayers = useCallback(() => {
    setVisibleLayers(new Set(layers.map((layer) => layer.Id)));
  }, [layers]);

  const hideAllLayers = useCallback(() => {
    setVisibleLayers(new Set());
  }, []);

  const visibleLayerData = useMemo(() => layers.filter((layer) => visibleLayers.has(layer.Id)), [layers, visibleLayers]);

  const getVisibleLayerData = useCallback((): GetMapLayersData[] => visibleLayerData, [visibleLayerData]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      fetchLayers();
    }

    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, [autoFetch, fetchLayers]);

  return {
    layers,
    visibleLayers,
    isLoading,
    error,
    fetchLayers,
    toggleLayer,
    setLayerVisibility,
    showAllLayers,
    hideAllLayers,
    visibleLayerData,
    getVisibleLayerData,
  };
};
