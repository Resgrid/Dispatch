import { Buffer } from 'buffer';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

import { abortRecordUpload, beginRecordUpload, completeRecordUpload, getRecordUpload, type RecordAttachmentData, type RecordUploadData, uploadRecordChunk } from '@/api/records/record-uploads';
import { logger } from '@/lib/logging';

// Resumable attachment upload for the field apps (RMS plan RMS-1D). The session lives on the server:
// it declares the chunk size and remembers how many bytes it holds, so an upload interrupted by a
// dead battery, a lost signal or a killed app resumes from the server's own count rather than
// starting again. Nothing is retried silently — a failure comes back for a person to act on.

/** RecordUploadSessionState on the server. */
export const RecordUploadState = {
  Open: 1,
  Completed: 2,
  Aborted: 3,
  Expired: 4,
} as const;

export interface PendingUpload {
  /** Client id; also the key this upload is persisted under so it survives a restart. */
  localId: string;
  recordId: string;
  uploadId: string | null;
  fileUri: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  sentBytes: number;
  description?: string | null;
  classification: number;
  createdOn: string;
  lastError?: string | null;
  /** Set when the file itself is gone; retrying cannot help and the person is told. */
  isUnrecoverable?: boolean;
}

export interface UploadProgress {
  sentBytes: number;
  totalBytes: number;
}

export interface UploadOutcome {
  ok: boolean;
  attachment?: RecordAttachmentData;
  /** A coded reason: the server's problem type, or one of file_missing / cancelled / failed. */
  code?: string;
  message?: string;
  /** How far the upload got, so a resume can pick up from here. */
  sentBytes?: number;
  uploadId?: string | null;
}

const problemCode = (error: unknown): string | undefined => {
  const response = (error as { response?: { data?: { type?: string }; status?: number } })?.response;
  if (!response) {
    return undefined;
  }
  return response.data?.type ?? (response.status ? `http_${response.status}` : undefined);
};

const problemMessage = (error: unknown): string => {
  const response = (error as { response?: { data?: { title?: string } } })?.response;
  return response?.data?.title ?? (error instanceof Error ? error.message : 'Upload failed');
};

/** The most of a file read at once; an attachment can be a long video, far too big to hold as one string. */
export const FILE_READ_CHUNK_BYTES = 3 * 1024 * 1024;

/**
 * One byte range of the file as base64. Ranges are read and encoded on their own, so a chunk can start at
 * any offset whatever it is modulo 3, and the file is never held as one base64 string.
 */
const readRange = (fileUri: string, position: number, length: number): Promise<string> => FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64, position, length });

export const fileSize = async (fileUri: string): Promise<number> => {
  const info = await FileSystem.getInfoAsync(fileUri);
  return info.exists && typeof info.size === 'number' ? info.size : 0;
};

/**
 * SHA-256 of the file's bytes, hex lower-case. The server hashes the assembled binary, so the digest is
 * taken over the decoded bytes; hashing the base64 text would never match and every upload would fail.
 * The digest needs every byte at once, but they are gathered a range at a time, so the file's base64 text
 * is never held alongside them.
 */
export const hashFile = async (fileUri: string): Promise<string> => {
  const size = await fileSize(fileUri);
  const bytes = Buffer.alloc(size);
  for (let offset = 0; offset < size; offset += FILE_READ_CHUNK_BYTES) {
    const length = Math.min(FILE_READ_CHUNK_BYTES, size - offset);
    const copied = Buffer.from(await readRange(fileUri, offset, length), 'base64').copy(bytes, offset);
    if (copied !== length) {
      // A short read means the file changed under us; a digest of it would only be refused at completion.
      throw new Error('The file changed while it was being read.');
    }
  }
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  return Buffer.from(digest).toString('hex');
};

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  /** Checked between chunks so a person can stop an upload without killing the screen. */
  shouldCancel?: () => boolean;
  signal?: AbortSignal;
}

/**
 * Sends a file to an existing or new session and completes it. Resuming is the normal path, not a
 * special case: the caller passes the pending upload back in and the server says where to continue.
 */
