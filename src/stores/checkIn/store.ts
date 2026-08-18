import { create } from 'zustand';

import { getCallPersonnelCheckInStatuses, getCheckInHistory, getTimersForCall, getTimerStatuses, getTimerStatusesForCalls, performCheckIn, type PerformCheckInInput, toggleCallTimers } from '@/api/checkIn/checkInTimers';
import { type CallPersonnelCheckInStatusResultData } from '@/models/v4/checkIn/callPersonnelCheckInStatusResultData';
import { type CheckInRecordResultData } from '@/models/v4/checkIn/checkInRecordResultData';
import { type CheckInTimerStatusResultData } from '@/models/v4/checkIn/checkInTimerStatusResultData';
import { type ResolvedCheckInTimerResultData } from '@/models/v4/checkIn/resolvedCheckInTimerResultData';
import { usePersonnelStore } from '@/stores/personnel/store';
import { useUnitsStore } from '@/stores/units/store';

/**
 * Enrich timer statuses with TargetName from:
 * 1. Resolved timers (same endpoint family)
 * 2. Units store (by every possible ID match)
 * 3. Personnel store (by every possible ID match)
 */
function enrichTimerNames(statuses: CheckInTimerStatusResultData[], resolved: ResolvedCheckInTimerResultData[]): CheckInTimerStatusResultData[] {
  // Build name lookup from resolved timers
  const resolvedNameMap = new Map<string, string>();
  for (const r of resolved) {
    if (r.TargetName) {
      if (r.TargetEntityId) resolvedNameMap.set(`${r.TargetType}-${r.TargetEntityId}`, r.TargetName);
      // Also key by just TargetType for type-level timers
      if (!resolvedNameMap.has(`type-${r.TargetType}`)) resolvedNameMap.set(`type-${r.TargetType}`, r.TargetName);
    }
  }

  // Get units and personnel from their stores for name lookup
  const units = useUnitsStore.getState().units;
  const personnel = usePersonnelStore.getState().personnel;

  // Build fast lookup maps for units
  const unitByIdStr = new Map<string, string>(); // UnitId string → Name
  const unitByIdNum = new Map<number, string>(); // parsed numeric UnitId → Name
  for (const u of units) {
    if (u.Name) {
      unitByIdStr.set(u.UnitId, u.Name);
      const num = parseInt(u.UnitId, 10);
      if (!isNaN(num)) unitByIdNum.set(num, u.Name);
    }
  }

  // Build fast lookup maps for personnel
  const personnelByUserId = new Map<string, string>(); // UserId → full name
  const personnelByIdNum = new Map<number, string>(); // parsed numeric UserId → full name
  for (const p of personnel) {
    const fullName = `${p.FirstName || ''} ${p.LastName || ''}`.trim();
    if (fullName) {
      personnelByUserId.set(p.UserId, fullName);
      if (p.IdentificationNumber) personnelByUserId.set(p.IdentificationNumber, fullName);
      const num = parseInt(p.UserId, 10);
      if (!isNaN(num)) personnelByIdNum.set(num, fullName);
    }
  }

  return statuses.map((s) => {
    // Skip if TargetName is a real entity name (not a type label like "UnitType")
    const nameIsTypeLabel = !s.TargetName || /type$/i.test(s.TargetName) || s.TargetName === s.TargetTypeName;
    if (s.TargetName && !nameIsTypeLabel) return s;

    let name: string | undefined;

    // 1. Try resolved timers
    if (s.TargetEntityId) {
      name = resolvedNameMap.get(`${s.TargetType}-${s.TargetEntityId}`);
    }
    if (!name) {
      name = resolvedNameMap.get(`type-${s.TargetType}`);
    }

    // 2. Try units store (by TargetEntityId string, UnitId number, and cross-parsed)
    if (!name && s.TargetEntityId) {
      name = unitByIdStr.get(s.TargetEntityId);
    }
    if (!name && s.UnitId > 0) {
      name = unitByIdNum.get(s.UnitId) || unitByIdStr.get(String(s.UnitId));
    }
    if (!name && s.TargetEntityId) {
      const parsed = parseInt(s.TargetEntityId, 10);
      if (!isNaN(parsed)) name = unitByIdNum.get(parsed);
    }

    // 3. Try personnel store (by TargetEntityId string and cross-parsed)
    if (!name && s.TargetEntityId) {
      name = personnelByUserId.get(s.TargetEntityId);
    }
    if (!name && s.TargetEntityId) {
      const parsed = parseInt(s.TargetEntityId, 10);
      if (!isNaN(parsed)) name = personnelByIdNum.get(parsed);
    }

    return name ? { ...s, TargetName: name } : s;
  });
}

