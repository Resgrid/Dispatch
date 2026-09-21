import type { Deployment, TimeEntry, TimeReport } from '@/models/v4/operations';
import { TimeEntryType, TimeSubjectType } from '@/models/v4/operations';

// Pure helpers behind the daily time report editor. Times are deployment-local wall clock: the
// server stores what the crew wrote on the paper DTR, so nothing here converts to UTC.

const pad = (n: number) => String(n).padStart(2, '0');

export const localDateKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const timeOf = (value: string | null | undefined) => {
  const match = /T(\d{2}):(\d{2})/.exec(value ?? '');
  return match ? `${match[1]}:${match[2]}` : '';
};

export const isClockTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export const combineDateTime = (dateKey: string, clock: string) => `${dateKey}T${clock}:00`;

const minutesOf = (value: string) => {
  const match = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const day = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return day / 60000 + Number(match[4]) * 60 + Number(match[5]);
};

export const entryMinutes = (entry: Pick<TimeEntry, 'StartTime' | 'EndTime' | 'UnpaidBreakMinutes'>) => {
  const start = minutesOf(entry.StartTime);
  const end = minutesOf(entry.EndTime);
  if (start == null || end == null || end < start) return 0;
  return Math.max(0, end - start - (entry.UnpaidBreakMinutes || 0));
};

export const entryHours = (entry: Pick<TimeEntry, 'StartTime' | 'EndTime' | 'UnpaidBreakMinutes'>) => Math.round((entryMinutes(entry) / 60) * 100) / 100;

export const sumHours = (entries: TimeEntry[]) => Math.round(entries.reduce((total, entry) => total + entryMinutes(entry), 0) / 0.6) / 100;

export const subjectKey = (entry: TimeEntry) => `${entry.SubjectType}:${entry.DeploymentPersonnelId ?? entry.DeploymentUnitId ?? entry.DeploymentEquipmentId ?? ''}`;

export interface EntryIssue {
  code: 'missing_subject' | 'missing_time' | 'end_before_start' | 'overlap';
  index: number;
}

export const validateEntries = (entries: TimeEntry[]): EntryIssue[] => {
  const issues: EntryIssue[] = [];
  const seen: { key: string; start: number; end: number; index: number }[] = [];
  entries.forEach((entry, index) => {
    const subject = entry.DeploymentPersonnelId || entry.DeploymentUnitId || entry.DeploymentEquipmentId;
    if (!subject) issues.push({ code: 'missing_subject', index });
    const start = minutesOf(entry.StartTime);
    const end = minutesOf(entry.EndTime);
    if (start == null || end == null) {
      issues.push({ code: 'missing_time', index });
      return;
    }
    if (end <= start) {
      issues.push({ code: 'end_before_start', index });
      return;
    }
    const key = subjectKey(entry);
    if (seen.some((other) => other.key === key && other.start < end && start < other.end)) issues.push({ code: 'overlap', index });
    seen.push({ key, start, end, index });
  });
  return issues;
};

export interface EntrySubject {
  type: number;
  id: string;
  label: string;
}

export const newEntry = (subject: EntrySubject, dateKey: string, sortOrder: number): TimeEntry => ({
  Id: null,
  SubjectType: subject.type,
  DeploymentPersonnelId: subject.type === TimeSubjectType.Personnel ? subject.id : null,
  DeploymentUnitId: subject.type === TimeSubjectType.Unit ? subject.id : null,
  DeploymentEquipmentId: subject.type === TimeSubjectType.Equipment ? subject.id : null,
  EntryType: TimeEntryType.Deployment,
  StartTime: combineDateTime(dateKey, '08:00'),
  EndTime: combineDateTime(dateKey, '18:00'),
  PaidBreakMinutes: 0,
  UnpaidBreakMinutes: 0,
  CrewSizeSnapshot: null,
  CertificationCode: null,
  MileageKm: null,
  FuelDeductionLitres: null,
  AgencySuppliedMeals: false,
  AgencySuppliedAccommodation: false,
  Notes: null,
  SortOrder: sortOrder,
});

export interface RosterScope {
  userId: string | null;
  activeUnitId: string | null;
  manager: boolean;
}

const named = (name: string, callSign?: string | null) => (callSign ? `${name} (${callSign})` : name);

// Who a person may write time for. A manager sees the whole roster; a crew member on an active unit
// sees that unit, its crew and its equipment; anyone else only their own roster row. The server
// enforces the same rule, this only keeps the picker honest.
export const rosterSubjects = (deployment: Deployment, scope: RosterScope): EntrySubject[] => {
  const units = deployment.Units.filter((unit) => unit.IsActive);
  const personnel = deployment.Personnel.filter((person) => person.IsActive);
  const equipment = deployment.Equipment.filter((item) => item.IsActive);
  const people = (rows: typeof personnel) => rows.map((person) => ({ type: TimeSubjectType.Personnel, id: person.Id, label: named(person.Name, person.CallSign) }));
  const vehicles = (rows: typeof units) => rows.map((unit) => ({ type: TimeSubjectType.Unit, id: unit.Id, label: named(unit.UnitName, unit.CallSign) }));
  const gear = (rows: typeof equipment) => rows.map((item) => ({ type: TimeSubjectType.Equipment, id: item.Id, label: item.Name }));
  if (scope.manager) return [...people(personnel), ...vehicles(units), ...gear(equipment)];
  if (scope.activeUnitId) {
    const mine = units.filter((unit) => String(unit.UnitId) === scope.activeUnitId);
    if (mine.length > 0) {
      const ids = new Set(mine.map((unit) => unit.Id));
      return [
        ...people(personnel.filter((person) => !!person.DeploymentUnitId && ids.has(person.DeploymentUnitId))),
        ...vehicles(mine),
        ...gear(equipment.filter((item) => !!item.DeploymentUnitId && ids.has(item.DeploymentUnitId))),
      ];
    }
  }
  return people(personnel.filter((person) => person.UserId === scope.userId));
};

export const subjectLabel = (entry: TimeEntry, subjects: EntrySubject[]) => {
  const id = entry.DeploymentPersonnelId ?? entry.DeploymentUnitId ?? entry.DeploymentEquipmentId ?? '';
  return subjects.find((subject) => subject.type === entry.SubjectType && subject.id === id)?.label ?? '';
};

// A report's date arrives as a date-time; match on the calendar day only.
export const reportForDate = (reports: TimeReport[], dateKey: string) => reports.find((report) => (report.ReportDate ?? '').slice(0, 10) === dateKey) ?? null;

export const isReportEditable = (report: TimeReport | null) => !!report && report.Status === 0;

export const operationsError = (error: unknown): string => {
  const response = (error as { response?: { status?: number; headers?: Record<string, string>; data?: { type?: string } } })?.response;
  const reason = String(response?.headers?.['x-resgrid-reason'] ?? '');
  if (response?.data?.type === 'protected_data_required') return 'locked';
  if (reason.endsWith('_disabled')) return 'disabled';
  if (response?.status === 401 || response?.status === 403 || response?.status === 404) return 'denied';
  if (response?.status === 400) return reason || 'validation';
  if (error instanceof Error && ['denied', 'disabled', 'locked', 'validation'].includes(error.message)) return error.message;
  return 'retry';
};
