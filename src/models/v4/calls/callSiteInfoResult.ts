import { BaseV4Request } from '../baseV4Request';
import { type ContactFileResultData } from '../contactFiles/contactFilesResult';
import { type ContactNoteResultData } from '../contacts/contactNoteResultData';
import { type ContactHazardData, type ContactPreplanData } from '../contacts/contactPreplanResult';

/** A contact linked to a call, as carried on CallResultData.Contacts (Contacts plan Phase A, 3a). */
export interface CallContactResultData {
  ContactId: string;
  /** Display name; the REDACTED placeholder in a protected department without a grant. */
  Name: string;
  /** 0 = Person, 1 = Company */
  ContactType: number;
  /** 0 = Primary, 1 = Additional */
  CallContactType: number;
  HasPreplan: boolean;
  AlertNoteCount: number;
  HazardCount: number;
}

/** One linked contact's site knowledge (v4 CallSiteContactData). */
export interface CallSiteContactData {
  ContactId: string;
  Name: string;
  ContactType: number;
  CallContactType: number;
  LocationGpsCoordinates?: string | null;
  EntranceGpsCoordinates?: string | null;
  PhoneNumber?: string | null;
  Preplan: ContactPreplanData | null;
  Hazards: ContactHazardData[];
  AlertNotes: ContactNoteResultData[];
  Attachments: ContactFileResultData[];
}

/** GET /Calls/GetCallSiteInfo payload. Additive-only contract (also the RMS NERIS prefill source). */
export interface CallSiteInfoData {
  CallId: string;
  IsProtected: boolean;
  ProtectedReason?: string | null;
  /** Primary contact first */
  Contacts: CallSiteContactData[];
}

export class CallSiteInfoResult extends BaseV4Request {
  public Data: CallSiteInfoData | null = null;
}
