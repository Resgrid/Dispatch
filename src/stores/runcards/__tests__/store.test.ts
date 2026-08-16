import { escalateCall, getDispatchRecommendation } from '@/api/runcards/runcards';
import { isRunCardsEnabled } from '@/stores/feature-flags/store';
import { useRunCardsStore } from '@/stores/runcards/store';

jest.mock('@/api/runcards/runcards', () => ({
  getDispatchRecommendation: jest.fn(),
  escalateCall: jest.fn(),
}));

jest.mock('@/stores/feature-flags/store', () => ({
  isRunCardsEnabled: jest.fn(() => true),
}));

jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const mockedGetRecommendation = getDispatchRecommendation as jest.Mock;
const mockedEscalate = escalateCall as jest.Mock;
const mockedIsEnabled = isRunCardsEnabled as jest.Mock;

const validRequest = { priority: 1, type: 'Structure Fire', latitude: 51.1, longitude: 3.8, alarmLevel: 1 };

describe('run cards store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsEnabled.mockReturnValue(true);
    useRunCardsStore.getState().clear();
  });

  describe('feature gating', () => {
    it('does not call the API when Dispatch.RunCards is off', async () => {
      // The server 404s this endpoint with the toggle off; a client that calls anyway would render
      // a permanent error on a department that simply does not use run cards.
      mockedIsEnabled.mockReturnValue(false);

      await useRunCardsStore.getState().fetchRecommendation(validRequest);

      expect(mockedGetRecommendation).not.toHaveBeenCalled();
      expect(useRunCardsStore.getState().recommendation).toBeNull();
      expect(useRunCardsStore.getState().hasFetched).toBe(false);
      expect(useRunCardsStore.getState().error).toBeNull();
    });

    it('does not escalate when Dispatch.RunCards is off', async () => {
      mockedIsEnabled.mockReturnValue(false);

      const result = await useRunCardsStore.getState().escalate('42');

      expect(mockedEscalate).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('fetchRecommendation', () => {
    it('skips the request until both trigger inputs are present', async () => {
      // Run cards match on priority and/or call type; asking before the dispatcher picked them
      // just burns a round trip through the whole selection engine.
      await useRunCardsStore.getState().fetchRecommendation({ ...validRequest, type: '' });
      await useRunCardsStore.getState().fetchRecommendation({ ...validRequest, priority: undefined as unknown as number });

      expect(mockedGetRecommendation).not.toHaveBeenCalled();
    });

    it('stores a matched recommendation', async () => {
      const recommendation = { MatchedRunCardId: 3, Units: [], Personnel: [] };
      mockedGetRecommendation.mockResolvedValue(recommendation);

      await useRunCardsStore.getState().fetchRecommendation(validRequest);

      expect(mockedGetRecommendation).toHaveBeenCalledTimes(1);
      expect(useRunCardsStore.getState().recommendation).toBe(recommendation);
      expect(useRunCardsStore.getState().hasFetched).toBe(true);
      expect(useRunCardsStore.getState().isLoading).toBe(false);
    });

    it('records a null result as "asked, nothing matched"', async () => {
      mockedGetRecommendation.mockResolvedValue(null);

      await useRunCardsStore.getState().fetchRecommendation(validRequest);

      expect(useRunCardsStore.getState().recommendation).toBeNull();
      expect(useRunCardsStore.getState().hasFetched).toBe(true);
      expect(useRunCardsStore.getState().error).toBeNull();
    });

    it('surfaces a failure without blocking the manual flow', async () => {
      mockedGetRecommendation.mockRejectedValue(new Error('boom'));

      await useRunCardsStore.getState().fetchRecommendation(validRequest);

      expect(useRunCardsStore.getState().error).toBe('boom');
      expect(useRunCardsStore.getState().recommendation).toBeNull();
      expect(useRunCardsStore.getState().isLoading).toBe(false);
    });
  });

  describe('escalate', () => {
    it('returns the server result on success', async () => {
      const result = { Id: '42', Success: true, NewAlarmLevel: 2, AddedUnits: 2, AddedPersonnel: 1 };
      mockedEscalate.mockResolvedValue(result);

      await expect(useRunCardsStore.getState().escalate('42')).resolves.toBe(result);
      expect(useRunCardsStore.getState().isEscalating).toBe(false);
      expect(useRunCardsStore.getState().escalationError).toBeNull();
    });

    it('captures the error and stops the spinner on failure', async () => {
      mockedEscalate.mockRejectedValue(new Error('nope'));

      await expect(useRunCardsStore.getState().escalate('42')).resolves.toBeNull();
      expect(useRunCardsStore.getState().isEscalating).toBe(false);
      expect(useRunCardsStore.getState().escalationError).toBe('nope');
    });
  });

  describe('clear', () => {
    it('resets everything so the next call starts clean', async () => {
      mockedGetRecommendation.mockResolvedValue({ MatchedRunCardId: 3, Units: [], Personnel: [] });
      await useRunCardsStore.getState().fetchRecommendation(validRequest);
      useRunCardsStore.getState().markApplied(3);

      useRunCardsStore.getState().clear();

      const state = useRunCardsStore.getState();
      expect(state.recommendation).toBeNull();
      expect(state.hasFetched).toBe(false);
      expect(state.appliedRunCardId).toBeNull();
      expect(state.error).toBeNull();
    });
  });
});
