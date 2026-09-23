import type { Href } from 'expo-router';

// What this app does with a deployment. The server enforces every rule again; this only shapes the UI.
// Dispatchers see deployments and their time reports read-only.
export const operationsCapabilities = {
  /** Write crew / individual time reports (read-only here). */
  editTime: false,
  /** Record odometer / engine / fuel readings against a deployment unit. */
  recordUsage: false,
  /** Add expenses (meals, fuel, lodging) with a receipt photo. */
  recordExpenses: false,
  /** Approve submitted time reports when the person holds TimeReports_Approve. */
  approveTime: false,
  /** Draft and validate the CAL OES MARS F-42 from the field. */
  draftF42: false,
  homeRoute: '/home' as Href,
  useActiveUnitId: (): string | null => null,
};
