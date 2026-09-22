import { runUpload } from '@/lib/records/uploads';

// Shared conformance suite for resumable attachment upload (RMS plan RMS-1D). Identical in all four
// app repositories: the server owns the session, so every adapter must resume from the server's own
// byte count rather than its own, and must surface a failure instead of retrying it silently.

jest.mock('@/api/records/record-uploads', () => ({
  beginRecordUpload: jest.fn(),
  uploadRecordChunk: jest.fn(),
  getRecordUpload: jest.fn(),
  completeRecordUpload: jest.fn(),
  abortRecordUpload: jest.fn(),
  getRecordAttachments: jest.fn(),
  removeRecordAttachment: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  digestStringAsync: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const api = jest.requireMock('@/api/records/record-uploads');
const fs = jest.requireMock('expo-file-system/legacy');

// 9 bytes encodes to 12 base64 characters, so a 3-byte chunk size slices cleanly.
const NINE_BYTES_BASE64 = 'AAAAAAAAAAAA';

const pending = (overrides: Record<string, unknown> = {}) => ({
  localId: 'upload-1',
  recordId: 'r1',
  uploadId: null,
  fileUri: 'file:///photo.jpg',
  fileName: 'photo.jpg',
  contentType: 'image/jpeg',
  byteSize: 9,
  sha256: 'abc',
  sentBytes: 0,
  classification: 1,
  createdOn: '2026-09-06T00:00:00Z',
  ...overrides,
});

const session = (receivedBytes: number, chunkSize = 3) => ({
  Data: {
    UploadId: 'session-1',
    RecordId: 'r1',
    FileName: 'photo.jpg',
    ContentType: 'image/jpeg',
    DeclaredSize: 9,
    ReceivedBytes: receivedBytes,
    ChunkSize: chunkSize,
    ChunkCount: 3,
    State: 1,
    ExpiresOn: '2026-09-07T00:00:00Z',
  },
});

describe('Record attachment uploads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 9 });
    fs.readAsStringAsync.mockResolvedValue(NINE_BYTES_BASE64);
  });

  it('sends the file in chunks and completes it', async () => {
    api.beginRecordUpload.mockResolvedValue(session(0));
    api.uploadRecordChunk.mockResolvedValueOnce(session(3)).mockResolvedValueOnce(session(6)).mockResolvedValueOnce(session(9));
    api.completeRecordUpload.mockResolvedValue({ Data: { AttachmentId: 'a1', FileName: 'photo.jpg', MetadataStripped: true, MediaLocationRetained: false } });
    const progress: number[] = [];

    const outcome = await runUpload(pending() as never, { onProgress: ({ sentBytes }) => progress.push(sentBytes) });

    expect(outcome.ok).toBe(true);
    expect(outcome.attachment?.AttachmentId).toBe('a1');
    expect(api.uploadRecordChunk).toHaveBeenCalledTimes(3);
    const offsets = api.uploadRecordChunk.mock.calls.map((call: unknown[]) => (call[0] as { Offset: number }).Offset);
    expect(offsets).toEqual([0, 3, 6]);
    expect(progress).toEqual([0, 3, 6, 9]);
  });

  it('sends the whole padded group for a final chunk that is not a multiple of 3 bytes', async () => {
    // 10 bytes: three full 3-byte chunks (4 base64 chars each) and a trailing single byte, which
    // base64 pads to a full 4-character group ("AA==") that must reach the server intact.
    const tenBytesBase64 = 'AAAAAAAAAAAAAA==';
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 10 });
    fs.readAsStringAsync.mockResolvedValue(tenBytesBase64);
    api.beginRecordUpload.mockResolvedValue({ Data: { ...session(0).Data, DeclaredSize: 10, ChunkCount: 4 } });
    api.uploadRecordChunk.mockResolvedValueOnce(session(3)).mockResolvedValueOnce(session(6)).mockResolvedValueOnce(session(9)).mockResolvedValueOnce(session(10));
    api.completeRecordUpload.mockResolvedValue({ Data: { AttachmentId: 'a4' } });

    const outcome = await runUpload(pending({ byteSize: 10 }) as never);

    expect(outcome.ok).toBe(true);
    const chunks: { Offset: number; Data: string }[] = api.uploadRecordChunk.mock.calls.map((call: unknown[]) => call[0] as { Offset: number; Data: string });
    expect(chunks.map((chunk) => chunk.Offset)).toEqual([0, 3, 6, 9]);
    expect(chunks.map((chunk) => chunk.Data)).toEqual(['AAAA', 'AAAA', 'AAAA', 'AA==']);
    expect(chunks.map((chunk) => chunk.Data).join('')).toBe(tenBytesBase64);
  });

  it('resumes from the count the server reports, not the one the device remembers', async () => {
    api.getRecordUpload.mockResolvedValue(session(6));
    api.uploadRecordChunk.mockResolvedValue(session(9));
    api.completeRecordUpload.mockResolvedValue({ Data: { AttachmentId: 'a2' } });

    const outcome = await runUpload(pending({ uploadId: 'session-1', sentBytes: 0 }) as never);

    expect(outcome.ok).toBe(true);
    expect(api.beginRecordUpload).not.toHaveBeenCalled();
    expect(api.uploadRecordChunk).toHaveBeenCalledTimes(1);
    expect(api.uploadRecordChunk.mock.calls[0][0].Offset).toBe(6);
  });

  it('opens a new session when the old one is gone or closed', async () => {
    api.getRecordUpload.mockResolvedValue({ Data: { ...session(9).Data, State: 4 } });
    api.beginRecordUpload.mockResolvedValue(session(0));
    api.uploadRecordChunk.mockResolvedValueOnce(session(3)).mockResolvedValueOnce(session(6)).mockResolvedValueOnce(session(9));
    api.completeRecordUpload.mockResolvedValue({ Data: { AttachmentId: 'a3' } });

    const outcome = await runUpload(pending({ uploadId: 'expired' }) as never);

    expect(outcome.ok).toBe(true);
    expect(api.beginRecordUpload).toHaveBeenCalledTimes(1);
  });

  it('reports a missing file as unrecoverable rather than trying to send it', async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: false });

    const outcome = await runUpload(pending() as never);

    expect(outcome).toMatchObject({ ok: false, code: 'file_missing' });
    expect(api.beginRecordUpload).not.toHaveBeenCalled();
    expect(api.uploadRecordChunk).not.toHaveBeenCalled();
  });

  it('surfaces a rejected upload with the server code and keeps how far it got', async () => {
    api.beginRecordUpload.mockResolvedValue(session(0));
    api.uploadRecordChunk.mockRejectedValue({ response: { status: 422, data: { type: 'upload_rejected', title: 'That file type is not accepted.' } } });

    const outcome = await runUpload(pending() as never);

    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe('upload_rejected');
    expect(outcome.message).toBe('That file type is not accepted.');
  });

  it('stops between chunks when the person cancels', async () => {
    api.beginRecordUpload.mockResolvedValue(session(0));
    api.uploadRecordChunk.mockResolvedValue(session(3));
    let calls = 0;

    const outcome = await runUpload(pending() as never, {
      shouldCancel: () => {
        calls += 1;
        return calls > 1;
      },
    });

    expect(outcome).toMatchObject({ ok: false, code: 'cancelled', sentBytes: 3 });
    expect(api.completeRecordUpload).not.toHaveBeenCalled();
  });
});
