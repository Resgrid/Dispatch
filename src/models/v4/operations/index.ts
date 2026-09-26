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
/** Who a daily time report covers: the whole deployment (manager's DTR), one unit's crew (CTR) or one person. */
export const TimeReportScope = { Deployment: 0, Crew: 1, Individual: 2 } as const;
export const ExpenseType = { PerDiemMeal: 0, Accommodation: 1, PrivateAccommodation: 2, Ferry: 3, Fuel: 4, SupplyRestock: 5, Other: 6 } as const;
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
  /** The caller's time scope, computed by the server (detail reads only). */
  TimeAccess?: DeploymentTimeAccess | null;
}

/**
 * What the signed-in person may do with this deployment's time: their own roster row (individual report),
 * the deployed units they crew — on the deployment roster for that unit, or seated on the apparatus through
 * an active unit role — (crew time report) and every subject id they may write. The server re-checks it all.
 */
export interface DeploymentTimeAccess {
  CanManage: boolean;
  CanApprove: boolean;
  PersonnelId?: string | null;
  CrewUnitIds: string[];
  WritableSubjectIds: string[];
  TimeZone?: string | null;
}

export interface TimeEntry {
  Id?: string | null;
  SubjectType: number;
  DeploymentPersonnelId?: string | null;
  DeploymentUnitId?: string | null;
  DeploymentEquipmentId?: string | null;
  EntryType: number;
  /** UTC instant from the server; the field apps read and write the local wall clock below. */
  StartTime?: string | null;
  EndTime?: string | null;
  /** Department-local wall clock "yyyy-MM-ddTHH:mm"; the server converts it in the department's zone. */
  StartLocal: string;
  EndLocal: string;
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
  /** TimeReportScope value. */
  Scope: number;
  DeploymentUnitId?: string | null;
  DeploymentPersonnelId?: string | null;
  /** The caller may write, sign and submit this report (its scope is theirs). */
  CanAct: boolean;
  Status: number;
  IncidentNumber?: string | null;
  ResourceOrderNumber?: string | null;
  RequestNumber?: string | null;
  NoClear8?: boolean;
  UnsafeConditionsStandDown?: boolean;
  ContractorSignedByUserId?: string | null;
  ContractorSignedOn?: string | null;
  CustomerSignerName?: string | null;
  CustomerSignedOn?: string | null;
  SubmittedByUserId?: string | null;
  SubmittedOn?: string | null;
  ApprovedByUserId?: string | null;
  ApprovedOn?: string | null;
  Notes?: string | null;
  Entries: TimeEntry[];
}

export interface Expense {
  Id: string;
  DeploymentId: string;
  TimeReportId?: string | null;
  ExpenseDate: string;
  ExpenseType: number;
  MealCode?: string | null;
  City?: string | null;
  Description?: string | null;
  Amount: number;
  Currency?: string | null;
  PreApproved: boolean;
  Billable: boolean;
  ReceiptAttachmentId?: number | null;
  AddedByUserId?: string | null;
  AddedOn?: string | null;
}

export interface ExpenseInput {
  Id?: string | null;
  DeploymentId: string;
  TimeReportId?: string | null;
  ExpenseDate: string;
  ExpenseType: number;
  City?: string | null;
  Description?: string | null;
  Amount: number;
  Currency?: string | null;
  /** Receipt photo, base64 (the server files it as a Receipt attachment). */
  ReceiptData?: string | null;
  ReceiptFileName?: string | null;
  ReceiptContentType?: string | null;
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
