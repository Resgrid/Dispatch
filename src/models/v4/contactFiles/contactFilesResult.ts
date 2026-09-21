import { BaseV4Request } from '../baseV4Request';

/** ContactAttachmentTypes on the server. */
export enum ContactFileType {
  Document = 0,
  PrePlan = 1,
  FloorPlan = 2,
  SitePhoto = 3,
  SiteDrawing = 4,
  Other = 5,
}

/**
 * One file attached to a contact (v4 ContactFileResultData). Name, file name and bytes are ADP catalog v12
 * fields: with protection enforced the anonymous signed Url is null for an enveloped file, and the bytes come
 * back only through getContactFiles(includeData) with a grant.
 */
export interface ContactFileResultData {
  IsProtected: boolean;
  ProtectedReason?: string | null;
  RedactedFields?: string[];
  Id: string;
  ContactId: string;
  Type: number;
  TypeName: string;
  Name: string;
  FileName: string;
  Mime: string;
  Size: number;
  /** Base64 file data, only when includeData was requested (null for a concealed protected file). */
  Data?: string | null;
  /** Signed, expiring anonymous download URL; regenerated on every list call — never persist it. */
  Url?: string | null;
  UserId?: string | null;
  Timestamp: string;
}

/** GET /ContactFiles/GetFilesForContact */
export class ContactFilesResult extends BaseV4Request {
  public Data: ContactFileResultData[] = [];
}

/** POST /ContactFiles/UploadContactFile */
export interface UploadContactFileInput {
  ContactId: string;
  Type: number;
  Name?: string;
  FileName: string;
  /** Base64 file contents */
  Data: string;
}

export class UploadContactFileResult extends BaseV4Request {
  public Id: string = '';
}

export class DeleteContactFileResult extends BaseV4Request {}
