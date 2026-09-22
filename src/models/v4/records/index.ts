// Field Records contracts (RMS plan RMS-1D). Mirrors Resgrid.Model FieldRecordCatalogV1 and the v4
// FieldRecords / Records controllers. Every filter below is applied server-side from the authenticated
// principal: sending a different origin, context or capability can only narrow what comes back.

/** Resgrid.Model.RmsOriginClient. */
export enum RmsOriginClient {
  System = 0,
  Web = 1,
  Responder = 2,
  Unit = 3,
  IncidentCommand = 4,
  Dispatch = 5,
  Api = 6,
}

/** Resgrid.Model.RmsRecordState. */
export enum RmsRecordState {
  Draft = 1,
  ReadyForReview = 2,
  Returned = 3,
  Finalized = 4,
  Amended = 5,
  Voided = 6,
  Cancelled = 7,
}

/** Resgrid.Model.RmsFieldType. A control this client cannot render fails closed for authoring. */
export enum RmsFieldType {
  ShortText = 1,
  LongText = 2,
  Integer = 3,
  Decimal = 4,
  Boolean = 5,
  Date = 6,
  DateTime = 7,
  Duration = 8,
  SingleSelect = 9,
  MultiSelect = 10,
  Address = 11,
  Person = 12,
  Unit = 13,
  Group = 14,
  Contact = 15,
  Attachment = 16,
  Signature = 17,
  ExternalReference = 18,
  Currency = 19,
  Quantity = 20,
  CountrySubdivision = 21,
  CallReference = 22,
}

/** Resgrid.Model.RmsFieldClassification. */
export enum RmsFieldClassification {
  Standard = 1,
  Restricted = 2,
  Protected = 3,
}

/** Resgrid.Model.RmsRuleEffect. */
export enum RmsRuleEffect {
  Show = 1,
  Require = 2,
}

/** Resgrid.Model.RmsRuleOperator. */
export enum RmsRuleOperator {
  Equals = 1,
  NotEquals = 2,
  InSet = 3,
  NotInSet = 4,
  IsEmpty = 5,
  IsNotEmpty = 6,
  InRange = 7,
  And = 20,
  Or = 21,
}

/** Renderer capability this build reports. Bump only when every control of the next tier renders. */
export const RecordsClientCapabilities = {
  Locked: 'records.v1',
  Configurable: 'records.v1b',
  Packs: 'records.v1c',
} as const;

export const FieldRecordContractVersion = 'field-catalog.v1';
export const FieldRecordSyncContractVersion = 'field-sync.v1';

/** Launch contexts a definition surface may name. */
export const FieldRecordLaunchContexts = {
  None: 'none',
  Call: 'call',
  Unit: 'unit',
  Contact: 'contact',
  Checklist: 'checklist',
  WorkOrder: 'workorder',
  Command: 'command',
} as const;

/** Why the server withheld a definition. Codes only — never a reason a client can act around. */
export const FieldRecordExclusionReasons = {
  OriginNotField: 'origin_not_field',
  ModuleDisabled: 'module_disabled',
  RecordsNotUsable: 'records_not_usable',
  AppDisabled: 'app_disabled',
  AppVersionTooOld: 'app_version_too_old',
  NotMember: 'not_member',
  SurfaceNotEnabled: 'surface_not_enabled',
  ContextNotAllowed: 'context_not_allowed',
  ContextNotVerified: 'context_not_verified',
  CapabilityUnsupported: 'capability_unsupported',
  Retired: 'retired',
  NotPublished: 'not_published',
  ProtectedDataUnavailable: 'protected_data_unavailable',
} as const;

export interface FieldRecordContextInput {
  CallId?: number | null;
  UnitId?: number | null;
  GroupId?: number | null;
  CommandRole?: string | null;
  ContactId?: number | null;
}

export interface FieldRecordCatalogInput {
  OriginClient: number;
  AppVersion?: string | null;
  ClientCapability?: string | null;
  Context?: FieldRecordContextInput | null;
}

export interface FieldRecordPreflightData {
  ContractVersion: string;
  SyncContractVersion: string;
  OriginClient: string;
  Ok: boolean;
  Reasons: string[];
  ModuleEnabled: boolean;
  RecordsUsable: boolean;
  AppEnabled: boolean;
  MinimumAppVersion?: string | null;
  AppVersion?: string | null;
  ClientCapability?: string | null;
  ProtectionState?: string | null;
  ServerTimestampMs: number;
}

