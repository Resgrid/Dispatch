jest.mock('@/api/common/client', () => ({ api: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } }));
import { api } from '@/api/common/client';
import {
  addResourceUsage,
  approveTimeReport,
  buildF42,
  deleteExpense,
  getDeployments,
  getExpenses,
  getTimeReports,
  newTimeReport,
  saveExpense,
  saveTimeEntries,
  signTimeReport,
  submitTimeReport,
  validateCalOesMarsWorkItem,
} from '@/api/operations/operations';

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(api.get).mockResolvedValue({ data: { Data: [] } });
  jest.mocked(api.post).mockResolvedValue({ data: { Data: { Id: 'r-1', Entries: [] }, Errors: [], Warnings: [] } });
  jest.mocked(api.delete).mockResolvedValue({ data: { Status: 'Success' } });
});

it('lists open deployments by default and everything on request', async () => {
  await getDeployments();
  expect(api.get).toHaveBeenCalledWith('/Deployments/GetDeployments', { params: { active: true, skip: 0, take: 100 } });
  await getDeployments(false);
  expect(api.get).toHaveBeenLastCalledWith('/Deployments/GetDeployments', { params: { active: false, skip: 0, take: 100 } });
  await getTimeReports('dep-1');
  expect(api.get).toHaveBeenLastCalledWith('/TimeReports/GetTimeReports', { params: { deploymentId: 'dep-1' } });
});

it('opens crew and individual reports and saves only the local wall clock', async () => {
  await newTimeReport('dep-1', '2026-09-19', { deploymentUnitId: 'du-1' });
  expect(api.post).toHaveBeenCalledWith('/TimeReports/NewTimeReport', { DeploymentId: 'dep-1', ReportDate: '2026-09-19', DeploymentUnitId: 'du-1', DeploymentPersonnelId: null });
  await newTimeReport('dep-1', '2026-09-19', { deploymentPersonnelId: 'dp-5' });
  expect(api.post).toHaveBeenLastCalledWith('/TimeReports/NewTimeReport', { DeploymentId: 'dep-1', ReportDate: '2026-09-19', DeploymentUnitId: null, DeploymentPersonnelId: 'dp-5' });

  const entry = {
    Id: 'e-1',
    SubjectType: 0,
    DeploymentPersonnelId: 'p-1',
    EntryType: 0,
    StartTime: '2026-09-19T15:00:00.000Z',
    EndTime: '2026-09-20T01:00:00.000Z',
    StartLocal: '2026-09-19T08:00',
    EndLocal: '2026-09-19T18:00',
    PaidBreakMinutes: 0,
    UnpaidBreakMinutes: 30,
    AgencySuppliedMeals: true,
    AgencySuppliedAccommodation: false,
    SortOrder: 0,
    Hours: 9.5,
  };
  const saved = await saveTimeEntries('r-1', [entry]);
  const { StartTime: _start, EndTime: _end, Hours: _hours, ...sent } = entry;
  expect(api.post).toHaveBeenLastCalledWith('/TimeReports/SaveTimeEntries', { TimeReportId: 'r-1', Entries: [sent] });
  expect(saved.Errors).toEqual([]);
  await submitTimeReport('r-1');
  expect(api.post).toHaveBeenLastCalledWith('/TimeReports/SubmitTimeReport', { Id: 'r-1' });
  await signTimeReport('r-1', true);
  expect(api.post).toHaveBeenLastCalledWith('/TimeReports/SignTimeReport', { Id: 'r-1', ContractorSigned: true, CustomerSignerName: null });
  await signTimeReport('r-1', false, 'J. Agency');
  expect(api.post).toHaveBeenLastCalledWith('/TimeReports/SignTimeReport', { Id: 'r-1', ContractorSigned: false, CustomerSignerName: 'J. Agency' });
  await approveTimeReport('r-1');
  expect(api.post).toHaveBeenLastCalledWith('/TimeReports/ApproveTimeReport', { Id: 'r-1' });
});

it('files, lists and removes expenses with the receipt riding as base64', async () => {
  await getExpenses('dep-1');
  expect(api.get).toHaveBeenLastCalledWith('/TimeReports/GetExpenses', { params: { deploymentId: 'dep-1' } });
  const input = { DeploymentId: 'dep-1', ExpenseDate: '2026-09-19', ExpenseType: 4, Amount: 88.4, ReceiptData: 'AAAA', ReceiptFileName: 'r.jpg', ReceiptContentType: 'image/jpeg' };
  await saveExpense(input);
  expect(api.post).toHaveBeenLastCalledWith('/TimeReports/SaveExpense', input, { timeout: 60000 });
  await deleteExpense('x-1');
  expect(api.delete).toHaveBeenCalledWith('/TimeReports/DeleteExpense', { params: { id: 'x-1' } });
});

it('posts usage readings and the F-42 draft / validation calls as the server expects them', async () => {
  const input = { DeploymentId: 'dep-1', CallId: null, UnitId: 12, UsageDate: '2026-09-19T00:00:00', Phase: 2, StartOdometer: 100, EndOdometer: 160, DistanceUnit: 'mi', Distance: 60 };
  await addResourceUsage(input);
  expect(api.post).toHaveBeenCalledWith('/FieldCost/AddResourceUsage', input);
  await buildF42('dep-1');
  expect(api.post).toHaveBeenLastCalledWith('/CalOesMars/BuildF42', { DeploymentId: 'dep-1' });
  await validateCalOesMarsWorkItem('wi-1');
  expect(api.post).toHaveBeenLastCalledWith('/CalOesMars/Validate', null, { params: { id: 'wi-1' } });
});
