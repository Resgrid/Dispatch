import { create } from 'zustand';

import {
  deleteWeatherAlertSource,
  deleteWeatherAlertZone,
  getActiveAlerts,
  getAlertHistory,
  getAlertsNearLocation,
  getWeatherAlert,
  getWeatherAlertSettings,
  getWeatherAlertSources,
  getWeatherAlertZones,
  saveWeatherAlertSettings,
  saveWeatherAlertSource,
  type SaveWeatherAlertSourceInput,
  saveWeatherAlertZone,
  type SaveWeatherAlertZoneInput,
} from '@/api/weatherAlerts/weatherAlerts';
import { logger } from '@/lib/logging';
import { WeatherAlertSeverity } from '@/models/v4/weatherAlerts/weatherAlertEnums';
import { type WeatherAlertResultData } from '@/models/v4/weatherAlerts/weatherAlertResultData';
import { type WeatherAlertSettingsData } from '@/models/v4/weatherAlerts/weatherAlertSettingsData';
import { type WeatherAlertSourceResultData } from '@/models/v4/weatherAlerts/weatherAlertSourceResultData';
import { type WeatherAlertZoneResultData } from '@/models/v4/weatherAlerts/weatherAlertZoneResultData';

function sortAlerts(a: WeatherAlertResultData, b: WeatherAlertResultData): number {
  if (a.Severity !== b.Severity) return a.Severity - b.Severity;
  const timeA = new Date(a.EffectiveUtc).getTime();
  const timeB = new Date(b.EffectiveUtc).getTime();
  return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
}

interface WeatherAlertsState {
  alerts: WeatherAlertResultData[];
  isLoading: boolean;
  error: string | null;

  selectedAlert: WeatherAlertResultData | null;
  isLoadingDetail: boolean;

  settings: WeatherAlertSettingsData | null;

  nearbyAlerts: WeatherAlertResultData[];
  isLoadingNearby: boolean;

  history: WeatherAlertResultData[];
  isLoadingHistory: boolean;

  sources: WeatherAlertSourceResultData[];
  isLoadingSources: boolean;
  zones: WeatherAlertZoneResultData[];
  isLoadingZones: boolean;
  isSavingSettings: boolean;

  lastWeatherAlertTimestamp: number;

  fetchActiveAlerts: () => Promise<void>;
  fetchAlertDetail: (alertId: string) => Promise<void>;
  fetchNearbyAlerts: (lat: number, lng: number, radiusMiles?: number) => Promise<void>;
  fetchHistory: (startDate: string, endDate: string) => Promise<void>;
  fetchSettings: () => Promise<void>;
  saveSettings: (settings: WeatherAlertSettingsData) => Promise<void>;
  fetchSources: () => Promise<void>;
  saveSource: (input: SaveWeatherAlertSourceInput) => Promise<void>;
  deleteSource: (sourceId: string) => Promise<void>;
  fetchZones: () => Promise<void>;
  saveZone: (input: SaveWeatherAlertZoneInput) => Promise<void>;
  deleteZone: (zoneId: string) => Promise<void>;
  handleAlertReceived: (alertId: string) => Promise<void>;
  handleAlertExpired: (alertId: string) => void;
  handleAlertUpdated: (alertId: string) => Promise<void>;
  reset: () => void;
}