export interface FieldRecordCatalogEntry {
  DefinitionKey: string;
  Version: number;
  Name: string;
  Category?: string | null;
  Locked: boolean;
  RecordType?: number | null;
  LifecyclePreset?: string | null;
  LaunchContexts: string[];
  AllowOffline: boolean;
  AllowAttachments: boolean;
  MinimumAppVersion?: string | null;
  MinimumClientCapability?: string | null;
  Restricted: boolean;
  /** Definition seals values: authoring needs a live grant and nothing is cached offline. */
  RequiresProtectedGrant: boolean;
  SchemaChecksum?: string | null;
  PrefillVersion: number;
  SupportsPrefill: boolean;
}

export interface FieldRecordCatalogExclusion {
  DefinitionKey: string;
  Reason: string;
}

export interface FieldRecordCatalogData {
  ContractVersion: string;
  OriginClient: string;
  Ok: boolean;
  Reasons: string[];
  ContextKind?: string | null;
  ContextVerified: boolean;
  ProtectionState?: string | null;
  ScopeStamp?: string | null;
  Definitions: FieldRecordCatalogEntry[];
  Exclusions: FieldRecordCatalogExclusion[];
  ServerTimestampMs: number;
}

export interface FieldRecordPrefillValue {
  SectionKey?: string | null;
  FieldKey: string;
  Value?: string | null;
  ReferenceType?: string | null;
  ReferenceId?: string | null;
}

export interface FieldRecordPrefillProvenance {
  FieldKey: string;
  Source: string;
  SourceId?: string | null;
  CapturedOn: string;
}

export interface FieldRecordPrefillData {
  ContractVersion: string;
  DefinitionKey: string;
  Version: number;
  PrefillVersion: number;
  CallId?: number | null;
  UnitId?: number | null;
  StationGroupId?: number | null;
  Values: FieldRecordPrefillValue[];
  Provenance: FieldRecordPrefillProvenance[];
  SuggestedParticipantUserIds: string[];
  SuggestedUnitIds: number[];
  CalculatedOn: string;
}

export interface RecordSummaryData {
  RecordId: string;
  RecordKind?: string | null;
  RecordNumber?: string | null;
  DraftReference?: string | null;
  DefinitionKey?: string | null;
  DefinitionVersion: number;
  RecordType?: number | null;
  State: number;
  StateName?: string | null;
  OccurredOn?: string | null;
  CreatedOn: string;
  FinalizedOn?: string | null;
  ModifiedOn: string;
  StationGroupId?: number | null;
  CallId?: number | null;
  CallNumber?: string | null;
  AuthorUserId?: string | null;
  OwnerUserId?: string | null;
  ReviewerUserId?: string | null;
  DisplaySummary?: string | null;
  IsLegacy?: boolean;
  RowVersion: number;
  IsTombstone?: boolean;
  DeletedOn?: string | null;
}

export interface FieldRecordAssignmentData {
  AssignmentId: string;
  RecordId: string;
  AssigneeKind: string;
  AssigneeUserId?: string | null;
  AssigneeUnitId?: number | null;
  AssigneeGroupId?: number | null;
  AssigneeRole?: string | null;
  Purpose: string;
  Note?: string | null;
  DueOn?: string | null;
  State: string;
  AcknowledgedOn?: string | null;
  CompletedOn?: string | null;
  OriginClient?: string | null;
  CreatedOn: string;
  CreatedByUserId?: string | null;
  RowVersion: number;
}

export interface FieldRecordSyncData {
  ContractVersion: string;
  Ok: boolean;
  Reasons: string[];
  ScopeStamp?: string | null;
  ResetRequired: boolean;
  Since: number;
  ServerTimestampMs: number;
  ServerCursorId?: string | null;
  HasMore: boolean;
  Catalog?: FieldRecordCatalogData | null;
  Records: RecordSummaryData[];
  /** Record ids the caller may no longer read; evict any cached copy. */
  Tombstones: string[];
  Drafts: RecordSummaryData[];
  Assignments: FieldRecordAssignmentData[];
}

// ---------------------------------------------------------------------------
// Definition schema (RMS-1B). The renderer walks this; it never invents a field.
// ---------------------------------------------------------------------------

