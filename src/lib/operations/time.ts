import type { Deployment, TimeEntry, TimeReport } from '@/models/v4/operations';
import { TimeEntryType, TimeReportScope, TimeReportStatus, TimeSubjectType } from '@/models/v4/operations';

// Pure helpers behind the crew / individual time report editor. Entry times are the department-local wall
// clock the crew writes on a paper time report ("yyyy-MM-ddTHH:mm", StartLocal/EndLocal); the server does
// the zone conversion, so nothing here touches UTC or the device's time zone.

const pad = (n: number) => String(n).padStart(2, '0');

export const localDateKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const shiftDateKey = (dateKey: string, days: number) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return localDateKey(new Date(y, m - 1, d + days));
};

export const timeOf = (value: string | null | undefined) => {
  const match = /T(\d{2}):(\d{2})/.exec(value ?? '');
  return match ? `${match[1]}:${match[2]}` : '';
};

export const dateOf = (value: string | null | undefined) => /^(\d{4}-\d{2}-\d{2})/.exec(value ?? '')?.[1] ?? '';

export const isClockTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export const combineDateTime = (dateKey: string, clock: string) => `${dateKey}T${clock}`;

const minutesOf = (value: string | null | undefined) => {
  const match = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value ?? '');
  if (!match) return null;
  const day = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return day / 60000 + Number(match[4]) * 60 + Number(match[5]);
};

/** An end clock at or before the start clock is the next morning (a shift across midnight). */
export const endLocalFor = (startLocal: string, clock: string) => {
  const day = dateOf(startLocal);
  return clock <= timeOf(startLocal) ? combineDateTime(shiftDateKey(day, 1), clock) : combineDateTime(day, clock);
};

export const entryMinutes = (entry: Pick<TimeEntry, 'StartLocal' | 'EndLocal' | 'UnpaidBreakMinutes'>) => {
  const start = minutesOf(entry.StartLocal);
  const end = minutesOf(entry.EndLocal);
  if (start == null || end == null || end < start) return 0;
  return Math.max(0, end - start - (entry.UnpaidBreakMinutes || 0));
};

export const entryHours = (entry: Pick<TimeEntry, 'StartLocal' | 'EndLocal' | 'UnpaidBreakMinutes'>) => Math.round((entryMinutes(entry) / 60) * 100) / 100;

export const sumHours = (entries: TimeEntry[]) => Math.round(entries.reduce((total, entry) => total + entryMinutes(entry), 0) / 0.6) / 100;

export const subjectIdOf = (entry: Pick<TimeEntry, 'DeploymentPersonnelId' | 'DeploymentUnitId' | 'DeploymentEquipmentId'>) => entry.DeploymentPersonnelId ?? entry.DeploymentUnitId ?? entry.DeploymentEquipmentId ?? '';

export const subjectKey = (entry: TimeEntry) => `${entry.SubjectType}:${subjectIdOf(entry)}`;

export interface EntryIssue {
  code: 'missing_subject' | 'missing_time' | 'end_before_start' | 'overlap';
  index: number;
}

