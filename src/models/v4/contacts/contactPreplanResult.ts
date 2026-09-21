import { BaseV4Request } from '../baseV4Request';

/**
 * A premise hazard on a contact's pre-incident plan (Contacts plan Phase A; v4 ContactHazardData).
 * Text fields are ADP catalog v12: with protection enforced and no grant they read as REDACTED and
 * RedactedFields names them.
 */
export interface ContactHazardData {
  IsProtected: boolean;
  ProtectedReason?: string | null;
  RedactedFields?: string[];
  ContactPreplanHazardId: string;
  ContactPreplanId: string;
  ContactId: string;
  /** ContactPreplanHazardTypes: General 0, Hazmat 1, Structural 2, Electrical 3, Biological 4, Animal 5, Occupant 6, Other 7 */
  HazardType: number;
  HazardTypeName: string;
  /** ContactPreplanHazardSeverities: Info 0, Caution 1, Danger 2 */
  Severity: number;
  SeverityName: string;
  Title: string;
  Description?: string | null;
  LocationDescription?: string | null;
  /** "lat,lng" */
  GpsCoordinates?: string | null;
  ShouldAlert: boolean;
  AddedOnUtc: string;
  AddedOn: string;
  AddedByUserId?: string | null;
  EditedOnUtc?: string | null;
  EditedOn?: string | null;
  EditedByUserId?: string | null;
}

/** A contact's NFPA 1620 pre-incident plan (v4 ContactPreplanData). Enum fields carry the integer value. */
export interface ContactPreplanData {
  IsProtected: boolean;
  ProtectedReason?: string | null;
  RedactedFields?: string[];
  ContactPreplanId: string;
  ContactId: string;
  ConstructionType: number;
  ConstructionTypeName: string;
  RoofType: number;
  RoofTypeName: string;
  OccupancyType: number;
  OccupancyTypeName: string;
  OccupancyNotes?: string | null;
  OccupancyHours?: string | null;
  OccupantLoad?: number | null;
  HasOccupantsNeedingAssistance: boolean;
  OccupantsNeedingAssistanceNotes?: string | null;
  GasShutoffLocation?: string | null;
  ElectricShutoffLocation?: string | null;
  WaterShutoffLocation?: string | null;
  UtilityNotes?: string | null;
  KnoxBoxLocation?: string | null;
  GateCode?: string | null;
  AlarmPanelLocation?: string | null;
  AlarmCompany?: string | null;
  AlarmCompanyPhone?: string | null;
  AccessNotes?: string | null;
  NearestHydrantLocation?: string | null;
  RequiredFireFlowGpm?: number | null;
  WaterSupplyNotes?: string | null;
  EmergencyContactName?: string | null;
  EmergencyContactPhone?: string | null;
  SecondaryContactName?: string | null;
  SecondaryContactPhone?: string | null;
  HazmatOnSite: boolean;
  GeneralHazardNotes?: string | null;
  TacticalSummary?: string | null;
  LastReviewedOnUtc?: string | null;
  LastReviewedOn?: string | null;
  ReviewedByUserId?: string | null;
  NextReviewDueUtc?: string | null;
  NextReviewDue?: string | null;
  IsReviewOverdue: boolean;
  AddedOnUtc: string;
  AddedOn: string;
  AddedByUserId?: string | null;
  EditedOnUtc?: string | null;
  EditedOn?: string | null;
  EditedByUserId?: string | null;
  Hazards: ContactHazardData[];
}

/** GET /Contacts/GetContactPreplan — Data is null when the contact has no plan. */
export class ContactPreplanResult extends BaseV4Request {
  public Data: ContactPreplanData | null = null;
}

/** GET /Contacts/GetContactHazards */
export class ContactHazardsResult extends BaseV4Request {
  public Data: ContactHazardData[] = [];
}

/** POST /Contacts/SaveContactPreplan — the whole plan is written; omitted text fields clear. */
export interface SaveContactPreplanInput {
  ContactId: string;
  ConstructionType: number;
  RoofType: number;
  OccupancyType: number;
  OccupancyNotes?: string;
  OccupancyHours?: string;
  OccupantLoad?: number | null;
  HasOccupantsNeedingAssistance: boolean;
  OccupantsNeedingAssistanceNotes?: string;
  GasShutoffLocation?: string;
  ElectricShutoffLocation?: string;
  WaterShutoffLocation?: string;
  UtilityNotes?: string;
  KnoxBoxLocation?: string;
  GateCode?: string;
  AlarmPanelLocation?: string;
  AlarmCompany?: string;
  AlarmCompanyPhone?: string;
  AccessNotes?: string;
  NearestHydrantLocation?: string;
  RequiredFireFlowGpm?: number | null;
  WaterSupplyNotes?: string;
  EmergencyContactName?: string;
  EmergencyContactPhone?: string;
  SecondaryContactName?: string;
  SecondaryContactPhone?: string;
  HazmatOnSite: boolean;
  GeneralHazardNotes?: string;
  TacticalSummary?: string;
  MarkReviewed?: boolean;
  NextReviewDueUtc?: string | null;
}

/** POST /Contacts/SaveContactHazard — omit ContactPreplanHazardId to create. */
export interface SaveContactHazardInput {
  ContactPreplanHazardId?: string | null;
  ContactId: string;
  HazardType: number;
  Severity: number;
  Title: string;
  Description?: string;
  LocationDescription?: string;
  GpsCoordinates?: string;
  ShouldAlert: boolean;
}

export class SaveContactPreplanResult extends BaseV4Request {
  public Id: string = '';
}

export class SaveContactHazardResult extends BaseV4Request {
  public Id: string = '';
}

export class DeleteContactPreplanResult extends BaseV4Request {}

export class DeleteContactHazardResult extends BaseV4Request {}
