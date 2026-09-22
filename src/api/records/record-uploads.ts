import { type RecordsApiResult } from '@/models/v4/records';

import { createApiEndpoint } from '../common/client';

// Resumable attachment uploads (RMS plan RMS-1D). The server owns the session: it declares the chunk
// size, remembers how many bytes it has, and assembles and hygiene-checks the file at the end. The
// client's job is to keep sending the next chunk from wherever the server says it got to.

export interface RecordUploadData {
  UploadId: string;
  RecordId: string;
  FileName: string;
  ContentType: string;
  DeclaredSize: number;
  ReceivedBytes: number;
  ChunkSize: number;
  ChunkCount: number;
  /** RecordUploadSessionState: 1 open, 2 completed, 3 aborted, 4 expired. */
  State: number;
  StateName?: string | null;
  ExpiresOn: string;
  AttachmentId?: string | null;
}

export interface RecordAttachmentData {
  AttachmentId: string;
  FileName?: string | null;
  ContentType?: string | null;
  ByteSize?: number;
  Checksum?: string | null;
  ScanState?: number;
  /** True when EXIF, XMP and IPTC were removed on upload; images are always re-encoded. */
  MetadataStripped?: boolean;
  /** True when the definition's profile asked for the photo's coordinates and they survived. */
  MediaLocationRetained?: boolean;
  Classification?: number | null;
  UploadedOn?: string | null;
}

const beginUploadApi = createApiEndpoint('/Records/BeginUpload');
const uploadChunkApi = createApiEndpoint('/Records/UploadChunk');
const getUploadApi = createApiEndpoint('/Records/GetUpload');
const completeUploadApi = createApiEndpoint('/Records/CompleteUpload');
const abortUploadApi = createApiEndpoint('/Records/AbortUpload');
const getAttachmentsApi = createApiEndpoint('/Records/GetAttachments');
const removeAttachmentApi = createApiEndpoint('/Records/RemoveAttachment');

export interface BeginUploadInput {
  RecordId: string;
  FileName: string;
  ContentType: string;
  /** Total size of the file; the server declares the chunk size back. */
  ByteSize: number;
  /** Lower-case hex SHA-256 of the whole file; the server refuses the assembly if it does not match. */
  Sha256: string;
}

export const beginRecordUpload = async (input: BeginUploadInput, signal?: AbortSignal) => {
  const response = await beginUploadApi.post<RecordsApiResult<RecordUploadData>>(input as unknown as Record<string, unknown>, signal);
  return response.data;
};

export interface UploadChunkInput {
  UploadId: string;
  /** Byte offset this chunk starts at; the server rejects anything but the offset it is waiting for. */
  Offset: number;
  /** Base64 of the chunk's bytes. */
  Data: string;
}

export const uploadRecordChunk = async (input: UploadChunkInput, signal?: AbortSignal) => {
  const response = await uploadChunkApi.post<RecordsApiResult<RecordUploadData>>(input as unknown as Record<string, unknown>, signal);
  return response.data;
};

/** The server's view of a session; this is what makes an interrupted upload resumable. */
export const getRecordUpload = async (uploadId: string, signal?: AbortSignal) => {
  const response = await getUploadApi.get<RecordsApiResult<RecordUploadData>>({ uploadId }, signal);
  return response.data;
};

export interface CompleteUploadInput {
  UploadId: string;
  Description?: string | null;
  /** RmsEvidenceClassification; 1 is unrestricted. */
  Classification?: number | null;
}

export const completeRecordUpload = async (input: CompleteUploadInput, signal?: AbortSignal) => {
  const response = await completeUploadApi.post<RecordsApiResult<RecordAttachmentData>>(input as unknown as Record<string, unknown>, signal);
  return response.data;
};

export const abortRecordUpload = async (uploadId: string, signal?: AbortSignal) => {
  const response = await abortUploadApi.post<RecordsApiResult<boolean>>({ UploadId: uploadId }, signal);
  return response.data;
};

export const getRecordAttachments = async (recordId: string, signal?: AbortSignal) => {
  const response = await getAttachmentsApi.get<RecordsApiResult<RecordAttachmentData[]>>({ id: recordId }, signal);
  return response.data;
};

export const removeRecordAttachment = async (recordId: string, attachmentId: string, signal?: AbortSignal) => {
  const response = await removeAttachmentApi.post<RecordsApiResult<unknown>>({ RecordId: recordId, AttachmentId: attachmentId }, signal);
  return response.data;
};
