import {
  applyToCrew,
  availableScopes,
  combineDateTime,
  coveringReport,
  defaultScope,
  endLocalFor,
  entryHours,
  hoursBySubject,
  isClockTime,
  isReportEditable,
  newEntry,
  operationsError,
  reportForScope,
  scopeKey,
  scopeSubjects,
  shiftDateKey,
  sumHours,
  timeOf,
  validateEntries,
} from '@/lib/operations/time';
import type { Deployment, TimeEntry, TimeReport } from '@/models/v4/operations';

// Engine 41 (me as crew boss, a crew member, a released member, a pump), Engine 42 (another crew, a saw),
// a single resource with no unit. TimeAccess is what the server answers for "me".
const deployment = (access: Partial<NonNullable<Deployment['TimeAccess']>> = {}): Deployment => ({
  Id: 'dep-1',
  Name: 'LNU Lightning Complex',
  Status: 2,
  FinanceMode: 1,
  Units: [
    { Id: 'du-1', UnitId: 12, UnitName: 'E-41', CallSign: null, IsActive: true },
    { Id: 'du-2', UnitId: 13, UnitName: 'E-42', CallSign: null, IsActive: true },
    { Id: 'du-3', UnitId: 14, UnitName: 'E-43', CallSign: null, IsActive: false },
  ],
  Personnel: [
    { Id: 'dp-1', UserId: 'me', Name: 'Me', DeploymentUnitId: 'du-1', IsActive: true },
    { Id: 'dp-2', UserId: 'crew', Name: 'Crew', DeploymentUnitId: 'du-1', IsActive: true, CallSign: 'FF' },
    { Id: 'dp-3', UserId: 'other', Name: 'Other', DeploymentUnitId: 'du-2', IsActive: true },
    { Id: 'dp-4', UserId: 'gone', Name: 'Gone', DeploymentUnitId: 'du-1', IsActive: false },
    { Id: 'dp-5', UserId: 'solo', Name: 'Solo', DeploymentUnitId: null, IsActive: true },
  ],
  Equipment: [
    { Id: 'de-1', DeploymentUnitId: 'du-1', Name: 'Pump', IsActive: true },
    { Id: 'de-2', DeploymentUnitId: 'du-2', Name: 'Saw', IsActive: true },
  ],
  TimeAccess: { CanManage: false, CanApprove: false, PersonnelId: 'dp-1', CrewUnitIds: ['du-1'], WritableSubjectIds: ['dp-1', 'du-1', 'dp-2', 'dp-4', 'de-1'], TimeZone: 'Pacific Standard Time', ...access },
});

const entry = (patch: Partial<TimeEntry>): TimeEntry => ({ ...newEntry({ type: 0, id: 'dp-1', label: 'Me' }, '2026-09-19', 0), ...patch });
const report = (patch: Partial<TimeReport>): TimeReport => ({ Id: 'r-1', DeploymentId: 'dep-1', ReportNumber: 1, ReportDate: '2026-09-19T00:00:00', Scope: 1, DeploymentUnitId: 'du-1', CanAct: true, Status: 0, Entries: [], ...patch });

it('computes hours from department-local wall clock minus unpaid breaks, across midnight too', () => {
  expect(timeOf('2026-09-19T07:30')).toBe('07:30');
  expect(isClockTime('7:30')).toBe(false);
  expect(isClockTime('23:59')).toBe(true);
  expect(combineDateTime('2026-09-19', '07:30')).toBe('2026-09-19T07:30');
  expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01');
  expect(endLocalFor('2026-09-19T20:00', '06:00')).toBe('2026-09-20T06:00');
  expect(endLocalFor('2026-09-19T08:00', '18:00')).toBe('2026-09-19T18:00');
  expect(entryHours(entry({ StartLocal: '2026-09-19T08:00', EndLocal: '2026-09-19T18:00', UnpaidBreakMinutes: 30 }))).toBe(9.5);
  expect(entryHours(entry({ StartLocal: '2026-09-19T20:00', EndLocal: '2026-09-20T06:00' }))).toBe(10);
  expect(entryHours(entry({ StartLocal: '2026-09-19T18:00', EndLocal: '2026-09-19T08:00' }))).toBe(0);
  expect(sumHours([entry({ StartLocal: '2026-09-19T08:00', EndLocal: '2026-09-19T12:15' }), entry({ StartLocal: '2026-09-19T13:00', EndLocal: '2026-09-19T14:00' })])).toBe(5.25);
});

it('flags missing subjects, inverted times and overlapping entries for the same subject only', () => {
  const issues = validateEntries([
    entry({ DeploymentPersonnelId: null }),
    entry({ StartLocal: '2026-09-19T18:00', EndLocal: '2026-09-19T08:00' }),
    entry({ StartLocal: '2026-09-19T08:00', EndLocal: '2026-09-19T12:00' }),
    entry({ StartLocal: '2026-09-19T11:00', EndLocal: '2026-09-19T13:00' }),
    entry({ DeploymentPersonnelId: 'dp-2', StartLocal: '2026-09-19T11:00', EndLocal: '2026-09-19T13:00' }),
  ]);
  expect(issues).toEqual([
    { code: 'missing_subject', index: 0 },
    { code: 'end_before_start', index: 1 },
    { code: 'overlap', index: 3 },
  ]);
});

