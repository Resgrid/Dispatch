import { BaseV4Request } from '../baseV4Request';

/** Why a call is in a location history; a call can match more than one way. */
export type LocationHistoryMatch = 'SameContact' | 'SameAddress' | 'SimilarAddress' | 'Nearby';

/** A note on a call in a location history (v4 LocationHistoryNoteData). */
export interface LocationHistoryNoteData {
  CallNoteId: string;
  UserId?: string | null;
  FullName?: string | null;
  /** The REDACTED placeholder in a protected department without a grant. */
  Note: string;
  TimestampUtc: string;
}

/** One call in a location history (v4 LocationHistoryCallData). */
export interface LocationHistoryCallData {
  CallId: string;
  Number: string;
  Name: string;
  Nature?: string | null;
  Address?: string | null;
  Type?: string | null;
  Priority: number;
  PriorityText?: string | null;
  PriorityColor?: string | null;
  /** CallStates: 0 Active, 1 Closed, 2 Cancelled, 3 Unfounded, 4 Founded, 5 Minor */
  State: number;
  LoggedOnUtc: string;
  /** Formatted in the department's time zone */
  LoggedOn?: string | null;
  ClosedOnUtc?: string | null;
  CompletedNotes?: string | null;
  Matches: LocationHistoryMatch[];
  DistanceMeters?: number | null;
  /** Oldest first */
  Notes: LocationHistoryNoteData[];
}

/**
 * GET /Calls/GetCallLocationHistory, /Contacts/GetContactCallHistory and /RecordOccupancies/CallHistory payload: previous
 * calls at a location, found by contact link and by address compared parsed ("110 S Main St" = "110 South Main") or proximity.
 */
export interface LocationHistoryData {
  /** False while the department's Advanced Data Protection is on: only contact links were searched. */
  AddressMatchingAvailable: boolean;
  /** False while older calls are still being indexed; some may be missing. */
  IndexComplete: boolean;
  /** More calls matched than were returned; the newest are returned. */
  HasMore: boolean;
  /** How the address was understood ("110 S MAIN ST"); null when it did not parse. */
  InterpretedAddress?: string | null;
  IsProtected: boolean;
  ProtectedReason?: string | null;
  /** Newest first */
  Calls: LocationHistoryCallData[];
}

export class LocationHistoryResult extends BaseV4Request {
  public Data: LocationHistoryData | null = null;
}
