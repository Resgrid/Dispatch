import { BaseV4Request } from '../baseV4Request';

/**
 * Calls awaiting resources (conditional run cards). Mirrors `Resgrid.Model.Services.AwaitingResourcesCall` and the
 * AwaitingResources v4 models. Field names match the API payload exactly (PascalCase).
 *
 * "Awaiting resources" is a call that went out without a required resource marked "keep outstanding" (a substitute went
 * instead, or nothing could be sent). Not to be confused with Pending calls, which have not been dispatched at all.
 */

/** A unit available now that would satisfy a requirement, nearest first when the server could measure it. */
export interface AwaitingCandidateUnitData {
  UnitId: number;
  UnitName: string;
  UnitTypeName: string | null;
  /** Estimated response (turnout plus travel) to the call; null when it could not be measured. */
  ResponseSeconds: number | null;
}

export interface AwaitingResourceRequirementData {
  CallOutstandingRequirementId: number;
  /** What is awaited, as dispatchers read it ("MUG", "Ladder or Quint"). */
  Label: string;
  RequiredCount: number;
  ResolvedCount: number;
  /** What was sent in its place ("PIT P-21"); null when nothing could be sent. */
  SentInstead: string | null;
  /** Response code the row asks for ("C3"); null when none. */
  ResponseCode: string | null;
  /** The code's catalog id and colour (newer servers); null when the department no longer has the code. */
  ResponseCodeId?: number | null;
  ResponseCodeColor?: string | null;
  CreatedOn: string;
  AvailableUnits: AwaitingCandidateUnitData[];
}

export interface AwaitingResourcesCallData {
  CallId: number;
  CallNumber: string | null;
  CallName: string | null;
  Priority: number;
  PriorityName: string | null;
  PriorityColor: string | null;
  Address: string | null;
  LoggedOn: string;
  Requirements: AwaitingResourceRequirementData[];
}

/** Response of `/AwaitingResources/GetAwaitingCalls`, highest priority then oldest first. */
export class AwaitingResourcesResult extends BaseV4Request {
  /** False when the department does not have conditional run cards; Data is then empty. */
  public Enabled: boolean = false;
  public Data: AwaitingResourcesCallData[] = [];
}

/** Mirrors `OutstandingRequirementResolutions`: how an outstanding requirement was cleared. */
export enum OutstandingRequirementResolution {
  Open = 0,
  Dispatched = 1,
  AutoDispatched = 2,
  CallClosed = 3,
  Dismissed = 4,
}

/** Mirrors `Resgrid.Model.CallOutstandingRequirement`. */
export interface CallOutstandingRequirementData {
  CallOutstandingRequirementId: number;
  DepartmentId: number;
  CallId: number;
  Label: string;
  /** Snapshot of the row's targets (JSON); not read by the app. */
  TargetsJson: string | null;
  RequiredCount: number;
  ResolvedCount: number;
  StatusFilter: number;
  ResponseCodeId: number | null;
  ResponseCode: string | null;
  RunCardId: number | null;
  AlarmLevel: number;
  SentInstead: string | null;
  CreatedOn: string;
  CreatedByUserId: string | null;
  ResolvedOn: string | null;
  Resolution: OutstandingRequirementResolution;
  ResolutionNote: string | null;
}

/** Response of `/AwaitingResources/GetCallRequirements`: the call's open requirements. */
export class CallOutstandingRequirementsResult extends BaseV4Request {
  public Data: CallOutstandingRequirementData[] = [];
}

/** Response of `/AwaitingResources/DismissRequirement` and `/AwaitingResources/DispatchUnit`. */
export class AwaitingResourcesActionResult extends BaseV4Request {
  public Success: boolean = false;
  /** Plain-English outcome for the dispatcher. */
  public Message: string | null = null;
  /** How many requirements the dispatch resolved. */
  public Resolved: number = 0;
}

/** Mirrors `DispatchResponseCode`: one entry of the department's response code catalog. */
export interface DispatchResponseCodeData {
  /** Stable id within the department's catalog. */
  Id: number;
  /** Short code shown on badges ("C3"). */
  Code: string;
  Name: string | null;
  Description: string | null;
  /** Badge colour (hex), optional. */
  Color: string | null;
  SortOrder: number;
  /** Retired codes stay readable on history but cannot be picked. */
  Retired: boolean;
}

/** Mirrors `DispatchResponseCodesConfig`. Empty Codes means the department uses none: the feature is then invisible. */
export interface DispatchResponseCodesConfigData {
  Codes: DispatchResponseCodeData[];
  /** Codes ride unit dispatches to crews (push title, field apps) only when this is on. */
  ShowToCrews: boolean;
}

/** Response of `/AwaitingResources/GetResponseCodes`. */
export class ResponseCodesResult extends BaseV4Request {
  public Data: DispatchResponseCodesConfigData = { Codes: [], ShowToCrews: false };
}

/** Mirrors `OutstandingRequirementsAlertKinds`. */
export enum OutstandingRequirementsAlertKind {
  /** Requirements were created, resolved or dismissed; refresh the awaiting-resources views. */
  Changed = 0,
  /** A unit became available that matches calls awaiting resources. */
  UnitAvailable = 1,
  /** A freed unit was dispatched automatically to a call awaiting it. */
  AutoDispatched = 2,
}

/** One waiting call in an `outstandingRequirementsUpdated` payload (camel-cased JSON, unlike the REST models). */
export interface OutstandingRequirementsAlertCall {
  callId: number;
  callNumber: string | null;
  callName: string | null;
  priority: number;
  label: string | null;
  /** The freed unit's estimated response to this call, when it could be measured. */
  responseSeconds: number | null;
  ageMinutes: number;
}

/** The `outstandingRequirementsUpdated` eventing payload (`OutstandingRequirementsAlert`, camel-cased). */
export interface OutstandingRequirementsAlert {
  kind: OutstandingRequirementsAlertKind;
  unitId: number | null;
  unitName: string | null;
  unitTypeName: string | null;
  /** Plain-English summary ("M-1 available: 2 calls waiting for a MUG"). */
  message: string | null;
  calls: OutstandingRequirementsAlertCall[];
}
