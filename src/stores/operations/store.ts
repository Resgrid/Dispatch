import { create } from 'zustand';

import {
  addResourceUsage,
  approveTimeReport,
  buildF42,
  deleteExpense,
  getCalOesMarsAccess,
  getCalOesMarsQueue,
  getDeployment,
  getDeploymentAccess,
  getDeployments,
  getExpenses,
  getFieldCostAccess,
  getResourceUsage,
  getTimeReports,
  newTimeReport,
  saveExpense,
  saveTimeEntries,
  signTimeReport,
  submitTimeReport,
  validateCalOesMarsWorkItem,
} from '@/api/operations/operations';
import { operationsCapabilities } from '@/lib/operations/capabilities';
import { operationsError, reportForScope, scopeKey, type TimeScope, validateEntries } from '@/lib/operations/time';
import type {
  CalOesMarsAccess,
  CalOesMarsQueueItem,
  CalOesMarsValidation,
  Deployment,
  DeploymentAccess,
  Expense,
  ExpenseInput,
  FieldCostAccess,
  ResourceUsage,
  ResourceUsageInput,
  TimeEntry,
  TimeReport,
  TimeReportIssue,
  TimeReportResponse,
} from '@/models/v4/operations';
import useAuthStore from '@/stores/auth/store';
import { securityStore } from '@/stores/security/store';

// One store for the field-operations surface: the deployment list, the open deployment with its crew and
// individual time reports, expenses, resource usage readings and the CAL OES MARS work items that belong to
// it. Everything shown came from the server's own scoping (a rostered member or the seated crew of a deployed
// unit sees their deployments, a manager the department's); this store never decides what the person may see.

export interface OperationsState {
  identity: string | null;
  access: DeploymentAccess | null;
  costAccess: FieldCostAccess | null;
  marsAccess: CalOesMarsAccess | null;
  deployments: Deployment[];
  includeClosed: boolean;
  deployment: Deployment | null;
  reports: TimeReport[];
  scope: TimeScope | null;
  report: TimeReport | null;
  entries: TimeEntry[];
  dirty: boolean;
  issues: TimeReportIssue[];
  warnings: TimeReportIssue[];
  expenses: Expense[];
  usage: ResourceUsage[];
  marsItems: CalOesMarsQueueItem[];
  validation: CalOesMarsValidation | null;
  busy: boolean;
  error: string | null;
  loadAccess: () => Promise<void>;
  loadDeployments: (includeClosed?: boolean) => Promise<void>;
  open: (id: string) => Promise<void>;
  setScope: (scope: TimeScope | null, dateKey: string) => void;
  openReport: (dateKey: string, create: boolean) => Promise<void>;
  selectReport: (reportId: string) => void;
  setEntries: (entries: TimeEntry[]) => void;
  save: () => Promise<boolean>;
  submit: () => Promise<boolean>;
  sign: (crewBossSigned: boolean, customerSignerName?: string | null) => Promise<boolean>;
  approve: (reportId: string) => Promise<boolean>;
  loadExpenses: () => Promise<void>;
  addExpense: (input: Omit<ExpenseInput, 'DeploymentId'>) => Promise<boolean>;
  removeExpense: (id: string) => Promise<boolean>;
  loadUsage: () => Promise<void>;
  addUsage: (input: Omit<ResourceUsageInput, 'DeploymentId' | 'CallId'>) => Promise<boolean>;
  loadMars: () => Promise<void>;
  draftF42: () => Promise<boolean>;
  validate: (workItemId: string) => Promise<boolean>;
  close: () => void;
}

const closed = {
  deployment: null,
  reports: [],
  scope: null,
  report: null,
  entries: [],
  dirty: false,
  issues: [],
  warnings: [],
  expenses: [],
  usage: [],
  marsItems: [],
  validation: null,
};

