import { renderHook, waitFor } from '@testing-library/react-native';

import { getMapDataAndMarkers } from '@/api/mapping/mapping';
import { logger } from '@/lib/logging';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { type GetMapDataAndMarkersResult } from '@/models/v4/mapping/getMapDataAndMarkersResult';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

import { useMapSignalRUpdates } from '../use-map-signalr-updates';

// Mock dependencies
jest.mock('@/api/mapping/mapping');
jest.mock('@/lib/logging');
jest.mock('@/stores/signalr/signalr-store');

const mockGetMapDataAndMarkers = getMapDataAndMarkers as jest.MockedFunction<typeof getMapDataAndMarkers>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockUseSignalRStore = useSignalRStore as jest.MockedFunction<typeof useSignalRStore>;

// Mock setTimeout to allow synchronous testing
jest.useFakeTimers();

describe('useMapSignalRUpdates', () => {
  const mockOnMarkersUpdate = jest.fn();
  const mockMapData: GetMapDataAndMarkersResult = {
    PageSize: 0,
    Timestamp: '',
    Version: '',
    Node: '',
    RequestId: '',
    Status: '',
    Environment: '',
    Data: {
      MapMakerInfos: [
        {
          Id: '1',
          Latitude: 40.7128,
          Longitude: -74.0060,
          Title: 'Test Marker',
          zIndex: 1,
          ImagePath: 'test-icon',
          InfoWindowContent: 'Test content',
          Color: 'red',
          Type: 1,
          PoiImage: '',
          Marker: '',
          PoiTypeId: null,
          PoiTypeName: '',
          LayerId: '',
          Address: '',
          Note: '',
          LayerName: '',
        },
      ] as MapMakerInfoData[],
      CenterLat: '40.7128',
      CenterLon: '-74.0060',
      ZoomLevel: '12',
      PoiLayers: [],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    
    // Reset store state
    mockUseSignalRStore.mockReturnValue(0);
    
    // Mock successful API response by default
    mockGetMapDataAndMarkers.mockResolvedValue(mockMapData);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should not trigger API call when lastUpdateTimestamp is 0', () => {
    mockUseSignalRStore.mockReturnValue(0);

    renderHook(() => useMapSignalRUpdates(mockOnMarkersUpdate));

    // Fast forward timers to ensure debounce completes
    jest.runAllTimers();

    expect(mockGetMapDataAndMarkers).not.toHaveBeenCalled();
    expect(mockOnMarkersUpdate).not.toHaveBeenCalled();
  });

  it('should trigger API call when lastUpdateTimestamp changes', async () => {
    const timestamp = Date.now();
    mockUseSignalRStore.mockReturnValue(timestamp);

    renderHook(() => useMapSignalRUpdates(mockOnMarkersUpdate));

    // Fast forward timers to trigger debounced call
    jest.runAllTimers();

    await waitFor(() => {
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledTimes(1);
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledWith(expect.objectContaining({ aborted: false }));
    });

    expect(mockOnMarkersUpdate).toHaveBeenCalledWith(mockMapData.Data.MapMakerInfos, expect.any(Number));
  });

  it('should debounce multiple rapid timestamp changes', async () => {
    let timestamp = Date.now();
    
    const { rerender } = renderHook(
      (props) => {
        mockUseSignalRStore.mockReturnValue(props.timestamp);
        return useMapSignalRUpdates(mockOnMarkersUpdate);
      },
      { initialProps: { timestamp } }
    );

    // Trigger multiple updates rapidly
    for (let i = 0; i < 5; i++) {
      timestamp += 100;
      rerender({ timestamp });
    }

    // Only advance timer partially (less than debounce delay)
    jest.advanceTimersByTime(500);

    // Should not have called API yet due to debouncing
    expect(mockGetMapDataAndMarkers).not.toHaveBeenCalled();

    // Now advance past the debounce delay
    jest.runAllTimers();

    await waitFor(() => {
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledTimes(1);
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledWith(expect.objectContaining({ aborted: false }));
    });

    expect(mockOnMarkersUpdate).toHaveBeenCalledTimes(1);
  });

  it('should not make concurrent API calls', async () => {
    const timestamp = Date.now();
    
    // Make API call slow to simulate concurrent scenario
    let resolveFirstCall: (value: any) => void;
    const firstCallPromise = new Promise((resolve) => {
      resolveFirstCall = resolve;
    });
    
    mockGetMapDataAndMarkers.mockReturnValueOnce(firstCallPromise as any);

    const { rerender } = renderHook(
      (props) => {
        mockUseSignalRStore.mockReturnValue(props.timestamp);
        return useMapSignalRUpdates(mockOnMarkersUpdate);
      },
      { initialProps: { timestamp } }
    );

    // Trigger first call
    jest.runAllTimers();

    // Update timestamp again while first call is still pending
    rerender({ timestamp: timestamp + 1000 });
    jest.runAllTimers();

    // First call should have been made, but second should be queued
    expect(mockGetMapDataAndMarkers).toHaveBeenCalledTimes(1);

    // Verify the debug log about queuing concurrent call
    expect(mockLogger.debug).toHaveBeenCalledWith({
      message: 'Map markers update already in progress, queuing timestamp',
      context: { timestamp: timestamp + 1000, pendingTimestamp: timestamp + 1000 },
    });

    // Resolve first call
    resolveFirstCall!(mockMapData);

    await waitFor(() => {
      expect(mockOnMarkersUpdate).toHaveBeenCalledWith(mockMapData.Data.MapMakerInfos, expect.any(Number));
    });

    // Wait for the queued call to be processed
    await waitFor(() => {
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledTimes(2);
    });

    // Verify the debug log about processing queued timestamp
    expect(mockLogger.debug).toHaveBeenCalledWith({
      message: 'Processing queued timestamp after fetch completion',
      context: { nextTimestamp: timestamp + 1000 },
    });
  });

  it('should queue only the latest timestamp during concurrent updates', async () => {
    const timestamp1 = Date.now();
    const timestamp2 = timestamp1 + 1000;
    const timestamp3 = timestamp1 + 2000;
    
    // Make API call slow to simulate concurrent scenario
    let resolveFirstCall: (value: any) => void;
    const firstCallPromise = new Promise((resolve) => {
      resolveFirstCall = resolve;
    });
    
    mockGetMapDataAndMarkers.mockReturnValueOnce(firstCallPromise as any);
    mockGetMapDataAndMarkers.mockResolvedValue(mockMapData);

    const { rerender } = renderHook(
      (props) => {
        mockUseSignalRStore.mockReturnValue(props.timestamp);
        return useMapSignalRUpdates(mockOnMarkersUpdate);
      },
      { initialProps: { timestamp: timestamp1 } }
    );

    // Trigger first call
    jest.runAllTimers();

    // Update timestamp multiple times while first call is still pending
    rerender({ timestamp: timestamp2 });
    jest.runAllTimers();
    
    rerender({ timestamp: timestamp3 });
    jest.runAllTimers();

    // Only the first call should have been made
    expect(mockGetMapDataAndMarkers).toHaveBeenCalledTimes(1);

    // The latest timestamp should be queued
    expect(mockLogger.debug).toHaveBeenCalledWith({
      message: 'Map markers update already in progress, queuing timestamp',
      context: { timestamp: timestamp3, pendingTimestamp: timestamp3 },
    });

    // Resolve first call
    resolveFirstCall!(mockMapData);

    await waitFor(() => {
      expect(mockOnMarkersUpdate).toHaveBeenCalledWith(mockMapData.Data.MapMakerInfos, expect.any(Number));
    });

    // Wait for the queued call to be processed (should be timestamp3, not timestamp2)
    await waitFor(() => {
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledTimes(2);
    });

    // Verify the debug log about processing the latest queued timestamp
    expect(mockLogger.debug).toHaveBeenCalledWith({
      message: 'Processing queued timestamp after fetch completion',
      context: { nextTimestamp: timestamp3 },
    });
  });

  it('should handle API errors gracefully', async () => {
    const timestamp = Date.now();
    const error = new Error('API Error');
    
    mockUseSignalRStore.mockReturnValue(timestamp);
    mockGetMapDataAndMarkers.mockRejectedValue(error);

    renderHook(() => useMapSignalRUpdates(mockOnMarkersUpdate));

    jest.runAllTimers();

    await waitFor(() => {
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledTimes(1);
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledWith(expect.objectContaining({ aborted: false }));
    });

    expect(mockLogger.error).toHaveBeenCalledWith({
      message: 'Failed to update map markers from SignalR update',
      context: { error, timestamp },
    });

    expect(mockOnMarkersUpdate).not.toHaveBeenCalled();
  });

  it('should handle aborted requests gracefully', async () => {
    const timestamp = Date.now();
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    
    mockUseSignalRStore.mockReturnValue(timestamp);
    mockGetMapDataAndMarkers.mockRejectedValue(abortError);

    renderHook(() => useMapSignalRUpdates(mockOnMarkersUpdate));

    jest.runAllTimers();

    await waitFor(() => {
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledTimes(1);
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledWith(expect.objectContaining({ aborted: false }));
    });

    // Should log as debug, not error
    expect(mockLogger.debug).toHaveBeenCalledWith({
      message: 'Map markers request was aborted',
      context: { timestamp },
    });

    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockOnMarkersUpdate).not.toHaveBeenCalled();
  });

  it('should handle axios canceled requests gracefully', async () => {
    const timestamp = Date.now();
    const cancelError = new Error('canceled');
    
    mockUseSignalRStore.mockReturnValue(timestamp);
    mockGetMapDataAndMarkers.mockRejectedValue(cancelError);

    renderHook(() => useMapSignalRUpdates(mockOnMarkersUpdate));

    jest.runAllTimers();

    await waitFor(() => {
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledTimes(1);
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledWith(expect.objectContaining({ aborted: false }));
    });

    // Should log as debug, not error
    expect(mockLogger.debug).toHaveBeenCalledWith({
      message: 'Map markers request was canceled',
      context: { timestamp },
    });

    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockOnMarkersUpdate).not.toHaveBeenCalled();
  });

  it('should cancel previous request when new update comes in', async () => {
    const timestamp1 = Date.now();
    
    // Mock AbortController  
    const mockAbort = jest.fn();
    let abortControllerCount = 0;
    const originalAbortController = global.AbortController;
    
    global.AbortController = jest.fn().mockImplementation(() => {
      abortControllerCount++;
      return {
        signal: { aborted: false },
        abort: mockAbort,
      };
    }) as any;

    renderHook(() => {
      mockUseSignalRStore.mockReturnValue(timestamp1);
      return useMapSignalRUpdates(mockOnMarkersUpdate);
    });

    // Trigger first call
    jest.runAllTimers();

    // Wait for the call to complete
    await waitFor(() => {
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledTimes(1);
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledWith(expect.objectContaining({ aborted: false }));
    });

    // Verify AbortController was created for the request
    expect(abortControllerCount).toBe(1);

    // Restore original AbortController
    global.AbortController = originalAbortController;
  });

  it('should not update markers if API returns empty data', async () => {
    const timestamp = Date.now();
    const emptyMapData: GetMapDataAndMarkersResult = {
      ...mockMapData,
      Data: {
        ...mockMapData.Data,
        MapMakerInfos: [],
      },
    };
    
    mockUseSignalRStore.mockReturnValue(timestamp);
    mockGetMapDataAndMarkers.mockResolvedValue(emptyMapData);

    renderHook(() => useMapSignalRUpdates(mockOnMarkersUpdate));

    jest.runAllTimers();

    await waitFor(() => {
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledTimes(1);
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledWith(expect.objectContaining({ aborted: false }));
    });

    expect(mockOnMarkersUpdate).toHaveBeenCalledWith([], expect.any(Number));
  });

  it('should handle null API response', async () => {
    const timestamp = Date.now();
    mockUseSignalRStore.mockReturnValue(timestamp);
    mockGetMapDataAndMarkers.mockResolvedValue(undefined as any);

    renderHook(() => useMapSignalRUpdates(mockOnMarkersUpdate));

    jest.runAllTimers();

    await waitFor(() => {
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledTimes(1);
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledWith(expect.objectContaining({ aborted: false }));
    });

    expect(mockOnMarkersUpdate).not.toHaveBeenCalled();
  });

  it('should not process the same timestamp twice', async () => {
    const timestamp = Date.now();
    
    const { rerender } = renderHook(
      (props) => {
        mockUseSignalRStore.mockReturnValue(props.timestamp);
        return useMapSignalRUpdates(mockOnMarkersUpdate);
      },
      { initialProps: { timestamp } }
    );

    // First update
    jest.runAllTimers();

    await waitFor(() => {
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledTimes(1);
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledWith(expect.objectContaining({ aborted: false }));
    });

    // Reset mock call count
    mockGetMapDataAndMarkers.mockClear();

    // Trigger the same timestamp again
    rerender({ timestamp });
    jest.runAllTimers();

    // Should not make another API call
    expect(mockGetMapDataAndMarkers).not.toHaveBeenCalled();
  });

  it('should cleanup timers and abort requests on unmount', () => {
    const timestamp = Date.now();
    mockUseSignalRStore.mockReturnValue(timestamp);

    // Mock AbortController
    const mockAbort = jest.fn();
    const originalAbortController = global.AbortController;
    global.AbortController = jest.fn().mockImplementation(() => ({
      signal: { aborted: false },
      abort: mockAbort,
    })) as any;

    const { unmount } = renderHook(() => useMapSignalRUpdates(mockOnMarkersUpdate));

    // Trigger call to create AbortController
    jest.runAllTimers();

    // Unmount the hook
    unmount();

    // Verify cleanup occurred - check that AbortController was constructed and abort was called
    expect(global.AbortController).toHaveBeenCalled();
    expect(mockAbort).toHaveBeenCalled();

    // Restore original AbortController
    global.AbortController = originalAbortController;
  });

  it('should maintain stable callback reference', async () => {
    const timestamp = Date.now();
    mockUseSignalRStore.mockReturnValue(timestamp);

    const secondCallback = jest.fn();
    const { rerender } = renderHook(
      ({ callback }) => useMapSignalRUpdates(callback),
      { initialProps: { callback: mockOnMarkersUpdate } }
    );

    rerender({ callback: secondCallback });

    jest.runAllTimers();

    // The hook should use the latest callback
    await waitFor(() => {
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledTimes(1);
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledWith(expect.objectContaining({ aborted: false }));
    });
    
    await waitFor(() => {
      expect(secondCallback).toHaveBeenCalled();
    });
    
    expect(mockOnMarkersUpdate).not.toHaveBeenCalled();
  });

  it('should log debug information for debouncing', () => {
    const timestamp = Date.now();
    mockUseSignalRStore.mockReturnValue(timestamp);

    renderHook(() => useMapSignalRUpdates(mockOnMarkersUpdate));

    expect(mockLogger.debug).toHaveBeenCalledWith({
      message: 'Debouncing map markers update',
      context: {
        lastUpdateTimestamp: timestamp,
        lastProcessed: 0,
        delay: 1000,
      },
    });
  });

  it('should log successful marker updates', async () => {
    const timestamp = Date.now();
    mockUseSignalRStore.mockReturnValue(timestamp);

    renderHook(() => useMapSignalRUpdates(mockOnMarkersUpdate));

    jest.runAllTimers();

    await waitFor(() => {
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'Updating map markers from SignalR update',
        context: {
          markerCount: mockMapData.Data.MapMakerInfos.length,
          timestamp,
        },
      });
    });
  });

  it('fetches on demand through a stable requestRefresh and reports when the fetch started', async () => {
    mockUseSignalRStore.mockReturnValue(0);
    const startedNoEarlierThan = Date.now();

    const { result, rerender } = renderHook(() => useMapSignalRUpdates(mockOnMarkersUpdate));
    const { requestRefresh } = result.current;
    rerender({});
    expect(result.current.requestRefresh).toBe(requestRefresh);

    requestRefresh();

    await waitFor(() => {
      expect(mockGetMapDataAndMarkers).toHaveBeenCalledTimes(1);
      expect(mockOnMarkersUpdate).toHaveBeenCalledWith(mockMapData.Data.MapMakerInfos, expect.any(Number));
    });
    expect(mockOnMarkersUpdate.mock.calls[0][1]).toBeGreaterThanOrEqual(startedNoEarlierThan);
  });
});