export const validateEntries = (entries: TimeEntry[]): EntryIssue[] => {
  const issues: EntryIssue[] = [];
  const seen: { key: string; start: number; end: number; index: number }[] = [];
  entries.forEach((entry, index) => {
    if (!subjectIdOf(entry)) issues.push({ code: 'missing_subject', index });
    const start = minutesOf(entry.StartLocal);
    const end = minutesOf(entry.EndLocal);
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

export const newEntry = (subject: EntrySubject, dateKey: string, sortOrder: number, template?: Partial<TimeEntry>): TimeEntry => ({
  Id: null,
  SubjectType: subject.type,
  DeploymentPersonnelId: subject.type === TimeSubjectType.Personnel ? subject.id : null,
  DeploymentUnitId: subject.type === TimeSubjectType.Unit ? subject.id : null,
  DeploymentEquipmentId: subject.type === TimeSubjectType.Equipment ? subject.id : null,
  EntryType: template?.EntryType ?? TimeEntryType.Deployment,
  StartLocal: template?.StartLocal ?? combineDateTime(dateKey, '08:00'),
  EndLocal: template?.EndLocal ?? combineDateTime(dateKey, '18:00'),
  PaidBreakMinutes: template?.PaidBreakMinutes ?? 0,
  UnpaidBreakMinutes: template?.UnpaidBreakMinutes ?? 0,
  CrewSizeSnapshot: null,
  CertificationCode: null,
  MileageKm: null,
  FuelDeductionLitres: null,
  AgencySuppliedMeals: template?.AgencySuppliedMeals ?? false,
  AgencySuppliedAccommodation: template?.AgencySuppliedAccommodation ?? false,
  Notes: null,
  SortOrder: sortOrder,
});

// ---------------------------------------------------------------------------------------------------
// Report scopes. A deployed unit files one Crew Time Report a day for the unit, its crew and its
// equipment; a single resource files an individual report; a manager may keep the deployment-wide DTR.
// ---------------------------------------------------------------------------------------------------

export type TimeScope = { kind: 'crew'; unitId: string } | { kind: 'individual'; personnelId: string } | { kind: 'deployment' };

export const scopeKey = (scope: TimeScope | null | undefined) => (!scope ? '' : scope.kind === 'crew' ? `crew:${scope.unitId}` : scope.kind === 'individual' ? `person:${scope.personnelId}` : 'deployment');

export const reportScope = (report: Pick<TimeReport, 'Scope' | 'DeploymentUnitId' | 'DeploymentPersonnelId'>): TimeScope =>
  report.Scope === TimeReportScope.Crew && report.DeploymentUnitId
    ? { kind: 'crew', unitId: report.DeploymentUnitId }
    : report.Scope === TimeReportScope.Individual && report.DeploymentPersonnelId
      ? { kind: 'individual', personnelId: report.DeploymentPersonnelId }
      : { kind: 'deployment' };

// A report's date arrives as a date-time; match on the calendar day only.
export const reportsOnDate = (reports: TimeReport[], dateKey: string) => reports.filter((report) => dateOf(report.ReportDate) === dateKey && report.Status !== TimeReportStatus.Void);

export const reportForScope = (reports: TimeReport[], dateKey: string, scope: TimeScope | null) =>
  scope ? (reportsOnDate(reports, dateKey).find((report) => scopeKey(reportScope(report)) === scopeKey(scope)) ?? null) : null;

/** The report that already carries this subject's time today, if it is not the one being edited. */
export const coveringReport = (reports: TimeReport[], dateKey: string, subjectId: string, exceptReportId?: string | null) =>
  reportsOnDate(reports, dateKey).find((report) => report.Id !== exceptReportId && report.Entries.some((entry) => subjectIdOf(entry) === subjectId)) ?? null;

/** The scopes this person may open, straight from the server's TimeAccess (never inferred on the device). */
export const availableScopes = (deployment: Deployment): TimeScope[] => {
  const access = deployment.TimeAccess;
  if (!access) return [];
  const activeUnits = new Set(deployment.Units.filter((unit) => unit.IsActive).map((unit) => unit.Id));
  const scopes: TimeScope[] = [];
  const crewUnits = access.CanManage ? deployment.Units.filter((unit) => unit.IsActive).map((unit) => unit.Id) : access.CrewUnitIds.filter((id) => activeUnits.has(id));
  crewUnits.forEach((unitId) => scopes.push({ kind: 'crew', unitId }));
  if (access.PersonnelId) scopes.push({ kind: 'individual', personnelId: access.PersonnelId });
  if (access.CanManage) scopes.push({ kind: 'deployment' });
  return scopes;
};

/**
 * The scope a screen opens on: the active unit's crew report on the unit tablet; otherwise the crew the person
 * is seated on (the crew boss files the CTR); otherwise their own report; otherwise a manager's first scope.
 */
export const defaultScope = (deployment: Deployment, activeUnitId: string | null): TimeScope | null => {
  const scopes = availableScopes(deployment);
  if (activeUnitId) {
    const unit = deployment.Units.find((candidate) => candidate.IsActive && String(candidate.UnitId) === activeUnitId);
    const crew = unit ? scopes.find((scope) => scope.kind === 'crew' && scope.unitId === unit.Id) : undefined;
    if (crew) return crew;
  }
  const own = deployment.TimeAccess?.PersonnelId ? deployment.Personnel.find((person) => person.Id === deployment.TimeAccess?.PersonnelId) : undefined;
  const ownCrew = own?.DeploymentUnitId ? scopes.find((scope) => scope.kind === 'crew' && scope.unitId === own.DeploymentUnitId) : undefined;
  if (ownCrew) return ownCrew;
  if (!deployment.TimeAccess?.CanManage) {
    const seated = scopes.find((scope) => scope.kind === 'crew');
    if (seated) return seated;
  }
  return scopes.find((scope) => scope.kind === 'individual') ?? scopes[0] ?? null;
};

const named = (name: string, callSign?: string | null) => (callSign ? `${name} (${callSign})` : name);

export const canWriteSubject = (deployment: Deployment, subjectId: string) => !!deployment.TimeAccess?.CanManage || (deployment.TimeAccess?.WritableSubjectIds ?? []).includes(subjectId);

/** Who or what a report in this scope may carry that the person may write: the picker for new rows. */
export const scopeSubjects = (deployment: Deployment, scope: TimeScope | null): EntrySubject[] => {
  if (!scope) return [];
  const inUnit = (unitId?: string | null) => scope.kind === 'deployment' || (scope.kind === 'crew' && unitId === scope.unitId);
  const people = deployment.Personnel.filter((person) => person.IsActive && (scope.kind === 'individual' ? person.Id === scope.personnelId : inUnit(person.DeploymentUnitId)));
  const units = scope.kind === 'individual' ? [] : deployment.Units.filter((unit) => unit.IsActive && inUnit(unit.Id));
  const equipment = scope.kind === 'individual' ? [] : deployment.Equipment.filter((item) => item.IsActive && inUnit(item.DeploymentUnitId));
  return [
    ...units.map((unit) => ({ type: TimeSubjectType.Unit, id: unit.Id, label: named(unit.UnitName, unit.CallSign) })),
    ...people.map((person) => ({ type: TimeSubjectType.Personnel, id: person.Id, label: named(person.Name, person.CallSign) })),
    ...equipment.map((item) => ({ type: TimeSubjectType.Equipment, id: item.Id, label: item.Name })),
  ].filter((subject) => canWriteSubject(deployment, subject.id));
};

/** Every roster name by subject id (active or since released), so a stored row always has a label. */
export const subjectNames = (deployment: Deployment) => {
  const names: Record<string, string> = {};
  deployment.Units.forEach((unit) => (names[unit.Id] = named(unit.UnitName, unit.CallSign)));
  deployment.Personnel.forEach((person) => (names[person.Id] = named(person.Name, person.CallSign)));
  deployment.Equipment.forEach((item) => (names[item.Id] = item.Name));
  return names;
};

export const scopeName = (deployment: Deployment, scope: TimeScope | null) => {
  if (!scope || scope.kind === 'deployment') return '';
  return subjectNames(deployment)[scope.kind === 'crew' ? scope.unitId : scope.personnelId] ?? '';
};

/**
 * The CTR shortcut: most crews work the unit's shift together, so copy one row's times, breaks and agency
 * supplies onto every other row of the same entry type the person may write. Rows that differ are then
 * edited one by one.
 */
export const applyToCrew = (entries: TimeEntry[], sourceIndex: number, writable: (subjectId: string) => boolean): TimeEntry[] => {
  const source = entries[sourceIndex];
  if (!source) return entries;
  return entries.map((entry, index) =>
    index === sourceIndex || entry.EntryType !== source.EntryType || !writable(subjectIdOf(entry))
      ? entry
      : {
          ...entry,
          StartLocal: source.StartLocal,
          EndLocal: source.EndLocal,
          PaidBreakMinutes: source.PaidBreakMinutes,
          UnpaidBreakMinutes: source.UnpaidBreakMinutes,
          AgencySuppliedMeals: source.AgencySuppliedMeals,
          AgencySuppliedAccommodation: source.AgencySuppliedAccommodation,
        }
  );
};

/** Hours per subject for the report summary (the crew boss's check before signing). */
export const hoursBySubject = (entries: TimeEntry[]) =>
  entries.reduce<Record<string, number>>((totals, entry) => {
    const id = subjectIdOf(entry);
    totals[id] = Math.round(((totals[id] ?? 0) + entryHours(entry)) * 100) / 100;
    return totals;
  }, {});

export const isReportEditable = (report: TimeReport | null) => !!report && report.Status === TimeReportStatus.Draft && report.CanAct;

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
