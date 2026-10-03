import {
  applyServerMapboxToken,
  clearMapboxToken,
  getBuiltInMapboxToken,
  getMapboxAccessToken,
  isUsableMapboxToken,
  MAPBOX_TOKEN_RECHECK_MS,
  onMapboxAccessTokenChange,
  useMapboxTokenStore,
  verifyMapboxToken,
} from '@/lib/mapbox-token';

jest.mock('@/lib/mapbox-built-in-token', () => ({
  MAPBOX_BUILT_IN_TOKEN: 'pk.builtin.signature',
}));

// The map lives inside the factory: persist reads storage while the module under test is imported,
// which happens before any top-level const in this file is initialised.
jest.mock('@/lib/storage', () => {
  const store = new Map<string, string>();

  return {
    __store: store,
    zustandStorage: {
      getItem: (name: string) => store.get(name) ?? null,
      setItem: (name: string, value: string) => {
        store.set(name, value);
      },
      removeItem: (name: string) => {
        store.delete(name);
      },
    },
  };
});

const mockStorage: Map<string, string> = jest.requireMock('@/lib/storage').__store;

const SERVER_TOKEN = 'pk.eyJ1IjoiY291bnR5LWZpcmUifQ.server-signature_1';
const OTHER_TOKEN = 'pk.eyJ1Ijoib3RoZXIifQ.other-signature';

const mockFetchCode = (code: string | null) => {
  (global as any).fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve(code === null ? {} : { code }),
  });
};

const mockFetchFailure = () => {
  (global as any).fetch = jest.fn().mockRejectedValue(new Error('Network request failed'));
};

describe('mapbox-token', () => {
  const originalFetch = (global as any).fetch;

  beforeEach(() => {
    clearMapboxToken();
    mockStorage.clear();
  });

  afterAll(() => {
    (global as any).fetch = originalFetch;
  });

  describe('isUsableMapboxToken', () => {
    it('accepts public tokens', () => {
      expect(isUsableMapboxToken(SERVER_TOKEN)).toBe(true);
      expect(isUsableMapboxToken(`  ${SERVER_TOKEN} `)).toBe(true);
    });

    it('refuses secret, temporary, empty and malformed tokens', () => {
      expect(isUsableMapboxToken('sk.eyJ1IjoieCJ9.secret')).toBe(false);
      expect(isUsableMapboxToken('tk.eyJ1IjoieCJ9.temp')).toBe(false);
      expect(isUsableMapboxToken('')).toBe(false);
      expect(isUsableMapboxToken(null)).toBe(false);
      expect(isUsableMapboxToken(undefined)).toBe(false);
      expect(isUsableMapboxToken('pk.only-one-part')).toBe(false);
      expect(isUsableMapboxToken('pk.has spaces.inside')).toBe(false);
    });
  });

  it('uses the built-in token until the server sends one', () => {
    expect(getBuiltInMapboxToken()).toBe('pk.builtin.signature');
    expect(getMapboxAccessToken()).toBe('pk.builtin.signature');
  });

  it('adopts and stores a server token Mapbox confirms', async () => {
    mockFetchCode('TokenValid');

    await applyServerMapboxToken(SERVER_TOKEN);

    expect(getMapboxAccessToken()).toBe(SERVER_TOKEN);
    expect((global as any).fetch).toHaveBeenCalledWith(expect.stringContaining('https://api.mapbox.com/tokens/v2?access_token='));
    expect(mockStorage.get('mapbox-token-storage')).toContain(SERVER_TOKEN);
  });

  it('does not re-check a confirmed token on every config load', async () => {
    mockFetchCode('TokenValid');
    await applyServerMapboxToken(SERVER_TOKEN);
    (global as any).fetch.mockClear();

    await applyServerMapboxToken(SERVER_TOKEN);

    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('re-checks a confirmed token once a day and drops it when revoked', async () => {
    mockFetchCode('TokenValid');
    await applyServerMapboxToken(SERVER_TOKEN);

    mockFetchCode('TokenRevoked');
    await applyServerMapboxToken(SERVER_TOKEN, Date.now() + MAPBOX_TOKEN_RECHECK_MS + 1);

    expect(getMapboxAccessToken()).toBe('pk.builtin.signature');
  });

  it.each(['TokenInvalid', 'TokenExpired', 'TokenRevoked', 'TokenMalformed'])('falls back to the built-in token when Mapbox says %s', async (code) => {
    mockFetchCode('TokenValid');
    await applyServerMapboxToken(OTHER_TOKEN);

    mockFetchCode(code);
    await applyServerMapboxToken(SERVER_TOKEN);

    expect(getMapboxAccessToken()).toBe('pk.builtin.signature');
  });

  it('does not re-check a recently refused token', async () => {
    mockFetchCode('TokenInvalid');
    await applyServerMapboxToken(SERVER_TOKEN);
    (global as any).fetch.mockClear();

    await applyServerMapboxToken(SERVER_TOKEN);

    expect((global as any).fetch).not.toHaveBeenCalled();
    expect(getMapboxAccessToken()).toBe('pk.builtin.signature');
  });

  it('keeps the token in use when Mapbox cannot be reached', async () => {
    mockFetchCode('TokenValid');
    await applyServerMapboxToken(OTHER_TOKEN);

    mockFetchFailure();
    await applyServerMapboxToken(SERVER_TOKEN);

    expect(getMapboxAccessToken()).toBe(OTHER_TOKEN);
  });

  it('keeps the token in use on an unexpected Mapbox answer', async () => {
    expect(await (mockFetchCode(null), verifyMapboxToken(SERVER_TOKEN))).toBe('unknown');
  });

  it('drops the stored token when the server stops sending one', async () => {
    mockFetchCode('TokenValid');
    await applyServerMapboxToken(SERVER_TOKEN);

    await applyServerMapboxToken('');

    expect(getMapboxAccessToken()).toBe('pk.builtin.signature');
  });

  it('never checks or stores a secret token', async () => {
    mockFetchCode('TokenValid');

    await applyServerMapboxToken('sk.eyJ1IjoieCJ9.secret');

    expect((global as any).fetch).not.toHaveBeenCalled();
    expect(getMapboxAccessToken()).toBe('pk.builtin.signature');
  });

  it('tells listeners about the token now and on every change', async () => {
    const listener = jest.fn();
    const unsubscribe = onMapboxAccessTokenChange(listener);

    mockFetchCode('TokenValid');
    await applyServerMapboxToken(SERVER_TOKEN);
    clearMapboxToken();
    unsubscribe();
    await applyServerMapboxToken(OTHER_TOKEN);

    expect(listener.mock.calls.map((call) => call[0])).toEqual(['pk.builtin.signature', SERVER_TOKEN, 'pk.builtin.signature']);
  });

  it('starts from the stored token', () => {
    useMapboxTokenStore.setState({ token: SERVER_TOKEN, verifiedAt: Date.now() });

    expect(getMapboxAccessToken()).toBe(SERVER_TOKEN);
  });
});
