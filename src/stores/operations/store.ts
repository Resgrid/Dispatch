import { create } from 'zustand';

import {
  addResourceUsage,
  buildF42,
  getCalOesMarsAccess,
  getCalOesMarsQueue,
  getDeployment,
  getDeploymentAccess,
  getDeployments,
  getFieldCostAccess,
  getResourceUsage,
  getTimeReports,
  newTimeReport,
  saveTimeEntries,
  submitTimeReport,
  validateCalOesMarsWorkItem,
} from '@/api/operations/operations';
import { operationsCapabilities } from '@/lib/operations/capabilities';
import { operationsError, reportForDate, validateEntries } from '@/lib/operations/time';
import type {
  CalOesMarsAccess,
  CalOesMarsQueueItem,
  CalOesMarsValidation,
  Deployment,
  DeploymentAccess,
  FieldCostAccess,
  ResourceUsage,
  ResourceUsageInput,
  TimeEntry,
  TimeReport,
  TimeReportIssue,
} from '@/models/v4/operations';
import useAuthStore from '@/stores/auth/store';
import { securityStore } from '@/stores/security/store';

// One store for the field-operations surface: the deployment list, the open deployment with its
// daily time reports, resource usage readings and the CAL OES MARS work items that belong to it.
// Everything shown came from the server's own scoping (a rostered member sees their deployments,
// a manager sees the department's); this store never decides what the person may see.

export interface OperationsState {
  identity: string | null;
  access: DeploymentAccess | null;
  costAccess: FieldCostAccess | null;
  marsAccess: CalOesMarsAccess | null;
  deployments: Deployment[];
  includeClosed: boolean;
  deployment: Deployment | null;
  reports: TimeReport[];
  report: TimeReport | null;
  entries: TimeEntry[];
  dirty: boolean;
  issues: TimeReportIssue[];
  warnings: TimeReportIssue[];
  usage: ResourceUsage[];
  marsItems: CalOesMarsQueueItem[];
  validation: CalOesMarsValidation | null;
  busy: boolean;
  error: string | null;
  loadAccess: () => Promise<void>;
  loadDeployments: (includeClosed?: boolean) => Promise<void>;
  open: (id: string) => Promise<void>;
  openReport: (dateKey: string, create: boolean) => Promise<void>;
  setEntries: (entries: TimeEntry[]) => void;
  save: () => Promise<boolean>;
  submit: () => Promise<boolean>;
  loadUsage: () => Promise<void>;
  addUsage: (input: Omit<ResourceUsageInput, 'DeploymentId' | 'CallId'>) => Promise<boolean>;
  loadMars: () => Promise<void>;
  draftF42: () => Promise<boolean>;
  validate: (workItemId: string) => Promise<boolean>;
  close: () => void;
}

const initial = {
  identity: null as string | null,
  access: null,
  costAccess: null,
  marsAccess: null,
  deployments: [],
  includeClosed: false,
  deployment: null,
  reports: [],
  report: null,
  entries: [],
  dirty: false,
  issues: [],
  warnings: [],
  usage: [],
  marsItems: [],
  validation: null,
  busy: false,
  error: null,
};

const settle = async <T>(work: () => Promise<T>): Promise<T | undefined> => {
  useOperationsStore.setState({ busy: true, error: null });
  try {
    return await work();
  } catch (error) {
    useOperationsStore.setState({ error: operationsError(error) });
    return undefined;
  } finally {
    useOperationsStore.setState({ busy: false });
  }
};

// Immutable ids only (user id + department id): state from another sign-in or department is dropped
// before anything is fetched for this one, so a stale deployment can never be shown to the wrong person.
const currentIdentity = (): string | null => {
  const userId = useAuthStore.getState().userId;
  const departmentId = securityStore.getState().rights?.DepartmentId;
  return userId && departmentId ? `${userId}:${departmentId}` : null;
};

