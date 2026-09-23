jest.mock('@/api/operations/operations', () => ({
  getDeploymentAccess: jest.fn(),
  getDeployments: jest.fn(),
  getDeployment: jest.fn(),
  getTimeReports: jest.fn(),
  newTimeReport: jest.fn(),
  saveTimeEntries: jest.fn(),
  submitTimeReport: jest.fn(),
  signTimeReport: jest.fn(),
  approveTimeReport: jest.fn(),
  getExpenses: jest.fn(),
  saveExpense: jest.fn(),
  deleteExpense: jest.fn(),
  getFieldCostAccess: jest.fn(),
  getResourceUsage: jest.fn(),
  addResourceUsage: jest.fn(),
  getCalOesMarsAccess: jest.fn(),
  getCalOesMarsQueue: jest.fn(),
  buildF42: jest.fn(),
  validateCalOesMarsWorkItem: jest.fn(),
}));
jest.mock('@/lib/operations/capabilities', () => ({
  operationsCapabilities: { editTime: true, recordUsage: true, recordExpenses: true, approveTime: true, draftF42: true, homeRoute: '/', useActiveUnitId: () => null },
}));
jest.mock('@/stores/auth/store', () => {
  const { create } = jest.requireActual('zustand');
  return { __esModule: true, default: create(() => ({ userId: 'me' })) };
});
jest.mock('@/stores/security/store', () => {
  const { create } = jest.requireActual('zustand');
  return { securityStore: create(() => ({ rights: { DepartmentId: '77' } })) };
});

import * as api from '@/api/operations/operations';
import { newEntry } from '@/lib/operations/time';
import useAuthStore from '@/stores/auth/store';
import { useOperationsStore } from '@/stores/operations/store';

const server = jest.mocked(api);
const deployment = {
  Id: 'dep-1',
  Name: 'LNU',
  Status: 2,
  FinanceMode: 1,
  CallId: 9,
  Currency: 'USD',
  Units: [{ Id: 'du-1', UnitId: 12, UnitName: 'E-41', IsActive: true }],
  Personnel: [{ Id: 'dp-1', UserId: 'me', Name: 'Me', DeploymentUnitId: 'du-1', IsActive: true }],
  Equipment: [],
  TimeAccess: { CanManage: false, CanApprove: true, PersonnelId: 'dp-1', CrewUnitIds: ['du-1'], WritableSubjectIds: ['dp-1', 'du-1'] },
};
const report = (status = 0, entries: unknown[] = [], patch: Record<string, unknown> = {}) => ({
  Id: 'r-1',
  DeploymentId: 'dep-1',
  ReportNumber: 1,
  ReportDate: '2026-09-19T00:00:00',
  Scope: 1,
  DeploymentUnitId: 'du-1',
  CanAct: true,
  Status: status,
  Entries: entries,
  ...patch,
});
const answer = (data: unknown, errors: unknown[] = [], warnings: unknown[] = []) => ({ Data: data, Status: 'Ok', PageSize: 1, Errors: errors, Warnings: warnings }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  useOperationsStore.setState({ identity: null, access: null, deployment: null, reports: [], scope: null, report: null, entries: [], dirty: false, issues: [], warnings: [], expenses: [], error: null });
  server.getDeploymentAccess.mockResolvedValue({ Enabled: true, CanManage: false, CanApproveTimeReports: false, ContractorBilling: false });
  server.getFieldCostAccess.mockResolvedValue({ Enabled: true, CanViewInternalCosts: false, CanRecordUsage: true });
  server.getCalOesMarsAccess.mockRejectedValue(new Error('no add-on'));
  server.getDeployment.mockResolvedValue(deployment as never);
  server.getTimeReports.mockResolvedValue([]);
  server.newTimeReport.mockResolvedValue(answer(report()));
});

it('loads access without letting an unavailable add-on hide the deployments, and drops state on identity change', async () => {
  useOperationsStore.setState({ identity: 'someone:77', deployments: [deployment as never] });
  await useOperationsStore.getState().loadAccess();
  const state = useOperationsStore.getState();
  expect(state.identity).toBe('me:77');
  expect(state.deployments).toEqual([]);
  expect(state.access?.Enabled).toBe(true);
  expect(state.costAccess?.CanRecordUsage).toBe(true);
  expect(state.marsAccess).toBeNull();
  expect(state.error).toBeNull();
  useAuthStore.setState({ userId: 'me' });
});