const STATUS_SEVERITY: Record<string, number> = {
  Critical: 0,
  Overdue: 1,
  Red: 1,
  Warning: 2,
  Yellow: 2,
  Ok: 3,
  Green: 3,
};

function sortByStatusSeverity(a: CheckInTimerStatusResultData, b: CheckInTimerStatusResultData): number {
  return (STATUS_SEVERITY[a.Status] ?? 3) - (STATUS_SEVERITY[b.Status] ?? 3);
}

interface CheckInState {
  timerStatuses: CheckInTimerStatusResultData[];
  resolvedTimers: ResolvedCheckInTimerResultData[];
  checkInHistory: CheckInRecordResultData[];
  callPersonnelStatuses: CallPersonnelCheckInStatusResultData[];

  isLoadingStatuses: boolean;
  statusError: string | null;
  isLoadingHistory: boolean;
  isLoadingPersonnelStatuses: boolean;
  isCheckingIn: boolean;
  checkInError: string | null;

  _pollingInterval: ReturnType<typeof setInterval> | null;
  _pollingCallIds: number[];

  fetchTimerStatuses: (callId: number) => Promise<void>;
  /**
   * @param options.silent Skip the loading flag and reuse the cached resolved timers. Poll rounds
   *   pass this: flipping `isLoadingStatuses` twice a round re-rendered every consumer for data
   *   that usually came back identical, and the resolved-timer lookup only supplies display names.
   */
  fetchTimerStatusesForCalls: (callIds: number[], options?: { silent?: boolean }) => Promise<void>;
  fetchResolvedTimers: (callId: number) => Promise<void>;
  fetchCheckInHistory: (callId: number) => Promise<void>;
  fetchCallPersonnelStatuses: (callId: number) => Promise<void>;
  performCheckIn: (input: PerformCheckInInput) => Promise<boolean>;
  toggleTimers: (callId: number, enabled: boolean) => Promise<boolean>;
  startPolling: (callId: number, intervalMs?: number) => void;
  startPollingForCalls: (callIds: number[], intervalMs?: number) => void;
  stopPolling: () => void;
  reset: () => void;
}

