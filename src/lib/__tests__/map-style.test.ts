import { FALLBACK_DAY_MAP_STYLE, FALLBACK_NIGHT_MAP_STYLE, getDepartmentMapStyle, resolveDepartmentMapStyle } from '@/lib/map-style';
import { useCoreStore } from '@/stores/app/core-store';

jest.mock('nativewind', () => ({
  useColorScheme: jest.fn(() => ({ colorScheme: 'light' })),
}));

jest.mock('@/stores/app/core-store', () => ({
  useCoreStore: { getState: jest.fn() },
}));

let mockActiveToken = 'pk.builtin.token';

jest.mock('@/lib/mapbox-token', () => ({
  getMapboxAccessToken: jest.fn(() => mockActiveToken),
  useMapboxAccessToken: jest.fn(() => mockActiveToken),
}));

const mockedGetState = useCoreStore.getState as unknown as jest.Mock;

const SATELLITE = 'mapbox://styles/mapbox/satellite-v9';
const NAVIGATION_NIGHT = 'mapbox://styles/mapbox/navigation-night-v1';
const CUSTOM = 'mapbox://styles/county-fire/ckcustom123';
const COMMUNITY = 'mapbox://styles/mapbox-map-design/cks97e1e37nsd17nzg7p0308g';
const DEPARTMENT_TOKEN = 'pk.department.token';

describe('resolveDepartmentMapStyle', () => {
  it('uses the day style in a light theme', () => {
    expect(resolveDepartmentMapStyle({ MapDayStyleUrl: SATELLITE, MapNightStyleUrl: NAVIGATION_NIGHT }, 'light')).toBe(SATELLITE);
  });

  it('uses the night style in a dark theme', () => {
    expect(resolveDepartmentMapStyle({ MapDayStyleUrl: SATELLITE, MapNightStyleUrl: NAVIGATION_NIGHT }, 'dark')).toBe(NAVIGATION_NIGHT);
  });

  it('treats an unknown theme as day', () => {
    expect(resolveDepartmentMapStyle({ MapDayStyleUrl: SATELLITE, MapNightStyleUrl: NAVIGATION_NIGHT }, undefined)).toBe(SATELLITE);
  });

  it('falls back to Streets / Dark before config loads', () => {
    expect(resolveDepartmentMapStyle(null, 'light')).toBe(FALLBACK_DAY_MAP_STYLE);
    expect(resolveDepartmentMapStyle(null, 'dark')).toBe(FALLBACK_NIGHT_MAP_STYLE);
  });

  it('falls back when an older server sends no style', () => {
    expect(resolveDepartmentMapStyle({}, 'light')).toBe(FALLBACK_DAY_MAP_STYLE);
    expect(resolveDepartmentMapStyle({ MapDayStyleUrl: '', MapNightStyleUrl: '' }, 'dark')).toBe(FALLBACK_NIGHT_MAP_STYLE);
  });

  it('rejects anything that is not a mapbox:// style', () => {
    // A raster tile url or an http style would not load on the app's own Mapbox token.
    expect(resolveDepartmentMapStyle({ MapDayStyleUrl: 'https://tiles.example.com/{z}/{x}/{y}.png' }, 'light')).toBe(FALLBACK_DAY_MAP_STYLE);
  });

  it('trims surrounding whitespace', () => {
    expect(resolveDepartmentMapStyle({ MapDayStyleUrl: `  ${SATELLITE} ` }, 'light')).toBe(SATELLITE);
  });

  it('uses a department custom style once its token is the one in use', () => {
    const config = { MapDayStyleUrl: CUSTOM, MapNightStyleUrl: CUSTOM, AppMapboxAccessToken: DEPARTMENT_TOKEN, IsDepartmentMapOverride: true };

    expect(resolveDepartmentMapStyle(config, 'light', DEPARTMENT_TOKEN)).toBe(CUSTOM);
    expect(resolveDepartmentMapStyle(config, 'dark', DEPARTMENT_TOKEN)).toBe(CUSTOM);
  });

  it('holds a custom style back until the department token is active', () => {
    // The custom style would load blank on the built-in token.
    const config = { MapDayStyleUrl: CUSTOM, MapNightStyleUrl: CUSTOM, AppMapboxAccessToken: DEPARTMENT_TOKEN, IsDepartmentMapOverride: true };

    expect(resolveDepartmentMapStyle(config, 'light', 'pk.builtin.token')).toBe(FALLBACK_DAY_MAP_STYLE);
    expect(resolveDepartmentMapStyle(config, 'dark', undefined)).toBe(FALLBACK_NIGHT_MAP_STYLE);
  });

  it('never uses an override style the server sent without a token', () => {
    expect(resolveDepartmentMapStyle({ MapDayStyleUrl: CUSTOM, IsDepartmentMapOverride: true }, 'light', 'pk.builtin.token')).toBe(FALLBACK_DAY_MAP_STYLE);
  });

  it('uses Mapbox styles on any token', () => {
    expect(resolveDepartmentMapStyle({ MapDayStyleUrl: SATELLITE, AppMapboxAccessToken: DEPARTMENT_TOKEN }, 'light', 'pk.builtin.token')).toBe(SATELLITE);
  });

  it('uses community styles on any token, with or without a server token', () => {
    // Gallery styles live under mapbox-map-design and are public.
    expect(resolveDepartmentMapStyle({ MapDayStyleUrl: COMMUNITY, AppMapboxAccessToken: '' }, 'light', 'pk.builtin.token')).toBe(COMMUNITY);
    expect(resolveDepartmentMapStyle({ MapDayStyleUrl: COMMUNITY, AppMapboxAccessToken: DEPARTMENT_TOKEN }, 'light', 'pk.builtin.token')).toBe(COMMUNITY);
    expect(resolveDepartmentMapStyle({ MapNightStyleUrl: COMMUNITY }, 'dark', undefined)).toBe(COMMUNITY);
  });
});

describe('getDepartmentMapStyle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the current config from the store', () => {
    mockedGetState.mockReturnValue({ config: { MapDayStyleUrl: SATELLITE, MapNightStyleUrl: NAVIGATION_NIGHT } });

    expect(getDepartmentMapStyle('dark')).toBe(NAVIGATION_NIGHT);
    expect(getDepartmentMapStyle('light')).toBe(SATELLITE);
  });

  it('falls back while the store has no config', () => {
    mockedGetState.mockReturnValue({ config: null });

    expect(getDepartmentMapStyle('dark')).toBe(FALLBACK_NIGHT_MAP_STYLE);
  });

  it('checks a custom style against the token in use', () => {
    mockedGetState.mockReturnValue({ config: { MapDayStyleUrl: CUSTOM, AppMapboxAccessToken: DEPARTMENT_TOKEN, IsDepartmentMapOverride: true } });

    mockActiveToken = 'pk.builtin.token';
    expect(getDepartmentMapStyle('light')).toBe(FALLBACK_DAY_MAP_STYLE);

    mockActiveToken = DEPARTMENT_TOKEN;
    expect(getDepartmentMapStyle('light')).toBe(CUSTOM);
  });
});