export const useOperationsStore = create<OperationsState>()((set, get) => ({
  ...initial,
  loadAccess: async () => {
    const identity = currentIdentity();
    if (get().identity !== identity) set({ ...initial, identity });
    await settle(async () => {
      const access = await getDeploymentAccess();
      // Usage and MARS access are optional add-ons; a failure there must not hide the deployments.
      const [costAccess, marsAccess] = await Promise.all([
        operationsCapabilities.recordUsage ? getFieldCostAccess().catch(() => null) : Promise.resolve(null),
        operationsCapabilities.draftF42 ? getCalOesMarsAccess().catch(() => null) : Promise.resolve(null),
      ]);
      set({ access, costAccess, marsAccess });
    });
  },
  loadDeployments: async (includeClosed = get().includeClosed) => {
    await settle(async () => {
      const deployments = await getDeployments(!includeClosed);
      set({ deployments, includeClosed });
    });
  },
  open: async (id) => {
    await settle(async () => {
      const deployment = await getDeployment(id);
      const reports = await getTimeReports(id);
      set({ deployment, reports, report: null, entries: [], dirty: false, issues: [], warnings: [], usage: [], marsItems: [], validation: null });
    });
  },
  openReport: async (dateKey, create) => {
    const deployment = get().deployment;
    if (!deployment) return;
    await settle(async () => {
      let report = reportForDate(get().reports, dateKey);
      if (!report && create && operationsCapabilities.editTime) {
        const response = await newTimeReport(deployment.Id, dateKey);
        report = response.Data;
        set({ reports: [...get().reports, report] });
      }
      set({ report, entries: report ? report.Entries.map((entry) => ({ ...entry })) : [], dirty: false, issues: [], warnings: [] });
    });
  },
  setEntries: (entries) => set({ entries, dirty: true, issues: [] }),
  save: async () => {
    const report = get().report;
    if (!report) return false;
    const local = validateEntries(get().entries);
    if (local.length > 0) {
      set({ issues: local.map((issue) => ({ Code: issue.code, EntryId: String(issue.index) })) });
      return false;
    }
    const saved = await settle(async () => {
      const response = await saveTimeEntries(report.Id, get().entries);
      const next = response.Data;
      set({
        report: next,
        entries: next.Entries.map((entry) => ({ ...entry })),
        dirty: false,
        issues: response.Errors ?? [],
        warnings: response.Warnings ?? [],
        reports: get().reports.map((existing) => (existing.Id === next.Id ? next : existing)),
      });
      return (response.Errors ?? []).length === 0;
    });
    return saved === true;
  },
  submit: async () => {
    const report = get().report;
    if (!report || get().dirty) return false;
    const submitted = await settle(async () => {
      const response = await submitTimeReport(report.Id);
      const next = response.Data;
      set({
        report: next,
        entries: next.Entries.map((entry) => ({ ...entry })),
        issues: response.Errors ?? [],
        warnings: response.Warnings ?? [],
        reports: get().reports.map((existing) => (existing.Id === next.Id ? next : existing)),
      });
      return (response.Errors ?? []).length === 0;
    });
    return submitted === true;
  },
  loadUsage: async () => {
    const deployment = get().deployment;
    if (!deployment || !get().costAccess?.Enabled) return;
    await settle(async () => set({ usage: await getResourceUsage(deployment.Id) }));
  },
  addUsage: async (input) => {
    const deployment = get().deployment;
    if (!deployment) return false;
    const added = await settle(async () => {
      const reading = await addResourceUsage({ ...input, DeploymentId: deployment.Id, CallId: deployment.CallId ?? null });
      set({ usage: [reading, ...get().usage] });
      return true;
    });
    return added === true;
  },
  loadMars: async () => {
    const deployment = get().deployment;
    if (!deployment || !get().marsAccess?.Enabled) return;
    await settle(async () => {
      const queue = await getCalOesMarsQueue();
      set({ marsItems: queue.filter((item) => item.DeploymentId === deployment.Id) });
    });
  },
  draftF42: async () => {
    const deployment = get().deployment;
    if (!deployment) return false;
    const built = await settle(async () => {
      await buildF42(deployment.Id);
      set({ marsItems: (await getCalOesMarsQueue()).filter((item) => item.DeploymentId === deployment.Id) });
      return true;
    });
    return built === true;
  },
  validate: async (workItemId) => {
    const validated = await settle(async () => {
      const validation = await validateCalOesMarsWorkItem(workItemId);
      set({ validation });
      return validation.IsReadyForPortal;
    });
    return validated === true;
  },
  close: () => set({ deployment: null, reports: [], report: null, entries: [], dirty: false, issues: [], warnings: [], usage: [], marsItems: [], validation: null, error: null }),
}));