export const useCheckInStore = create<CheckInState>((set, get) => ({
  timerStatuses: [],
  resolvedTimers: [],
  checkInHistory: [],
  callPersonnelStatuses: [],
  isLoadingStatuses: false,
  statusError: null,
  isLoadingHistory: false,
  isLoadingPersonnelStatuses: false,
  isCheckingIn: false,
  checkInError: null,
  _pollingInterval: null,
  _pollingCallIds: [],

  fetchTimerStatuses: async (callId: number) => {
    set({ isLoadingStatuses: true, statusError: null });
    try {
      const [statusResult, resolvedResult] = await Promise.all([getTimerStatuses(callId), getTimersForCall(callId).catch(() => ({ Data: [] as ResolvedCheckInTimerResultData[] }))]);
      const enriched = enrichTimerNames(statusResult.Data || [], resolvedResult.Data || []);
      const sorted = enriched.sort(sortByStatusSeverity);
      set({ timerStatuses: sorted, resolvedTimers: resolvedResult.Data || [], isLoadingStatuses: false });
    } catch (error) {
      set({
        statusError: error instanceof Error ? error.message : 'Failed to fetch timer statuses',
        isLoadingStatuses: false,
      });
    }
  },

  fetchTimerStatusesForCalls: async (callIds: number[], options?: { silent?: boolean }) => {
    if (callIds.length === 0) {
      set({ timerStatuses: [], resolvedTimers: [], isLoadingStatuses: false, statusError: null });
      return;
    }
    const silent = options?.silent === true;
    if (!silent) {
      set({ isLoadingStatuses: true, statusError: null });
    }
    try {
      // Resolved timers only supply display names for the status rows and change when a call's
      // timer set is edited, not between poll rounds — so a silent refresh reuses what it has and
      // halves the requests each round costs.
      const statusPromise = getTimerStatusesForCalls(callIds);
      const resolvedPromise = silent
        ? Promise.resolve(get().resolvedTimers)
        : Promise.all(callIds.map((id) => getTimersForCall(id).catch(() => ({ Data: [] as ResolvedCheckInTimerResultData[] })))).then((results) => results.flatMap((r) => r.Data || []));

      const [statusResult, allResolved] = await Promise.all([statusPromise, resolvedPromise]);
      const enriched = enrichTimerNames(statusResult.Data || [], allResolved);
      const sorted = enriched.sort(sortByStatusSeverity);
      set({ timerStatuses: sorted, resolvedTimers: allResolved, isLoadingStatuses: false, statusError: null });
    } catch (error) {
      set({
        statusError: error instanceof Error ? error.message : 'Failed to fetch timer statuses',
        isLoadingStatuses: false,
      });
    }
  },

  fetchResolvedTimers: async (callId: number) => {
    try {
      const result = await getTimersForCall(callId);
      set({ resolvedTimers: result.Data || [] });
    } catch {
      // silent fail — resolved timers are supplementary
    }
  },

  fetchCheckInHistory: async (callId: number) => {
    set({ isLoadingHistory: true });
    try {
      const result = await getCheckInHistory(callId);
      set({ checkInHistory: result.Data || [], isLoadingHistory: false });
    } catch {
      set({ checkInHistory: [], isLoadingHistory: false });
    }
  },

  fetchCallPersonnelStatuses: async (callId: number) => {
    set({ isLoadingPersonnelStatuses: true });
    try {
      const result = await getCallPersonnelCheckInStatuses(callId);
      const data = result.Data || [];
      // Show the most urgent members first (Critical, then Warning, then Green).
      const sorted = [...data].sort((a, b) => (STATUS_SEVERITY[a.Status] ?? 3) - (STATUS_SEVERITY[b.Status] ?? 3));
      set({ callPersonnelStatuses: sorted, isLoadingPersonnelStatuses: false });
    } catch {
      set({ callPersonnelStatuses: [], isLoadingPersonnelStatuses: false });
    }
  },

  performCheckIn: async (input: PerformCheckInInput) => {
    set({ isCheckingIn: true, checkInError: null });
    try {
      await performCheckIn(input);
      // Refresh statuses after successful check-in
      const pollingCallIds = get()._pollingCallIds;
      if (pollingCallIds.length > 0) {
        await get().fetchTimerStatusesForCalls(pollingCallIds);
      } else {
        await get().fetchTimerStatuses(input.CallId);
      }
      set({ isCheckingIn: false });
      return true;
    } catch (error) {
      set({
        checkInError: error instanceof Error ? error.message : 'Failed to perform check-in',
        isCheckingIn: false,
      });
      return false;
    }
  },

  toggleTimers: async (callId: number, enabled: boolean) => {
    try {
      await toggleCallTimers(callId, enabled);
      await get().fetchTimerStatuses(callId);
      return true;
    } catch {
      return false;
    }
  },

  startPolling: (callId: number, intervalMs: number = 30000) => {
    const existing = get()._pollingInterval;
    if (existing) {
      clearInterval(existing);
    }
    set({ _pollingCallIds: [callId] });
    const interval = setInterval(() => {
      get().fetchTimerStatuses(callId);
    }, intervalMs);
    set({ _pollingInterval: interval });
  },

  startPollingForCalls: (callIds: number[], intervalMs: number = 30000) => {
    const existing = get()._pollingInterval;
    if (existing) {
      clearInterval(existing);
    }
    if (callIds.length === 0) {
      set({ _pollingInterval: null, _pollingCallIds: [] });
      return;
    }
    set({ _pollingCallIds: callIds });
    const interval = setInterval(() => {
      get().fetchTimerStatusesForCalls(callIds, { silent: true });
    }, intervalMs);
    set({ _pollingInterval: interval });
  },

  stopPolling: () => {
    const interval = get()._pollingInterval;
    if (interval) {
      clearInterval(interval);
      set({ _pollingInterval: null, _pollingCallIds: [] });
    }
  },

  reset: () => {
    const interval = get()._pollingInterval;
    if (interval) {
      clearInterval(interval);
    }
    set({
      timerStatuses: [],
      resolvedTimers: [],
      checkInHistory: [],
      callPersonnelStatuses: [],
      isLoadingStatuses: false,
      statusError: null,
      isLoadingHistory: false,
      isLoadingPersonnelStatuses: false,
      isCheckingIn: false,
      checkInError: null,
      _pollingInterval: null,
      _pollingCallIds: [],
    });
  },
}));