const initial = {
  ...closed,
  identity: null as string | null,
  access: null,
  costAccess: null,
  marsAccess: null,
  deployments: [],
  includeClosed: false,
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

const copyEntries = (report: TimeReport | null) => (report ? report.Entries.map((entry) => ({ ...entry })) : []);

export const useOperationsStore = create<OperationsState>()((set, get) => {
  /**
   * Adopt a report the server just answered with: refresh it in the day list and, when it is open, in the editor.
   * A validation refusal comes back with the stored report; keep the person's unsaved edits and show the issues.
   */
  const adopt = (response: TimeReportResponse) => {
    const errors = response.Errors ?? [];
    if (errors.length > 0) {
      set({ issues: errors, warnings: response.Warnings ?? [] });
      return false;
    }
    const next = response.Data;
    const open = get().report?.Id === next?.Id;
    set({
      reports: next ? [...get().reports.filter((existing) => existing.Id !== next.Id), next] : get().reports,
      ...(open || !get().report ? { report: next, entries: copyEntries(next), dirty: false } : {}),
      issues: [],
      warnings: response.Warnings ?? [],
    });
    return true;
  };

  return {
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
        const [deployment, reports] = await Promise.all([getDeployment(id), getTimeReports(id)]);
        set({ ...closed, deployment, reports });
      });
    },
    setScope: (scope, dateKey) => {
      const report = reportForScope(get().reports, dateKey, scope);
      set({ scope, report, entries: copyEntries(report), dirty: false, issues: [], warnings: [] });
    },
    openReport: async (dateKey, create) => {
      const { deployment, scope } = get();
      if (!deployment) return;
      let report = reportForScope(get().reports, dateKey, scope);
      let issues: TimeReportIssue[] = [];
      let warnings: TimeReportIssue[] = [];
      if (!report && create && scope && operationsCapabilities.editTime) {
        const response = await settle(() =>
          newTimeReport(deployment.Id, dateKey, {
            deploymentUnitId: scope.kind === 'crew' ? scope.unitId : null,
            deploymentPersonnelId: scope.kind === 'individual' ? scope.personnelId : null,
          })
        );
        issues = response?.Errors ?? [];
        warnings = response?.Warnings ?? [];
        // A refused create answers with its reasons and no report: nothing joins the day list, and the reasons show.
        if (response?.Data && issues.length === 0) {
          report = response.Data;
          set({ reports: [...get().reports, response.Data] });
        }
      }
      // The scope can change while the create is in flight; only the report that still matches it opens.
      if (scopeKey(get().scope) !== scopeKey(scope)) return;
      set({ report, entries: copyEntries(report), dirty: false, issues, warnings });
    },
    selectReport: (reportId) => {
      const report = get().reports.find((candidate) => candidate.Id === reportId) ?? null;
      set({ report, entries: copyEntries(report), dirty: false, issues: [], warnings: [] });
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
      const saved = await settle(async () => adopt(await saveTimeEntries(report.Id, get().entries)));
      return saved === true;
    },
    submit: async () => {
      const report = get().report;
      if (!report || get().dirty) return false;
      const submitted = await settle(async () => adopt(await submitTimeReport(report.Id)));
      return submitted === true;
    },
    sign: async (crewBossSigned, customerSignerName) => {
      const report = get().report;
      if (!report || (!crewBossSigned && !customerSignerName)) return false;
      const signed = await settle(async () => adopt(await signTimeReport(report.Id, crewBossSigned, customerSignerName)));
      return signed === true;
    },
    approve: async (reportId) => {
      const approved = await settle(async () => adopt(await approveTimeReport(reportId)));
      return approved === true;
    },
    loadExpenses: async () => {
      const deployment = get().deployment;
      if (!deployment || !operationsCapabilities.recordExpenses) return;
      await settle(async () => set({ expenses: await getExpenses(deployment.Id) }));
    },
    addExpense: async (input) => {
      const deployment = get().deployment;
      if (!deployment) return false;
      const added = await settle(async () => {
        const expense = await saveExpense({ ...input, DeploymentId: deployment.Id });
        set({ expenses: [expense, ...get().expenses.filter((existing) => existing.Id !== expense.Id)] });
        return true;
      });
      return added === true;
    },
    removeExpense: async (id) => {
      const removed = await settle(async () => {
        await deleteExpense(id);
        set({ expenses: get().expenses.filter((expense) => expense.Id !== id) });
        return true;
      });
      return removed === true;
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
    close: () => set({ ...closed, error: null }),
  };
});
