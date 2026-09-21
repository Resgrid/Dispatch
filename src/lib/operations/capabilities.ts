import type { Href } from 'expo-router';

// What this app does with a deployment. The server enforces every rule again; this only shapes the UI.
export const operationsCapabilities = {
  /** Write daily time report entries (Responder: own row; Unit: the active unit's crew). */
  editTime: false,
  /** Record odometer / engine / fuel readings against a deployment unit. */
  recordUsage: false,
  /** Draft and validate the CAL OES MARS F-42 from the field. */
  draftF42: false,
  homeRoute: '/home' as Href,
  useActiveUnitId: (): string | null => null,
};
