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
});
