// Deployments and external ordering-system connectors (RMS plan section 4.1, RMS-1C). Mirrors the v4
// RecordDeployments and RecordDeploymentConnectors controllers. Everything here is read from the
// server; the only command a field client may issue is "read the feed now", and only a department
// administrator may issue it. Creating or changing a connector — and above all entering its
// credential — stays Web-first, so those inputs are deliberately absent from this module.

/** Resgrid.Model.RmsExternalOrderStatus, as the API names it. */
export type RecordDeploymentStatus = 'Open' | 'Mobilized' | 'Released' | 'ClosedOut';

/** Resgrid.Model.RmsDeploymentFillStatus, as the API names it. */
export type RecordDeploymentFillStatus = 'Requested' | 'Accepted' | 'Declined' | 'Mobilized' | 'CheckedIn' | 'Assigned' | 'Released' | 'Demobilized' | 'Returned';

/** Resgrid.Model.RmsExternalOrderOwnership: who maintains the source view of an order. */
export const RmsExternalOrderOwnership = {
  Manual: 'manual',
  Connector: 'connector',
} as const;

export interface RecordDeploymentFillData {
  FillId: string;
  RequestNumber: string;
  ParentRequestNumber?: string | null;
  RequestCategory?: string | null;
  FillNumber?: string | null;
  ResourceKind?: string | null;
  ResourceType?: string | null;
  ResourceTypeScheme?: string | null;
  Position?: string | null;
  PositionScheme?: string | null;
  IsTrainee: boolean;
  HomeUnit?: string | null;
  HostAgency?: string | null;
  AgencyUnitId?: string | null;
  PointOfHire?: string | null;
  CostCode?: string | null;
  AgreementReference?: string | null;
  AssignedUserId?: string | null;
  AssignedUnitId?: number | null;
  Status: RecordDeploymentFillStatus | string;
  DeclineReason?: string | null;
  RequestedOn?: string | null;
  NeededOn?: string | null;
  FilledOn?: string | null;
  MobilizedOn?: string | null;
  CheckedInOn?: string | null;
  AssignedOn?: string | null;
  ReleasedOn?: string | null;
  DemobilizedOn?: string | null;
  ReturnedOn?: string | null;
  CapturedOffsetMinutes?: number | null;
  Notes?: string | null;
  RowVersion: number;
}

export interface RecordDeploymentData {
  OrderId: string;
  RecordId?: string | null;
  RecordNumber?: string | null;
  RecordState?: string | null;
  ProfileKey: string;
  ProfileVersion: number;
  HomeProfileKey?: string | null;
  HostProfileKey?: string | null;
  SourceScheme: string;
  SourceSystem?: string | null;
  OrderNumber: string;
  IncidentName: string;
  IncidentNumber?: string | null;
  IncidentCountry?: string | null;
  IncidentSubdivision?: string | null;
  OrderingOffice?: string | null;
  DispatchOffice?: string | null;
  RequestingAgency?: string | null;
  ReceivingAgency?: string | null;
  SendingAgency?: string | null;
  DepartmentRole?: string | null;
  CostCode?: string | null;
  AgreementReference?: string | null;
  CurrencyCode?: string | null;
  MeasurementSystem?: string | null;
  TimeZoneId?: string | null;
  CapturedOffsetMinutes?: number | null;
  SourceCapturedOn?: string | null;
  SourceVersion?: string | null;
  ArtifactFileName?: string | null;
  ArtifactContentType?: string | null;
  ArtifactChecksum?: string | null;
  HasArtifact: boolean;
  ArtifactSafeUrl?: string | null;
  Status: RecordDeploymentStatus | string;
  /** manual or connector; see RmsExternalOrderOwnership. */
  OwnershipMarker?: string | null;
  ConnectorId?: string | null;
  MobilizedOn?: string | null;
  ReleasedOn?: string | null;
  ClosedOutOn?: string | null;
  CloseoutNotes?: string | null;
  AllReturned: boolean;
  IsPreview: boolean;
  ProvenanceStatement?: string | null;
  CreatedOn: string;
  ModifiedOn: string;
  RowVersion: number;
  ETag?: string | null;
  Fills: RecordDeploymentFillData[];
}

/** One connector as the server describes it; the credential and the inbound token never travel. */
export interface RecordDeploymentConnectorData {
  Id: string;
  ProviderKey: string;
  Name: string;
  SourceSystem?: string | null;
  SourceScheme: string;
  ProfileKey: string;
  BaseUrl: string;
  CredentialKind: string;
  CredentialHeaderName?: string | null;
  HasCredential: boolean;
  HasInboundToken: boolean;
  ReadEnabled: boolean;
  /** Always false in this release: write authority to an external ordering system is refused. */
  WriteEnabled: boolean;
  PollIntervalMinutes: number;
  MaxRequestsPerHour: number;
  RequestsThisHour: number;
  TermsReference?: string | null;
  TermsAcknowledgedOn?: string | null;
  TermsAcknowledgedByUserId?: string | null;
  IsEnabled: boolean;
  IsReadyToRun: boolean;
  LastPolledOn?: string | null;
  LastSuccessOn?: string | null;
  LastError?: string | null;
  ConsecutiveFailures: number;
  CreatedOn: string;
  ModifiedOn: string;
  RowVersion: number;
}

export const RmsConnectorRunTriggers = {
  Poll: 'poll',
  Manual: 'manual',
  Inbound: 'inbound',
} as const;

export const RmsConnectorRunOutcomes = {
  Ok: 'ok',
  Failed: 'failed',
  RateLimited: 'rate_limited',
  Disabled: 'disabled',
  Rejected: 'rejected',
} as const;

export type RmsConnectorRunOutcome = (typeof RmsConnectorRunOutcomes)[keyof typeof RmsConnectorRunOutcomes];

export interface RecordDeploymentConnectorRunData {
  Id: string;
  ConnectorId: string;
  Trigger: string;
  TriggeredByUserId?: string | null;
  StartedOn: string;
  FinishedOn?: string | null;
  Outcome: RmsConnectorRunOutcome | string;
  Error?: string | null;
  RequestCount: number;
  OrdersSeen: number;
  OrdersCreated: number;
  SnapshotsRecorded: number;
  RequestsAdded: number;
  Unchanged: number;
  Rejected: number;
  Conflicts: number;
  SourceVersion?: string | null;
  Messages: string[];
}

/** Where the source's latest snapshot and the department's own record disagree. Never applied by a client. */
export type RecordDeploymentReconciliationKind =
  | 'source_released_local_not_returned'
  | 'source_closed_local_open'
  | 'source_request_missing_locally'
  | 'local_fill_missing_in_source'
  | 'source_status_ahead'
  | 'source_status_behind';

export interface RecordDeploymentReconciliationData {
  ConnectorId?: string | null;
  OrderId: string;
  RecordId?: string | null;
  OrderNumber: string;
  RequestNumber?: string | null;
  Kind: RecordDeploymentReconciliationKind | string;
  SourceStatus?: string | null;
  LocalStatus?: string | null;
  SourceVersion?: string | null;
  SourceCapturedOn?: string | null;
}