export const useWeatherAlertsStore = create<WeatherAlertsState>((set, get) => ({
  alerts: [],
  isLoading: false,
  error: null,
  selectedAlert: null,
  isLoadingDetail: false,
  settings: null,
  nearbyAlerts: [],
  isLoadingNearby: false,
  history: [],
  isLoadingHistory: false,
  sources: [],
  isLoadingSources: false,
  zones: [],
  isLoadingZones: false,
  isSavingSettings: false,
  lastWeatherAlertTimestamp: 0,

  fetchActiveAlerts: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await getActiveAlerts();
      const sorted = (result.Data || []).sort(sortAlerts);
      set({ alerts: sorted, isLoading: false });
    } catch (error) {
      logger.error({ message: 'Failed to fetch active weather alerts', context: { error } });
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch weather alerts',
        isLoading: false,
      });
    }
  },

  fetchAlertDetail: async (alertId: string) => {
    set({ isLoadingDetail: true });
    try {
      const result = await getWeatherAlert(alertId);
      set({ selectedAlert: result.Data, isLoadingDetail: false });
    } catch (error) {
      logger.error({ message: 'Failed to fetch weather alert detail', context: { error, alertId } });
      set({ selectedAlert: null, isLoadingDetail: false });
    }
  },

  fetchNearbyAlerts: async (lat: number, lng: number, radiusMiles: number = 25) => {
    set({ isLoadingNearby: true });
    try {
      const result = await getAlertsNearLocation(lat, lng, radiusMiles);
      const sorted = (result.Data || []).sort(sortAlerts);
      set({ nearbyAlerts: sorted, isLoadingNearby: false });
    } catch (error) {
      logger.error({ message: 'Failed to fetch nearby weather alerts', context: { error } });
      set({ isLoadingNearby: false });
    }
  },

  fetchHistory: async (startDate: string, endDate: string) => {
    set({ isLoadingHistory: true });
    try {
      const result = await getAlertHistory(startDate, endDate);
      set({ history: (result.Data || []).sort(sortAlerts), isLoadingHistory: false });
    } catch (error) {
      logger.error({ message: 'Failed to fetch weather alert history', context: { error } });
      set({ isLoadingHistory: false });
    }
  },

  fetchSettings: async () => {
    try {
      const result = await getWeatherAlertSettings();
      set({ settings: result.Data });
    } catch (error) {
      logger.error({ message: 'Failed to fetch weather alert settings', context: { error } });
    }
  },

  saveSettings: async (settings: WeatherAlertSettingsData) => {
    set({ isSavingSettings: true });
    try {
      const result = await saveWeatherAlertSettings(settings);
      set({ settings: result?.Data ?? settings, isSavingSettings: false });
    } catch (error) {
      logger.error({ message: 'Failed to save weather alert settings', context: { error } });
      set({ isSavingSettings: false });
      throw error;
    }
  },

  fetchSources: async () => {
    set({ isLoadingSources: true });
    try {
      const result = await getWeatherAlertSources();
      set({ sources: result.Data || [], isLoadingSources: false });
    } catch (error) {
      logger.error({ message: 'Failed to fetch weather alert sources', context: { error } });
      set({ isLoadingSources: false });
    }
  },

  saveSource: async (input: SaveWeatherAlertSourceInput) => {
    try {
      await saveWeatherAlertSource(input);
      await get().fetchSources();
    } catch (error) {
      logger.error({ message: 'Failed to save weather alert source', context: { error } });
      throw error;
    }
  },

  deleteSource: async (sourceId: string) => {
    try {
      await deleteWeatherAlertSource(sourceId);
      await get().fetchSources();
    } catch (error) {
      logger.error({ message: 'Failed to delete weather alert source', context: { error } });
      throw error;
    }
  },

  fetchZones: async () => {
    set({ isLoadingZones: true });
    try {
      const result = await getWeatherAlertZones();
      set({ zones: result.Data || [], isLoadingZones: false });
    } catch (error) {
      logger.error({ message: 'Failed to fetch weather alert zones', context: { error } });
      set({ isLoadingZones: false });
    }
  },

  saveZone: async (input: SaveWeatherAlertZoneInput) => {
    try {
      await saveWeatherAlertZone(input);
      await get().fetchZones();
    } catch (error) {
      logger.error({ message: 'Failed to save weather alert zone', context: { error } });
      throw error;
    }
  },

  deleteZone: async (zoneId: string) => {
    try {
      await deleteWeatherAlertZone(zoneId);
      await get().fetchZones();
    } catch (error) {
      logger.error({ message: 'Failed to delete weather alert zone', context: { error } });
      throw error;
    }
  },

  handleAlertReceived: async (alertId: string) => {
    try {
      const result = await getWeatherAlert(alertId);
      if (result.Data) {
        const current = get().alerts;
        const updated = [result.Data, ...current].sort(sortAlerts);
        set({ alerts: updated, lastWeatherAlertTimestamp: Date.now() });
      }
    } catch (error) {
      logger.error({ message: 'Failed to handle received weather alert', context: { error, alertId } });
      // Fall back to full refresh
      await get().fetchActiveAlerts();
    }
  },

  handleAlertExpired: (alertId: string) => {
    const current = get().alerts;
    set({
      alerts: current.filter((a) => a.WeatherAlertId !== alertId),
      lastWeatherAlertTimestamp: Date.now(),
    });
  },

  handleAlertUpdated: async (alertId: string) => {
    try {
      const result = await getWeatherAlert(alertId);
      if (result.Data) {
        const current = get().alerts;
        const idx = current.findIndex((a) => a.WeatherAlertId === alertId);
        let updated: WeatherAlertResultData[];
        if (idx >= 0) {
          updated = [...current];
          updated[idx] = result.Data;
        } else {
          updated = [result.Data, ...current];
        }
        set({ alerts: updated.sort(sortAlerts), lastWeatherAlertTimestamp: Date.now() });

        // Update selected alert if it's the one being viewed
        if (get().selectedAlert?.WeatherAlertId === alertId) {
          set({ selectedAlert: result.Data });
        }
      }
    } catch (error) {
      logger.error({ message: 'Failed to handle updated weather alert', context: { error, alertId } });
      await get().fetchActiveAlerts();
    }
  },

  reset: () => {
    set({
      alerts: [],
      isLoading: false,
      error: null,
      selectedAlert: null,
      isLoadingDetail: false,
      nearbyAlerts: [],
      isLoadingNearby: false,
      history: [],
      isLoadingHistory: false,
      sources: [],
      isLoadingSources: false,
      zones: [],
      isLoadingZones: false,
      isSavingSettings: false,
      lastWeatherAlertTimestamp: 0,
    });
  },
}));
