jest.mock('@/api/common/client', () => ({ api: { get: jest.fn(), post: jest.fn() } }));
import { api } from '@/api/common/client';
import { addResourceUsage, buildF42, getDeployments, getTimeReports, newTimeReport, saveTimeEntries, submitTimeReport, validateCalOesMarsWorkItem } from '@/api/operations/operations';

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(api.get).mockResolvedValue({ data: { Data: [] } });
  jest.mocked(api.post).mockResolvedValue({ data: { Data: { Id: 'r-1', Entries: [] }, Errors: [], Warnings: [] } });
});

it('lists open deployments by default and everything on request', async () => {
  await getDeployments();
  expect(api.get).toHaveBeenCalledWith('/Deployments/GetDeployments', { params: { active: true, skip: 0, take: 100 } });
  await getDeployments(false);
  expect(api.get).toHaveBeenLastCalledWith('/Deployments/GetDeployments', { params: { active: false, skip: 0, take: 100 } });
  await getTimeReports('dep-1');
  expect(api.get).toHaveBeenLastCalledWith('/TimeReports/GetTimeReports', { params: { deploymentId: 'dep-1' } });
});

it('creates, saves and submits a daily time report with the whole entry list as the unit of save', async () => {
  await newTimeReport('dep-1', '2026-09-19');
  expect(api.post).toHaveBeenCalledWith('/TimeReports/NewTimeReport', { DeploymentId: 'dep-1', ReportDate: '2026-09-19' });
  const entry = { Id: null, SubjectType: 0, DeploymentPersonnelId: 'p-1', EntryType: 0, StartTime: '2026-09-19T08:00:00', EndTime: '2026-09-19T18:00:00', PaidBreakMinutes: 0, UnpaidBreakMinutes: 30, AgencySuppliedMeals: true, AgencySuppliedAccommodation: false, SortOrder: 0 };
  const saved = await saveTimeEntries('r-1', [entry]);
  expect(api.post).toHaveBeenLastCalledWith('/TimeReports/SaveTimeEntries', { TimeReportId: 'r-1', Entries: [entry] });
  expect(saved.Errors).toEqual([]);
  await submitTimeReport('r-1');
  expect(api.post).toHaveBeenLastCalledWith('/TimeReports/SubmitTimeReport', { Id: 'r-1' });
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
