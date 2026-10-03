import { Env } from '@env';
import _ from 'lodash';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { getConfig } from '@/api/config';
import { getUnits } from '@/api/units/units';
import { logger } from '@/lib/logging';
import { applyServerMapboxToken } from '@/lib/mapbox-token';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type GetConfigResultData } from '@/models/v4/configs/getConfigResultData';
import { type CustomStatusesResult } from '@/models/v4/customStatuses/customStatusesResult';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';

interface CoreState {
  config: GetConfigResultData | null;
  activeUnitId: string | null;
  activeUnit: UnitInfoResultData | null;
  activeUnitStatus: string | null;
  activeUnitStatusType: string | null;
  activeStatuses: CustomStatusesResult | null;
  activeCallId: string | null;
  activeCall: CallResultData | null;
  activePriority: number | null;

  isLoading: boolean;
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  init: () => Promise<void>;
  fetchConfig: () => Promise<void>;
  setActiveUnit: (unitId: string | null) => void;
  setActiveUnitWithFetch: (unitId: string) => Promise<void>;
  setActiveCall: (callId: string | null) => void;
}

/**
 * Adopts the Mapbox token from a config that actually arrived. Fire and forget: the token check talks to
 * Mapbox and must never hold up or fail config loading.
 */
const applyConfigMapboxToken = (config: GetConfigResultData | null | undefined): void => {
  if (!config) {
    return;
  }

  applyServerMapboxToken(config.AppMapboxAccessToken).catch((error) => {
    logger.warn({
      message: 'Failed to apply the server Mapbox token',
      context: { error },
    });
  });
};

export const useCoreStore = create<CoreState>()((set, get) => ({
  config: null,
  activeUnitId: null,
  activeUnit: null,
  activeUnitStatus: null,
  activeUnitStatusType: null,
  activeStatuses: null,
  activeCallId: null,
  activeCall: null,
  activePriority: null,
  isLoading: false,
  isInitialized: false,
  isInitializing: false,
  error: null,
  init: async () => {
    const state = get();

    // Prevent multiple simultaneous initializations
    if (state.isInitializing) {
      logger.info({
        message: 'Core store initialization already in progress, skipping',
      });
      return;
    }

    // Don't re-initialize if already initialized
    if (state.isInitialized) {
      logger.info({
        message: 'Core store already initialized, skipping',
      });
      return;
    }

    set({ isLoading: true, isInitializing: true, error: null });

    try {
      logger.info({
        message: 'Core store init: About to fetch config',
      });

      // Fetch config first before anything else - this is critical for SignalR connections
      const config = await getConfig(Env.APP_KEY);

      logger.info({
        message: 'Config fetched successfully',
      });

      set({
        isInitialized: true,
        isLoading: false,
        isInitializing: false,
        config: config.Data,
        error: null,
      });
      applyConfigMapboxToken(config.Data);

      logger.info({
        message: 'Core store initialization completed successfully',
      });
    } catch (error) {
      set({
        error: 'Failed to init core app data',
        isLoading: false,
        isInitializing: false,
      });
      logger.error({
        message: `Failed to init core app data: ${JSON.stringify(error)}`,
        context: { error },
      });
    }
  },
  fetchConfig: async () => {
    logger.info({
      message: 'fetchConfig: Starting config fetch',
    });
    try {
      logger.info({
        message: 'fetchConfig: Calling getConfig API',
        context: { appKey: Env.APP_KEY },
      });

      const config = await getConfig(Env.APP_KEY);

      logger.info({
        message: 'fetchConfig: Config API call completed',
        context: { hasData: !!config.Data },
      });

      logger.info({
        message: 'fetchConfig: About to update store',
      });

      set({ config: config.Data, error: null });
      applyConfigMapboxToken(config.Data);

      logger.info({
        message: 'fetchConfig: Store updated with config',
      });
    } catch (error) {
      logger.error({
        message: 'fetchConfig: Error occurred',
        context: { error: String(error) },
      });

      set({ error: 'Failed to fetch config', isLoading: false });

      logger.error({
        message: `Failed to fetch config: ${JSON.stringify(error)}`,
        context: { error },
      });
      throw error; // Re-throw to allow calling code to handle
    }
  },
  setActiveUnit: (unitId: string | null) => {
    set({ activeUnitId: unitId });
  },
  setActiveUnitWithFetch: async (unitId: string) => {
    try {
      // For now, just set the unit ID without fetching
      // In the future, implement actual unit fetch
      set({
        activeUnitId: unitId,
      });
      logger.info({
        message: 'Active unit set (without fetch)',
        context: { unitId },
      });
    } catch (error) {
      logger.error({
        message: `Failed to set active unit ${unitId}`,
        context: { error },
      });
      throw error;
    }
  },
  setActiveCall: (callId: string | null) => {
    set({ activeCallId: callId });
  },
}));
