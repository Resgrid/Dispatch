import { combineDateTime, entryHours, isClockTime, newEntry, operationsError, reportForDate, rosterSubjects, sumHours, timeOf, validateEntries } from '@/lib/operations/time';
import type { Deployment, TimeEntry } from '@/models/v4/operations';

const deployment = (): Deployment => ({
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
  ],
  Equipment: [{ Id: 'de-1', DeploymentUnitId: 'du-2', Name: 'Saw', IsActive: true }],
});

const entry = (patch: Partial<TimeEntry>): TimeEntry => ({ ...newEntry({ type: 0, id: 'dp-1', label: 'Me' }, '2026-09-19', 0), ...patch });

it('computes hours from deployment-local wall clock minus unpaid breaks', () => {
  expect(timeOf('2026-09-19T07:30:00')).toBe('07:30');
  expect(isClockTime('7:30')).toBe(false);
  expect(isClockTime('23:59')).toBe(true);
  expect(combineDateTime('2026-09-19', '07:30')).toBe('2026-09-19T07:30:00');
  expect(entryHours(entry({ StartTime: '2026-09-19T08:00:00', EndTime: '2026-09-19T18:00:00', UnpaidBreakMinutes: 30 }))).toBe(9.5);
  expect(entryHours(entry({ StartTime: '2026-09-19T18:00:00', EndTime: '2026-09-19T08:00:00' }))).toBe(0);
  expect(sumHours([entry({ StartTime: '2026-09-19T08:00:00', EndTime: '2026-09-19T12:15:00' }), entry({ StartTime: '2026-09-19T13:00:00', EndTime: '2026-09-19T14:00:00' })])).toBe(5.25);
});

it('flags missing subjects, inverted times and overlapping entries for the same subject only', () => {
  const issues = validateEntries([
    entry({ DeploymentPersonnelId: null }),
    entry({ StartTime: '2026-09-19T18:00:00', EndTime: '2026-09-19T08:00:00' }),
    entry({ StartTime: '2026-09-19T08:00:00', EndTime: '2026-09-19T12:00:00' }),
    entry({ StartTime: '2026-09-19T11:00:00', EndTime: '2026-09-19T13:00:00' }),
    entry({ DeploymentPersonnelId: 'dp-2', StartTime: '2026-09-19T11:00:00', EndTime: '2026-09-19T13:00:00' }),
  ]);
  expect(issues).toEqual([
    { code: 'missing_subject', index: 0 },
    { code: 'end_before_start', index: 1 },
    { code: 'overlap', index: 3 },
  ]);
});

it('scopes the roster picker to the person, their active unit or the whole deployment for a manager', () => {
  const all = rosterSubjects(deployment(), { userId: 'me', activeUnitId: null, manager: true });
  expect(all.map((subject) => subject.id)).toEqual(['dp-1', 'dp-2', 'dp-3', 'du-1', 'du-2', 'de-1']);
  expect(all.find((subject) => subject.id === 'dp-2')?.label).toBe('Crew (FF)');
  expect(rosterSubjects(deployment(), { userId: 'me', activeUnitId: '12', manager: false }).map((subject) => subject.id)).toEqual(['dp-1', 'dp-2', 'du-1']);
  expect(rosterSubjects(deployment(), { userId: 'me', activeUnitId: '99', manager: false }).map((subject) => subject.id)).toEqual(['dp-1']);
  expect(rosterSubjects(deployment(), { userId: 'me', activeUnitId: null, manager: false }).map((subject) => subject.id)).toEqual(['dp-1']);
  expect(rosterSubjects(deployment(), { userId: 'nobody', activeUnitId: null, manager: false })).toEqual([]);
});

it('matches a report by calendar day and maps server failures to short reason codes', () => {
  const reports = [{ Id: 'r-1', ReportDate: '2026-09-19T00:00:00', Entries: [] }, { Id: 'r-2', ReportDate: '2026-09-20T00:00:00', Entries: [] }] as never;
  expect(reportForDate(reports, '2026-09-20')?.Id).toBe('r-2');
  expect(reportForDate(reports, '2026-09-21')).toBeNull();
  expect(operationsError({ response: { status: 403, headers: { 'x-resgrid-reason': 'deployments_disabled' } } })).toBe('disabled');
  expect(operationsError({ response: { status: 401 } })).toBe('denied');
  expect(operationsError({ response: { status: 400, headers: { 'x-resgrid-reason': 'time_report_not_editable' } } })).toBe('time_report_not_editable');
  expect(operationsError({ response: { status: 400 } })).toBe('validation');
  expect(operationsError({ response: { status: 200, data: { type: 'protected_data_required' } } })).toBe('locked');
  expect(operationsError(new Error('boom'))).toBe('retry');
});
