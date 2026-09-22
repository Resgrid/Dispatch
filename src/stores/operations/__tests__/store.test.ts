jest.mock('@/api/operations/operations', () => ({
  getDeploymentAccess: jest.fn(),
  getDeployments: jest.fn(),
  getDeployment: jest.fn(),
  getTimeReports: jest.fn(),
  newTimeReport: jest.fn(),
  saveTimeEntries: jest.fn(),
  submitTimeReport: jest.fn(),
  getFieldCostAccess: jest.fn(),
  getResourceUsage: jest.fn(),
  addResourceUsage: jest.fn(),
  getCalOesMarsAccess: jest.fn(),
  getCalOesMarsQueue: jest.fn(),
  buildF42: jest.fn(),
  validateCalOesMarsWorkItem: jest.fn(),
}));
jest.mock('@/lib/operations/capabilities', () => ({ operationsCapabilities: { editTime: true, recordUsage: true, draftF42: true, homeRoute: '/', useActiveUnitId: () => null } }));
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
const deployment = { Id: 'dep-1', Name: 'LNU', Status: 2, FinanceMode: 1, CallId: 9, Units: [], Personnel: [{ Id: 'dp-1', UserId: 'me', Name: 'Me', IsActive: true }], Equipment: [] };
const report = (status = 0, entries: unknown[] = []) => ({ Id: 'r-1', DeploymentId: 'dep-1', ReportNumber: 1, ReportDate: '2026-09-19T00:00:00', Status: status, Entries: entries });

beforeEach(() => {
  jest.clearAllMocks();
  useOperationsStore.setState({ identity: null, access: null, deployment: null, reports: [], report: null, entries: [], dirty: false, issues: [], warnings: [], error: null });
  server.getDeploymentAccess.mockResolvedValue({ Enabled: true, CanManage: false, CanApproveTimeReports: false, ContractorBilling: false });
  server.getFieldCostAccess.mockResolvedValue({ Enabled: true, CanViewInternalCosts: false, CanRecordUsage: true });
  server.getCalOesMarsAccess.mockRejectedValue(new Error('no add-on'));
  server.getDeployment.mockResolvedValue(deployment as never);
  server.getTimeReports.mockResolvedValue([]);
  server.newTimeReport.mockResolvedValue({ Data: report(), Status: 'Ok', PageSize: 1, Errors: [], Warnings: [] } as never);
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

it('creates the day report on demand, refuses to save invalid entries locally and submits only a clean saved report', async () => {
  await useOperationsStore.getState().loadAccess();
  await useOperationsStore.getState().open('dep-1');
  await useOperationsStore.getState().openReport('2026-09-19', false);
  expect(useOperationsStore.getState().report).toBeNull();
  expect(server.newTimeReport).not.toHaveBeenCalled();

  await useOperationsStore.getState().openReport('2026-09-19', true);
  expect(server.newTimeReport).toHaveBeenCalledWith('dep-1', '2026-09-19');
  expect(useOperationsStore.getState().report?.Id).toBe('r-1');

  const bad = { ...newEntry({ type: 0, id: 'dp-1', label: 'Me' }, '2026-09-19', 0), EndTime: '2026-09-19T06:00:00' };
  useOperationsStore.getState().setEntries([bad]);
  expect(await useOperationsStore.getState().save()).toBe(false);
  expect(server.saveTimeEntries).not.toHaveBeenCalled();
  expect(useOperationsStore.getState().issues).toEqual([{ Code: 'end_before_start', EntryId: '0' }]);
  expect(await useOperationsStore.getState().submit()).toBe(false);

  const good = newEntry({ type: 0, id: 'dp-1', label: 'Me' }, '2026-09-19', 0);
  server.saveTimeEntries.mockResolvedValue({ Data: report(0, [{ ...good, Id: 'e-1', Hours: 10 }]), Status: 'Ok', PageSize: 1, Errors: [], Warnings: [{ Code: 'long_day' }] } as never);
  useOperationsStore.getState().setEntries([good]);
  expect(await useOperationsStore.getState().save()).toBe(true);
  expect(server.saveTimeEntries).toHaveBeenCalledWith('r-1', [good]);
  expect(useOperationsStore.getState().dirty).toBe(false);
  expect(useOperationsStore.getState().warnings).toEqual([{ Code: 'long_day' }]);

  server.submitTimeReport.mockResolvedValue({ Data: report(1, [{ ...good, Id: 'e-1' }]), Status: 'Ok', PageSize: 1, Errors: [], Warnings: [] } as never);
  expect(await useOperationsStore.getState().submit()).toBe(true);
  expect(useOperationsStore.getState().report?.Status).toBe(1);
  expect(useOperationsStore.getState().reports[0]?.Status).toBe(1);
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
