import { getConfig } from '@/api/config';
import { logger } from '@/lib/logging';
import { applyServerMapboxToken } from '@/lib/mapbox-token';
import { useCoreStore } from '@/stores/app/core-store';

jest.mock('@env', () => ({ Env: { APP_KEY: 'test-app-key' } }));
jest.mock('@/api/config', () => ({ getConfig: jest.fn() }));
jest.mock('@/api/units/units', () => ({ getUnits: jest.fn() }));
jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/lib/mapbox-token', () => ({ applyServerMapboxToken: jest.fn(() => Promise.resolve()) }));

const SERVER_TOKEN = 'pk.eyJ1IjoiY291bnR5LWZpcmUifQ.server-signature';

const mockGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;
const mockApplyServerMapboxToken = applyServerMapboxToken as jest.MockedFunction<typeof applyServerMapboxToken>;

const configResponse = (token: string) => ({ Data: { AppMapboxAccessToken: token, MapDayStyleUrl: '', MapNightStyleUrl: '' } }) as unknown as Awaited<ReturnType<typeof getConfig>>;

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('core store: server Mapbox token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApplyServerMapboxToken.mockImplementation(() => Promise.resolve());
    useCoreStore.setState({ config: null, isInitialized: false, isInitializing: false, isLoading: false, error: null });
  });

  it('applies the token from a config loaded at init', async () => {
    mockGetConfig.mockResolvedValue(configResponse(SERVER_TOKEN));

    await useCoreStore.getState().init();

    expect(useCoreStore.getState().isInitialized).toBe(true);
    expect(mockApplyServerMapboxToken).toHaveBeenCalledTimes(1);
    expect(mockApplyServerMapboxToken).toHaveBeenCalledWith(SERVER_TOKEN);
  });

  it('applies the token from a config refresh, including an empty one', async () => {
    mockGetConfig.mockResolvedValue(configResponse(''));

    await useCoreStore.getState().fetchConfig();

    expect(mockApplyServerMapboxToken).toHaveBeenCalledWith('');
  });

  it('leaves the token alone when init cannot load config', async () => {
    mockGetConfig.mockRejectedValue(new Error('offline'));

    await useCoreStore.getState().init();

    expect(useCoreStore.getState().error).toBe('Failed to init core app data');
    expect(mockApplyServerMapboxToken).not.toHaveBeenCalled();
  });

  it('leaves the token alone when a config refresh fails', async () => {
    mockGetConfig.mockRejectedValue(new Error('offline'));

    await expect(useCoreStore.getState().fetchConfig()).rejects.toThrow('offline');

    expect(mockApplyServerMapboxToken).not.toHaveBeenCalled();
  });

  it('does not wait on the token check', async () => {
    mockGetConfig.mockResolvedValue(configResponse(SERVER_TOKEN));
    mockApplyServerMapboxToken.mockImplementation(() => new Promise<void>(() => {}));

    await useCoreStore.getState().init();

    expect(useCoreStore.getState().isInitialized).toBe(true);
    expect(useCoreStore.getState().config?.AppMapboxAccessToken).toBe(SERVER_TOKEN);
  });

  it('does not fail config loading when the token check fails', async () => {
    mockGetConfig.mockResolvedValue(configResponse(SERVER_TOKEN));
    mockApplyServerMapboxToken.mockImplementation(() => Promise.reject(new Error('storage unavailable')));

    await useCoreStore.getState().init();
    await flushPromises();

    expect(useCoreStore.getState().isInitialized).toBe(true);
    expect(useCoreStore.getState().error).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ message: 'Failed to apply the server Mapbox token' }));
  });
});