export const runUpload = async (pending: PendingUpload, options: UploadOptions = {}): Promise<UploadOutcome> => {
  try {
    const info = await FileSystem.getInfoAsync(pending.fileUri);
    if (!info.exists) {
      // The picker's cache was cleared, or the person deleted the photo. Retrying cannot fix that.
      return { ok: false, code: 'file_missing', message: 'The file is no longer on this device.', uploadId: pending.uploadId };
    }

    let session: RecordUploadData | null = null;
    if (pending.uploadId) {
      try {
        session = (await getRecordUpload(pending.uploadId, options.signal))?.Data ?? null;
      } catch (error) {
        // A session the server has forgotten is not an error worth surfacing; a new one is opened.
        logger.info({ message: 'Record upload session could not be resumed; starting a new one', context: { uploadId: pending.uploadId } });
      }
      if (session && session.State !== RecordUploadState.Open) {
        session = null;
      }
    }

    if (!session) {
      session =
        (
          await beginRecordUpload(
            {
              RecordId: pending.recordId,
              FileName: pending.fileName,
              ContentType: pending.contentType,
              ByteSize: pending.byteSize,
              Sha256: pending.sha256,
            },
            options.signal
          )
        )?.Data ?? null;
    }

    if (!session?.UploadId) {
      return { ok: false, code: 'no_session', message: 'The server did not open an upload.', uploadId: null };
    }

    // The server accepts a chunk only at an offset that is a multiple of its own chunk size (only the last
    // may be shorter), so each chunk is read from the file at exactly that size and offset.
    const chunkSize = session.ChunkSize > 0 ? session.ChunkSize : pending.byteSize;
    // The server's count is authoritative: it is the only thing that knows what actually arrived.
    let sent = session.ReceivedBytes ?? 0;
    options.onProgress?.({ sentBytes: sent, totalBytes: pending.byteSize });

    while (sent < pending.byteSize) {
      if (options.shouldCancel?.()) {
        return { ok: false, code: 'cancelled', sentBytes: sent, uploadId: session.UploadId };
      }
      const size = Math.min(chunkSize, pending.byteSize - sent);
      const data = await readRange(pending.fileUri, sent, size);
      const updated = (await uploadRecordChunk({ UploadId: session.UploadId, Offset: sent, Data: data }, options.signal))?.Data;
      if (!updated) {
        return { ok: false, code: 'chunk_failed', sentBytes: sent, uploadId: session.UploadId };
      }
      // A count that did not move means the chunk was not taken; sending it again would loop forever.
      if (!(updated.ReceivedBytes > sent)) {
        return { ok: false, code: 'chunk_stalled', sentBytes: sent, uploadId: session.UploadId };
      }
      // Trust the server's new count rather than adding locally, so a partially accepted chunk
      // cannot leave the client and the server disagreeing about where the file is.
      sent = updated.ReceivedBytes;
      options.onProgress?.({ sentBytes: sent, totalBytes: pending.byteSize });
    }

    const attachment = (await completeRecordUpload({ UploadId: session.UploadId, Description: pending.description ?? null, Classification: pending.classification }, options.signal))?.Data;

    return attachment?.AttachmentId ? { ok: true, attachment, sentBytes: sent, uploadId: session.UploadId } : { ok: false, code: 'complete_failed', sentBytes: sent, uploadId: session.UploadId };
  } catch (error) {
    const code = problemCode(error);
    logger.error({ message: 'Record attachment upload failed', context: { error, recordId: pending.recordId, code } });
    return { ok: false, code: code ?? 'failed', message: problemMessage(error), uploadId: pending.uploadId };
  }
};

/** Gives the session back to the server so its chunks are not left occupying storage. */
export const cancelUpload = async (uploadId: string | null): Promise<void> => {
  if (!uploadId) {
    return;
  }
  try {
    await abortRecordUpload(uploadId);
  } catch (error) {
    logger.info({ message: 'Record upload could not be aborted; it will expire on its own', context: { uploadId } });
  }
};
