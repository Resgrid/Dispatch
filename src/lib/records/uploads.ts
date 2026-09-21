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

/** SHA-256 of the file, hex lower-case, computed without holding the whole file as a string twice. */
export const hashFile = async (fileUri: string): Promise<string> => {
  const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
  return (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64, { encoding: Crypto.CryptoEncoding.HEX })).toLowerCase();
};

export const fileSize = async (fileUri: string): Promise<number> => {
  const info = await FileSystem.getInfoAsync(fileUri);
  return info.exists && typeof info.size === 'number' ? info.size : 0;
};

/**
 * The server hashes the assembled bytes, so the hash we declare has to be of the same bytes. Reading
 * base64 once and slicing it keeps the chunk boundaries aligned: base64 encodes 3 bytes as 4 chars,
 * so a chunk size that is a multiple of 3 slices cleanly without re-encoding anything.
 */
const chunkOf = (base64: string, offsetBytes: number, chunkBytes: number): string => {
  const start = (offsetBytes / 3) * 4;
  const length = (chunkBytes / 3) * 4;
  return base64.slice(start, start + length);
};

const alignChunkSize = (chunkSize: number): number => {
  const safe = Math.max(3, Math.min(chunkSize || 0, 3 * 1024 * 1024));
  return safe - (safe % 3);
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

    const chunkSize = alignChunkSize(session.ChunkSize);
    const base64 = await FileSystem.readAsStringAsync(pending.fileUri, { encoding: FileSystem.EncodingType.Base64 });
    // The server's count is authoritative: it is the only thing that knows what actually arrived.
    let sent = session.ReceivedBytes ?? 0;
    options.onProgress?.({ sentBytes: sent, totalBytes: pending.byteSize });

    while (sent < pending.byteSize) {
      if (options.shouldCancel?.()) {
        return { ok: false, code: 'cancelled', sentBytes: sent, uploadId: session.UploadId };
      }
      const size = Math.min(chunkSize, pending.byteSize - sent);
      const data = chunkOf(base64, sent, size);
      const updated = (await uploadRecordChunk({ UploadId: session.UploadId, Offset: sent, Data: data }, options.signal))?.Data;
      if (!updated) {
        return { ok: false, code: 'chunk_failed', sentBytes: sent, uploadId: session.UploadId };
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