it('offers exactly the scopes the server granted and opens on the crew report', () => {
  expect(availableScopes(deployment()).map(scopeKey)).toEqual(['crew:du-1', 'person:dp-1']);
  expect(scopeKey(defaultScope(deployment(), null))).toBe('crew:du-1');
  // The Engine 42 tablet: seated on unit 13, not on the roster.
  const tablet = deployment({ PersonnelId: null, CrewUnitIds: ['du-2'], WritableSubjectIds: ['du-2', 'dp-3', 'de-2'] });
  expect(scopeKey(defaultScope(tablet, '13'))).toBe('crew:du-2');
  // A single resource files their own report.
  const solo = deployment({ PersonnelId: 'dp-5', CrewUnitIds: [], WritableSubjectIds: ['dp-5'] });
  expect(availableScopes(solo).map(scopeKey)).toEqual(['person:dp-5']);
  expect(scopeKey(defaultScope(solo, null))).toBe('person:dp-5');
  // A manager may open every active crew, their own and the deployment-wide DTR.
  const manager = deployment({ CanManage: true, PersonnelId: null, CrewUnitIds: [], WritableSubjectIds: [] });
  expect(availableScopes(manager).map(scopeKey)).toEqual(['crew:du-1', 'crew:du-2', 'deployment']);
  expect(availableScopes({ ...deployment(), TimeAccess: null })).toEqual([]);
});

it('limits the picker to the report scope and to subjects the person may write', () => {
  expect(scopeSubjects(deployment(), { kind: 'crew', unitId: 'du-1' }).map((subject) => subject.id)).toEqual(['du-1', 'dp-1', 'dp-2', 'de-1']);
  expect(scopeSubjects(deployment(), { kind: 'crew', unitId: 'du-1' }).find((subject) => subject.id === 'dp-2')?.label).toBe('Crew (FF)');
  expect(scopeSubjects(deployment(), { kind: 'crew', unitId: 'du-2' })).toEqual([]);
  expect(scopeSubjects(deployment(), { kind: 'individual', personnelId: 'dp-1' }).map((subject) => subject.id)).toEqual(['dp-1']);
  expect(scopeSubjects(deployment({ CanManage: true }), { kind: 'deployment' }).map((subject) => subject.id)).toEqual(['du-1', 'du-2', 'dp-1', 'dp-2', 'dp-3', 'dp-5', 'de-1', 'de-2']);
});

it('copies the unit row onto the crew only for writable rows of the same entry type', () => {
  const rows = [
    entry({ SubjectType: 1, DeploymentPersonnelId: null, DeploymentUnitId: 'du-1', StartLocal: '2026-09-19T06:00', EndLocal: '2026-09-19T20:00', UnpaidBreakMinutes: 30, AgencySuppliedMeals: true }),
    entry({ DeploymentPersonnelId: 'dp-2' }),
    entry({ DeploymentPersonnelId: 'dp-3' }),
    entry({ DeploymentPersonnelId: 'dp-1', EntryType: 2 }),
  ];
  const applied = applyToCrew(rows, 0, (id) => id !== 'dp-3');
  expect(applied[1]).toMatchObject({ StartLocal: '2026-09-19T06:00', EndLocal: '2026-09-19T20:00', UnpaidBreakMinutes: 30, AgencySuppliedMeals: true });
  expect(applied[2]).toBe(rows[2]);
  expect(applied[3]).toBe(rows[3]);
  expect(hoursBySubject(applied)).toEqual({ 'du-1': 13.5, 'dp-2': 13.5, 'dp-3': 10, 'dp-1': 10 });
});

it('finds the report for a scope and day, the report already covering a subject, and editability', () => {
  const crew = report({ Entries: [entry({ DeploymentPersonnelId: 'dp-1' })] });
  const solo = report({ Id: 'r-2', Scope: 2, DeploymentUnitId: null, DeploymentPersonnelId: 'dp-5' });
  const voided = report({ Id: 'r-3', Status: 4 });
  expect(reportForScope([voided, crew, solo], '2026-09-19', { kind: 'crew', unitId: 'du-1' })?.Id).toBe('r-1');
  expect(reportForScope([crew, solo], '2026-09-19', { kind: 'individual', personnelId: 'dp-5' })?.Id).toBe('r-2');
  expect(reportForScope([crew], '2026-09-20', { kind: 'crew', unitId: 'du-1' })).toBeNull();
  expect(coveringReport([crew, solo], '2026-09-19', 'dp-1')?.Id).toBe('r-1');
  expect(coveringReport([crew], '2026-09-19', 'dp-1', 'r-1')).toBeNull();
  expect(isReportEditable(crew)).toBe(true);
  expect(isReportEditable({ ...crew, CanAct: false })).toBe(false);
  expect(isReportEditable({ ...crew, Status: 1 })).toBe(false);
});

it('maps server failures to short reason codes', () => {
  expect(operationsError({ response: { status: 403, headers: { 'x-resgrid-reason': 'deployments_disabled' } } })).toBe('disabled');
  expect(operationsError({ response: { status: 401 } })).toBe('denied');
  expect(operationsError({ response: { status: 400, headers: { 'x-resgrid-reason': 'timereports_subject_covered' } } })).toBe('timereports_subject_covered');
  expect(operationsError({ response: { status: 400 } })).toBe('validation');
  expect(operationsError({ response: { status: 200, data: { type: 'protected_data_required' } } })).toBe('locked');
  expect(operationsError(new Error('boom'))).toBe('retry');
});
