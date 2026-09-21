// Field operations (Workforce & Business Operations plan, Phase C): deployments, daily time reports (DTR),
// resource usage readings and the CAL OES MARS F-42 hand-off. Shapes mirror the v4 Deployments,
// TimeReports, FieldCost and CalOesMars controllers. Money, rates and people never come through
// here beyond what the roster already shows; cost runs stay aggregate-only (decision 33).

export interface OperationsResult<T> {
  Data: T;
  Status: string;
  PageSize: number;
}

export const DeploymentStatus = { Planned: 0, Standby: 1, Active: 2, Demobilizing: 3, Completed: 4, Cancelled: 5 } as const;
export const DeploymentFinanceMode = { OperationalOnly: 0, CostRecovery: 1, Billable: 2 } as const;
export const TimeReportStatus = { Draft: 0, Submitted: 1, Approved: 2, Billed: 3, Void: 4 } as const;
export const TimeSubjectType = { Personnel: 0, Unit: 1, Equipment: 2 } as const;
export const TimeEntryType = { Deployment: 0, Standby: 1, Travel: 2 } as const;
export const UsagePhase = { Mobilization: 0, Standby: 1, Incident: 2, Return: 3 } as const;

export interface DeploymentAccess {
  Enabled: boolean;
  CanManage: boolean;
  CanApproveTimeReports: boolean;
  ContractorBilling: boolean;
}

export interface DeploymentUnit {
  Id: string;
  UnitId: number;
  UnitName: string;
  CallSign?: string | null;
  IsActive: boolean;
}

export interface DeploymentPersonnel {
  Id: string;
  UserId: string;
  Name: string;
  DeploymentUnitId?: string | null;
  CertificationCode?: string | null;
  CallSign?: string | null;
  IsActive: boolean;
}

export interface DeploymentEquipment {
  Id: string;
  DeploymentUnitId?: string | null;
  Name: string;
  IsActive: boolean;
}

export interface Deployment {
  Id: string;
  Name: string;
  Status: number;
  FinanceMode: number;
  CallId?: number | null;
  IncidentNumber?: string | null;
  ResourceOrderNumber?: string | null;
  RequestNumber?: string | null;
  CostCode?: string | null;
  PointOfHire?: string | null;
  StartOn?: string | null;
  EndOn?: string | null;
  LocalTimeZoneId?: string | null;
  Currency?: string | null;
  Units: DeploymentUnit[];
  Personnel: DeploymentPersonnel[];
  Equipment: DeploymentEquipment[];
}

export interface TimeEntry {
  Id?: string | null;
  SubjectType: number;
  DeploymentPersonnelId?: string | null;
  DeploymentUnitId?: string | null;
  DeploymentEquipmentId?: string | null;
  EntryType: number;
  StartTime: string;
  EndTime: string;
  PaidBreakMinutes: number;
  UnpaidBreakMinutes: number;
  CrewSizeSnapshot?: number | null;
  CertificationCode?: string | null;
  MileageKm?: number | null;
  FuelDeductionLitres?: number | null;
  AgencySuppliedMeals: boolean;
  AgencySuppliedAccommodation: boolean;
  Notes?: string | null;
  SortOrder: number;
  Hours?: number;
}

export interface TimeReport {
  Id: string;
  DeploymentId: string;
  ReportNumber: number;
  ReportDate: string;
  Status: number;
  IncidentNumber?: string | null;
  RequestNumber?: string | null;
  SubmittedOn?: string | null;
  ApprovedOn?: string | null;
  Notes?: string | null;
  Entries: TimeEntry[];
}

export interface TimeReportIssue {
  Code: string;
  SubjectId?: string | null;
  EntryId?: string | null;
  Detail?: string | null;
}

/** A time report action answers with the report plus the server's own validation issues. */
export interface TimeReportResponse extends OperationsResult<TimeReport> {
  Errors?: TimeReportIssue[];
  Warnings?: TimeReportIssue[];
}

export interface FieldCostAccess {
  Enabled: boolean;
  CanViewInternalCosts: boolean;
  CanRecordUsage: boolean;
}

export interface ResourceUsage {
  Id: string;
  DeploymentId?: string | null;
  CallId?: number | null;
  UnitId: number;
  UsageDate: string;
  Phase: number;
  DistanceUnit?: string | null;
  OriginalDistance?: number | null;
  EngineHours?: number | null;
  OperatingHours?: number | null;
  FuelQuantity?: number | null;
  FuelUnit?: string | null;
  Source: number;
  NeedsReview: boolean;
  ReviewReason?: string | null;
}

export interface ResourceUsageInput {
  DeploymentId?: string | null;
  CallId?: number | null;
  UnitId: number;
  UsageDate: string;
  Phase: number;
  StartOdometer?: number | null;
  EndOdometer?: number | null;
  DistanceUnit?: string | null;
  Distance?: number | null;
  StartEngineMeter?: number | null;
  EndEngineMeter?: number | null;
  EngineHours?: number | null;
  OperatingHours?: number | null;
  IdleHours?: number | null;
  FuelQuantity?: number | null;
  FuelUnit?: string | null;
}

export interface CalOesMarsAccess {
  Enabled: boolean;
  CanView: boolean;
  CanManage: boolean;
  CanSubmit: boolean;
  AuthorityProfileCode?: string | null;
  PortalUrl?: string | null;
}

export interface CalOesMarsIssue {
  Box?: string | null;
  Code: string;
  Detail?: string | null;
}

export interface CalOesMarsValidation {
  WorkItemId: string;
  ValidatedOn: string;
  Errors: CalOesMarsIssue[];
  Warnings: CalOesMarsIssue[];
  IsReadyForPortal: boolean;
}

export interface CalOesMarsQueueItem {
  Id: string;
  DeploymentId: string;
  DeploymentName?: string | null;
  RecordType: number;
  RecordTypeName?: string | null;
  LocalState: number;
  LocalStateName?: string | null;
  IncidentNumber?: string | null;
  RequestNumber?: string | null;
  MarsRecordId?: string | null;
  ObservedExternalStatus?: string | null;
  ErrorCount: number;
  WarningCount: number;
  IsMine: boolean;
  UpdatedOn?: string | null;
}

export interface CalOesMarsWorkItem extends CalOesMarsQueueItem {
  IsLocallyEditable: boolean;
  IsExternal: boolean;
  Validation?: CalOesMarsValidation | null;
  RowVersion: number;
}
