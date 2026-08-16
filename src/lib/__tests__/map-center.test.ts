import { FALLBACK_MAP_CENTER, getDepartmentMapCenter } from '@/lib/map-center';
import { useCoreStore } from '@/stores/app/core-store';

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: { getState: jest.fn() },
}));

const mockedGetState = useCoreStore.getState as unknown as jest.Mock;

const withConfig = (config: Record<string, unknown> | null) => {
  mockedGetState.mockReturnValue({ config });
};

describe('getDepartmentMapCenter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the department centre the server resolved', () => {
    withConfig({ MapCenterLatitude: 50.8698, MapCenterLongitude: 3.8102, MapCenterZoomLevel: 12 });

    expect(getDepartmentMapCenter()).toEqual({ latitude: 50.8698, longitude: 3.8102, zoomLevel: 12 });
  });

  it('falls back while config has not loaded yet', () => {
    withConfig(null);

    expect(getDepartmentMapCenter()).toEqual(FALLBACK_MAP_CENTER);
  });

  it('treats 0,0 as unset rather than dropping the user in the Atlantic', () => {
    // Null Island is the shape of a missing value, never a real department.
    withConfig({ MapCenterLatitude: 0, MapCenterLongitude: 0, MapCenterZoomLevel: 9 });

    expect(getDepartmentMapCenter()).toEqual(FALLBACK_MAP_CENTER);
  });

  it('rejects a half-populated centre', () => {
    withConfig({ MapCenterLatitude: 50.8698, MapCenterLongitude: null, MapCenterZoomLevel: 9 });

    expect(getDepartmentMapCenter()).toEqual(FALLBACK_MAP_CENTER);
  });

  it('defaults the zoom when the department has not set one', () => {
    withConfig({ MapCenterLatitude: 50.8698, MapCenterLongitude: 3.8102, MapCenterZoomLevel: 0 });

    expect(getDepartmentMapCenter().zoomLevel).toBe(FALLBACK_MAP_CENTER.zoomLevel);
  });

  it('rejects non-finite coordinates', () => {
    withConfig({ MapCenterLatitude: Number.NaN, MapCenterLongitude: 3.8102, MapCenterZoomLevel: 9 });

    expect(getDepartmentMapCenter()).toEqual(FALLBACK_MAP_CENTER);
  });

  it('keeps a zero on a single axis', () => {
    // The equator and the prime meridian are real places, not the shape of an unset field. Only the
    // 0,0 pair is treated as missing.
    withConfig({ MapCenterLatitude: 0, MapCenterLongitude: -0.1278, MapCenterZoomLevel: 11 });
    expect(getDepartmentMapCenter()).toEqual({ latitude: 0, longitude: -0.1278, zoomLevel: 11 });

    withConfig({ MapCenterLatitude: 5.6037, MapCenterLongitude: 0, MapCenterZoomLevel: 11 });
    expect(getDepartmentMapCenter()).toEqual({ latitude: 5.6037, longitude: 0, zoomLevel: 11 });
  });

  it('rejects out-of-range coordinates', () => {
    const cases = [
      { MapCenterLatitude: 91, MapCenterLongitude: 4.3517 },
      { MapCenterLatitude: -90.5, MapCenterLongitude: 4.3517 },
      { MapCenterLatitude: 50.8503, MapCenterLongitude: 181 },
      { MapCenterLatitude: 50.8503, MapCenterLongitude: -180.1 },
    ];

    for (const center of cases) {
      withConfig({ ...center, MapCenterZoomLevel: 11 });

      expect(getDepartmentMapCenter()).toEqual(FALLBACK_MAP_CENTER);
    }
  });

  it('accepts the range boundaries', () => {
    withConfig({ MapCenterLatitude: -90, MapCenterLongitude: 180, MapCenterZoomLevel: 3 });

    expect(getDepartmentMapCenter()).toEqual({ latitude: -90, longitude: 180, zoomLevel: 3 });
  });

  it('rejects a non-finite zoom while keeping the coordinates', () => {
    // Infinity is greater than zero, so the positivity test alone would let it reach the camera.
    for (const zoom of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN]) {
      withConfig({ MapCenterLatitude: 50.8503, MapCenterLongitude: 4.3517, MapCenterZoomLevel: zoom });

      expect(getDepartmentMapCenter()).toEqual({ latitude: 50.8503, longitude: 4.3517, zoomLevel: FALLBACK_MAP_CENTER.zoomLevel });
    }
  });
});