export interface RecordOptionSchema {
  Key: string;
  Label: string;
  IsInactive?: boolean;
}

export interface RecordConditionSchema {
  Operator: RmsRuleOperator;
  FieldKey?: string | null;
  Value?: string | null;
  Values?: string[] | null;
  Min?: number | null;
  Max?: number | null;
  Conditions?: RecordConditionSchema[] | null;
}

export interface RecordRuleSchema {
  Effect: RmsRuleEffect;
  Condition?: RecordConditionSchema | null;
}

export interface RecordFieldSchema {
  Key: string;
  Label: string;
  Help?: string | null;
  Type: RmsFieldType;
  Required?: boolean;
  RequiredToFinalize?: boolean;
  Classification: RmsFieldClassification;
  Options?: RecordOptionSchema[] | null;
  Rules?: RecordRuleSchema[] | null;
  MaxLength?: number | null;
  Min?: number | null;
  Max?: number | null;
  DefaultCurrency?: string | null;
  UnitDimension?: string | null;
  DefaultUnitCode?: string | null;
  ReferenceType?: string | null;
}

export interface RecordSectionSchema {
  Key: string;
  Label: string;
  Help?: string | null;
  Repeating?: boolean;
  MinRows?: number | null;
  MaxRows?: number | null;
  Rules?: RecordRuleSchema[] | null;
  Fields: RecordFieldSchema[];
}

export interface RecordDefinitionSchema {
  Sections: RecordSectionSchema[];
}

export interface RecordDefinitionVersionData {
  DefinitionKey: string;
  Version: number;
  Name?: string | null;
  State?: number;
  LifecyclePreset?: number;
  MinimumClientCapability?: string | null;
  SchemaChecksum?: string | null;
  Schema?: RecordDefinitionSchema | null;
  ETag?: string | null;
}

/** One posted value. A repeating row groups its cells by RowKey. */
export interface RecordValueInput {
  SectionKey: string;
  FieldKey: string;
  RowKey?: string | null;
  Ordinal?: number;
  Value?: string | null;
  Values?: string[] | null;
  ReferenceType?: string | null;
  ReferenceId?: string | null;
  UnitCode?: string | null;
}

export interface RecordCreateDraftInput {
  DefinitionKey: string;
  CallId?: number | null;
  StationGroupId?: number | null;
  StartedOn?: string | null;
  Values?: RecordValueInput[];
  IdempotencyKey?: string | null;
  ClientRecordId?: string | null;
  OriginClient?: number | null;
}

export interface RecordSaveDraftInput {
  RecordId: string;
  RowVersion?: number | null;
  Values?: RecordValueInput[];
  IdempotencyKey?: string | null;
  OriginClient?: number | null;
}

export interface RecordCommandInput {
  RecordId: string;
  RowVersion?: number | null;
  IdempotencyKey?: string | null;
  ReasonCode?: string | null;
  ReasonText?: string | null;
  Attested?: boolean;
  AttestationStatementVersion?: string | null;
  OriginClient?: number | null;
}

export interface RecordData {
  RecordId: string;
  RecordNumber?: string | null;
  DraftReference?: string | null;
  DefinitionKey?: string | null;
  DefinitionVersion: number;
  State: number;
  StateName?: string | null;
  RowVersion: number;
  CallId?: number | null;
  StationGroupId?: number | null;
  OwnerUserId?: string | null;
  AuthorUserId?: string | null;
  CreatedOn?: string | null;
  ModifiedOn?: string | null;
  Values?: RecordValuesData | null;
  [key: string]: unknown;
}

export interface RecordValueCellData {
  SectionKey: string;
  FieldKey: string;
  RowKey?: string | null;
  Ordinal?: number;
  Value?: string | null;
  Values?: string[] | null;
  ReferenceType?: string | null;
  ReferenceId?: string | null;
  UnitCode?: string | null;
  IsWithheld?: boolean;
}

export interface RecordValuesData {
  DefinitionKey?: string | null;
  Version?: number;
  Cells: RecordValueCellData[];
}

/** Every v4 payload is wrapped like this. */
export interface RecordsApiResult<T> {
  Data?: T;
  PageSize?: number;
  Status?: string;
  Timestamp?: string;
}

/** How a conflict is presented; the client never replays one silently. */
export type FieldRecordConflictKind = 'etag' | 'permission' | 'scope' | 'definition-retired' | 'protected-data' | 'app-version';