it('opens the crew report for the scope on demand, refuses invalid entries locally and submits only a clean saved report', async () => {
  await useOperationsStore.getState().loadAccess();
  await useOperationsStore.getState().open('dep-1');
  useOperationsStore.getState().setScope({ kind: 'crew', unitId: 'du-1' }, '2026-09-19');
  expect(useOperationsStore.getState().report).toBeNull();
  await useOperationsStore.getState().openReport('2026-09-19', false);
  expect(server.newTimeReport).not.toHaveBeenCalled();

  await useOperationsStore.getState().openReport('2026-09-19', true);
  expect(server.newTimeReport).toHaveBeenCalledWith('dep-1', '2026-09-19', { deploymentUnitId: 'du-1', deploymentPersonnelId: null });
  expect(useOperationsStore.getState().report?.Id).toBe('r-1');

  const bad = { ...newEntry({ type: 0, id: 'dp-1', label: 'Me' }, '2026-09-19', 0), EndLocal: '2026-09-19T06:00' };
  useOperationsStore.getState().setEntries([bad]);
  expect(await useOperationsStore.getState().save()).toBe(false);
  expect(server.saveTimeEntries).not.toHaveBeenCalled();
  expect(useOperationsStore.getState().issues).toEqual([{ Code: 'end_before_start', EntryId: '0' }]);
  expect(await useOperationsStore.getState().submit()).toBe(false);

  const good = newEntry({ type: 0, id: 'dp-1', label: 'Me' }, '2026-09-19', 0);
  server.saveTimeEntries.mockResolvedValue(answer(report(0, [{ ...good, Id: 'e-1', Hours: 10 }]), [], [{ Code: 'break_rule' }]));
  useOperationsStore.getState().setEntries([good]);
  expect(await useOperationsStore.getState().save()).toBe(true);
  expect(server.saveTimeEntries).toHaveBeenCalledWith('r-1', [good]);
  expect(useOperationsStore.getState().dirty).toBe(false);
  expect(useOperationsStore.getState().warnings).toEqual([{ Code: 'break_rule' }]);

  server.signTimeReport.mockResolvedValue(answer(report(0, [{ ...good, Id: 'e-1' }], { ContractorSignedOn: '2026-09-19T20:00:00Z' })));
  expect(await useOperationsStore.getState().sign(true)).toBe(true);
  expect(server.signTimeReport).toHaveBeenCalledWith('r-1', true, undefined);
  expect(useOperationsStore.getState().report?.ContractorSignedOn).toBe('2026-09-19T20:00:00Z');

  server.submitTimeReport.mockResolvedValue(answer(report(1, [{ ...good, Id: 'e-1' }])));
  expect(await useOperationsStore.getState().submit()).toBe(true);
  expect(useOperationsStore.getState().report?.Status).toBe(1);
  expect(useOperationsStore.getState().reports.find((candidate) => candidate.Id === 'r-1')?.Status).toBe(1);

  server.approveTimeReport.mockResolvedValue(answer(report(2, [{ ...good, Id: 'e-1' }])));
  expect(await useOperationsStore.getState().approve('r-1')).toBe(true);
  expect(useOperationsStore.getState().report?.Status).toBe(2);
});

it('keeps validation refusals from the server on the report and switches scope without leaking entries', async () => {
  server.getTimeReports.mockResolvedValue([report(0, [{ Id: 'e-1', SubjectType: 0, DeploymentPersonnelId: 'dp-1', EntryType: 0, StartLocal: '2026-09-19T08:00', EndLocal: '2026-09-19T18:00' }])] as never);
  await useOperationsStore.getState().open('dep-1');
  useOperationsStore.getState().setScope({ kind: 'crew', unitId: 'du-1' }, '2026-09-19');
  expect(useOperationsStore.getState().entries).toHaveLength(1);

  server.saveTimeEntries.mockResolvedValue(answer(report(0, []), [{ Code: 'subject_on_other_report', SubjectId: 'dp-1' }]));
  useOperationsStore.getState().setEntries([...useOperationsStore.getState().entries]);
  expect(await useOperationsStore.getState().save()).toBe(false);
  expect(useOperationsStore.getState().issues).toEqual([{ Code: 'subject_on_other_report', SubjectId: 'dp-1' }]);

  useOperationsStore.getState().setScope({ kind: 'individual', personnelId: 'dp-1' }, '2026-09-19');
  expect(useOperationsStore.getState().report).toBeNull();
  expect(useOperationsStore.getState().entries).toEqual([]);
  expect(useOperationsStore.getState().issues).toEqual([]);
});

it('files expenses against the open deployment and removes only by id', async () => {
  await useOperationsStore.getState().open('dep-1');
  server.saveExpense.mockResolvedValue({ Id: 'x-1', DeploymentId: 'dep-1', ExpenseDate: '2026-09-19T00:00:00', ExpenseType: 4, Amount: 88.4, PreApproved: false, Billable: true } as never);
  expect(await useOperationsStore.getState().addExpense({ ExpenseDate: '2026-09-19', ExpenseType: 4, Amount: 88.4, ReceiptData: 'AAAA', ReceiptFileName: 'r.jpg', ReceiptContentType: 'image/jpeg' })).toBe(true);
  expect(server.saveExpense).toHaveBeenCalledWith(expect.objectContaining({ DeploymentId: 'dep-1', ExpenseType: 4, ReceiptData: 'AAAA' }));
  expect(useOperationsStore.getState().expenses.map((expense) => expense.Id)).toEqual(['x-1']);

  server.deleteExpense.mockResolvedValue({} as never);
  expect(await useOperationsStore.getState().removeExpense('x-1')).toBe(true);
  expect(server.deleteExpense).toHaveBeenCalledWith('x-1');
  expect(useOperationsStore.getState().expenses).toEqual([]);
});

it('stamps usage readings with the open deployment and surfaces server refusals as reason codes', async () => {
  await useOperationsStore.getState().loadAccess();
  await useOperationsStore.getState().open('dep-1');
  server.addResourceUsage.mockResolvedValue({ Id: 'u-1', UnitId: 12, UsageDate: '2026-09-19T00:00:00', Phase: 2, Source: 0, NeedsReview: false } as never);
  expect(await useOperationsStore.getState().addUsage({ UnitId: 12, UsageDate: '2026-09-19T00:00:00', Phase: 2, Distance: 60, DistanceUnit: 'mi' })).toBe(true);
  expect(server.addResourceUsage).toHaveBeenCalledWith(expect.objectContaining({ DeploymentId: 'dep-1', CallId: 9, UnitId: 12 }));
  expect(useOperationsStore.getState().usage.map((reading) => reading.Id)).toEqual(['u-1']);

  server.addResourceUsage.mockRejectedValue({ response: { status: 400, headers: { 'x-resgrid-reason': 'usage_unit_not_rostered' } } });
  expect(await useOperationsStore.getState().addUsage({ UnitId: 99, UsageDate: '2026-09-19T00:00:00', Phase: 2 })).toBe(false);
  expect(useOperationsStore.getState().error).toBe('usage_unit_not_rostered');
});
