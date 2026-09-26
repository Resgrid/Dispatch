import { goldenCatalogEntry } from '@/lib/records/__tests__/fixtures';
import { RmsRecordState } from '@/models/v4/records';
import { RECORDS_ORIGIN_CLIENT, useRecordsStore } from '@/stores/records/store';

// Shared conformance suite for the Field Records store (RMS plan RMS-1D). Identical in all four app
// repositories apart from the origin each one reports, which is asserted here rather than assumed.

jest.mock('@/lib/records/uploads', () => ({
  runUpload: jest.fn(),
  cancelUpload: jest.fn(),
}));

jest.mock('@/api/records/field-records', () => ({
  reportFieldRecordTelemetry: jest.fn(),
  getFieldRecordsPreflight: jest.fn(),
  getFieldRecordsCatalog: jest.fn(),
  getFieldRecordPrefill: jest.fn(),
  syncFieldRecords: jest.fn(),
  getFieldRecordAssignments: jest.fn(),
  getAssignmentsForRecord: jest.fn(),
  acknowledgeAssignment: jest.fn(),
  completeAssignment: jest.fn(),
}));

jest.mock('@/api/records/records', () => ({
  getRecord: jest.fn(),
  getRecordDefinitionVersion: jest.fn(),
  createRecordDraft: jest.fn(),
  saveRecordDraft: jest.fn(),
  submitRecordForReview: jest.fn(),
  finalizeRecord: jest.fn(),
  cancelRecord: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const fieldApi = jest.requireMock('@/api/records/field-records');
const recordsApi = jest.requireMock('@/api/records/records');
const uploads = jest.requireMock('@/lib/records/uploads');

const resetStore = () => {
  // reset() also drops queued telemetry, which is module state a setState cannot reach.
  useRecordsStore.getState().reset();
  useRecordsStore.setState({
    preflight: null,
    catalog: null,
    assignments: [],
    recent: [],
    drafts: [],
    pendingDrafts: {},
    pendingUploads: {},
    uploadProgress: {},
    schemas: {},
    scopeStamp: null,
    lastSyncTimestampMs: 0,
    isLoading: false,
    isSyncing: false,
    error: null,
    context: {},
  });
};

const summary = (id: string, state: number, modifiedOn: string) => ({
  RecordId: id,
  DefinitionVersion: 3,
  State: state,
  CreatedOn: modifiedOn,
  ModifiedOn: modifiedOn,
  RowVersion: 1,
});

describe('Field Records store conformance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  it('reports this app as its own field origin', () => {
    expect([2, 3, 4, 5]).toContain(RECORDS_ORIGIN_CLIENT as number);
  });

  it('keeps the sync delta and drops what the caller may no longer read', async () => {
    useRecordsStore.setState({ recent: [summary('r1', RmsRecordState.Finalized, '2026-09-01T00:00:00Z'), summary('r9', RmsRecordState.Finalized, '2026-09-01T00:00:00Z')] });
    fieldApi.syncFieldRecords.mockResolvedValue({
      Data: {
        Ok: true,
        ResetRequired: false,
        ScopeStamp: 'scope-1',
        ServerTimestampMs: 1000,
        Records: [summary('r2', RmsRecordState.Finalized, '2026-09-02T00:00:00Z')],
        Tombstones: ['r9'],
        Drafts: [summary('d1', RmsRecordState.Draft, '2026-09-02T00:00:00Z')],
        Assignments: [{ AssignmentId: 'a1', RecordId: 'r2', AssigneeKind: 'Person', Purpose: 'complete', State: 'Open', CreatedOn: '2026-09-02T00:00:00Z', RowVersion: 1 }],
      },
    });

    await useRecordsStore.getState().sync();

    const state = useRecordsStore.getState();
    expect(state.recent.map((record) => record.RecordId)).toEqual(['r2', 'r1']);
    expect(state.recent.some((record) => record.RecordId === 'r9')).toBe(false);
    expect(state.drafts).toHaveLength(1);
    expect(state.assignments).toHaveLength(1);
    expect(state.scopeStamp).toBe('scope-1');
    expect(state.lastSyncTimestampMs).toBe(1000);
  });

  it('clears the cached working set and re-pulls when the server says the scope changed', async () => {
    useRecordsStore.setState({ recent: [summary('r1', RmsRecordState.Finalized, '2026-09-01T00:00:00Z')], lastSyncTimestampMs: 500, scopeStamp: 'scope-0' });
    fieldApi.syncFieldRecords
      .mockResolvedValueOnce({ Data: { Ok: true, ResetRequired: true, ScopeStamp: 'scope-2', ServerTimestampMs: 0, Records: [], Tombstones: [], Drafts: [], Assignments: [] } })
      .mockResolvedValueOnce({ Data: { Ok: true, ResetRequired: false, ScopeStamp: 'scope-2', ServerTimestampMs: 900, Records: [], Tombstones: [], Drafts: [], Assignments: [] } });

    await useRecordsStore.getState().sync();

    expect(useRecordsStore.getState().recent).toEqual([]);
    expect(useRecordsStore.getState().scopeStamp).toBe('scope-2');
    expect(fieldApi.syncFieldRecords).toHaveBeenCalledTimes(2);
    expect(fieldApi.syncFieldRecords.mock.calls[1][0].Since).toBe(0);
  });

  it('refuses to stage a protected definition on the device', () => {
    useRecordsStore.setState({ catalog: { ContractVersion: 'field-catalog.v1', OriginClient: 'Dispatch', Ok: true, Reasons: [], ContextVerified: true, Definitions: [goldenCatalogEntry({ RequiresProtectedGrant: true })], Exclusions: [], ServerTimestampMs: 0 } });

    useRecordsStore.getState().stageDraft({
      clientRecordId: 'draft-1',
      recordId: null,
      definitionKey: 'shift-log',
      definitionVersion: 3,
      name: 'Shift log',
      values: [],
      updatedOn: '2026-09-06T00:00:00Z',
    });

    expect(useRecordsStore.getState().pendingDrafts).toEqual({});
  });

  it('sends a protected definition online without ever keeping it on the device', async () => {
    useRecordsStore.setState({ catalog: { ContractVersion: 'field-catalog.v1', OriginClient: 'Dispatch', Ok: true, Reasons: [], ContextVerified: true, Definitions: [goldenCatalogEntry({ RequiresProtectedGrant: true })], Exclusions: [], ServerTimestampMs: 0 } });
    const draft = { clientRecordId: 'draft-p', recordId: null, definitionKey: 'shift-log', definitionVersion: 3, name: 'Shift log', values: [], updatedOn: '2026-09-06T00:00:00Z' };
    recordsApi.createRecordDraft.mockRejectedValueOnce({ response: { status: 500, data: { title: 'Unavailable' } } }).mockResolvedValueOnce({ Data: { RecordId: 'server-p', DefinitionVersion: 3, State: RmsRecordState.Draft, RowVersion: 1 } });
    fieldApi.syncFieldRecords.mockResolvedValue({ Data: { Ok: true, ResetRequired: false, ScopeStamp: 'scope-1', ServerTimestampMs: 10, Records: [], Tombstones: [], Drafts: [], Assignments: [] } });

    useRecordsStore.getState().stageDraft(draft);
    const failed = await useRecordsStore.getState().pushDraft('draft-p', draft);

    expect(failed).toMatchObject({ ok: false, error: 'Unavailable' });
    expect(useRecordsStore.getState().pendingDrafts).toEqual({});

    const sent = await useRecordsStore.getState().pushDraft('draft-p', draft);

    expect(sent).toMatchObject({ ok: true, recordId: 'server-p' });
    expect(recordsApi.createRecordDraft).toHaveBeenLastCalledWith(expect.objectContaining({ DefinitionKey: 'shift-log', IdempotencyKey: 'draft-p' }));
    expect(useRecordsStore.getState().pendingDrafts).toEqual({});
  });

  describe('before the catalog has loaded', () => {
    const draft = { clientRecordId: 'draft-u', recordId: null, definitionKey: 'shift-log', definitionVersion: 3, name: 'Shift log', values: [], updatedOn: '2026-09-06T00:00:00Z' };

    it('does not stage a draft, since its definition may be one that seals values', () => {
      useRecordsStore.getState().stageDraft(draft);

      expect(useRecordsStore.getState().pendingDrafts).toEqual({});
    });

    it('does not keep a failed send that was never staged', async () => {
      recordsApi.createRecordDraft.mockRejectedValueOnce({ response: { status: 500, data: { title: 'Unavailable' } } });

      const result = await useRecordsStore.getState().pushDraft('draft-u', draft);

      expect(result).toMatchObject({ ok: false, error: 'Unavailable' });
      expect(useRecordsStore.getState().pendingDrafts).toEqual({});
    });

    it('keeps a draft staged earlier when its send fails', async () => {
      useRecordsStore.setState({ pendingDrafts: { 'draft-u': draft } });
      recordsApi.createRecordDraft.mockRejectedValueOnce({ response: { status: 500, data: { title: 'Unavailable' } } });

      await useRecordsStore.getState().pushAllDrafts();

      expect(useRecordsStore.getState().pendingDrafts['draft-u']).toMatchObject({ clientRecordId: 'draft-u', lastError: 'Unavailable' });
    });
  });

  it('keeps a conflicted draft and never replays it in the batch push', async () => {
    useRecordsStore.setState({ catalog: { ContractVersion: 'field-catalog.v1', OriginClient: 'Dispatch', Ok: true, Reasons: [], ContextVerified: true, Definitions: [goldenCatalogEntry()], Exclusions: [], ServerTimestampMs: 0 } });
    recordsApi.createRecordDraft.mockRejectedValue({ response: { status: 409, data: { type: 'record_concurrency', title: 'Changed' } } });

    useRecordsStore.getState().stageDraft({
      clientRecordId: 'draft-2',
      recordId: null,
      definitionKey: 'shift-log',
      definitionVersion: 3,
      name: 'Shift log',
      values: [],
      updatedOn: '2026-09-06T00:00:00Z',
    });

    const result = await useRecordsStore.getState().pushDraft('draft-2');

    expect(result.ok).toBe(false);
    expect(result.conflict).toBe('etag');
    expect(useRecordsStore.getState().pendingDrafts['draft-2'].conflict).toBe('etag');

    recordsApi.createRecordDraft.mockClear();
    await useRecordsStore.getState().pushAllDrafts();
    expect(recordsApi.createRecordDraft).not.toHaveBeenCalled();
  });

  it('clears a staged draft once the server accepts it', async () => {
    useRecordsStore.setState({ catalog: { ContractVersion: 'field-catalog.v1', OriginClient: 'Dispatch', Ok: true, Reasons: [], ContextVerified: true, Definitions: [goldenCatalogEntry()], Exclusions: [], ServerTimestampMs: 0 } });
    recordsApi.createRecordDraft.mockResolvedValue({ Data: { RecordId: 'server-1', DefinitionVersion: 3, State: RmsRecordState.Draft, RowVersion: 1 } });
    fieldApi.syncFieldRecords.mockResolvedValue({ Data: { Ok: true, ResetRequired: false, ScopeStamp: 'scope-1', ServerTimestampMs: 10, Records: [], Tombstones: [], Drafts: [], Assignments: [] } });

    useRecordsStore.getState().stageDraft({
      clientRecordId: 'draft-3',
      recordId: null,
      definitionKey: 'shift-log',
      definitionVersion: 3,
      name: 'Shift log',
      values: [],
      updatedOn: '2026-09-06T00:00:00Z',
    });

    const result = await useRecordsStore.getState().pushDraft('draft-3');

    expect(result).toMatchObject({ ok: true, recordId: 'server-1' });
    expect(useRecordsStore.getState().pendingDrafts['draft-3']).toBeUndefined();
    expect(recordsApi.createRecordDraft).toHaveBeenCalledWith(expect.objectContaining({ IdempotencyKey: 'draft-3', OriginClient: RECORDS_ORIGIN_CLIENT }));
  });

  it('keeps an interrupted upload so it can resume, and never retries a missing file', async () => {
    const upload = {
      localId: 'upload-1',
      recordId: 'r1',
      uploadId: null,
      fileUri: 'file:///photo.jpg',
      fileName: 'photo.jpg',
      contentType: 'image/jpeg',
      byteSize: 900,
      sha256: 'abc',
      sentBytes: 0,
      classification: 1,
      createdOn: '2026-09-06T00:00:00Z',
    };

    uploads.runUpload.mockResolvedValueOnce({ ok: false, code: 'chunk_failed', sentBytes: 300, uploadId: 'session-1', message: 'Lost signal' });
    useRecordsStore.getState().stageUpload(upload);
    let outcome = await useRecordsStore.getState().runUploads('r1');

    expect(outcome).toEqual({ uploaded: 0, failed: 1 });
    const kept = useRecordsStore.getState().pendingUploads['upload-1'];
    expect(kept.sentBytes).toBe(300);
    expect(kept.uploadId).toBe('session-1');
    expect(kept.isUnrecoverable).toBeFalsy();

    uploads.runUpload.mockResolvedValueOnce({ ok: false, code: 'file_missing' });
    outcome = await useRecordsStore.getState().runUploads('r1');
    expect(useRecordsStore.getState().pendingUploads['upload-1'].isUnrecoverable).toBe(true);

    uploads.runUpload.mockClear();
    outcome = await useRecordsStore.getState().runUploads('r1');
    expect(uploads.runUpload).not.toHaveBeenCalled();
    expect(outcome).toEqual({ uploaded: 0, failed: 0 });
  });

  it('clears an upload once the server has the attachment', async () => {
    uploads.runUpload.mockResolvedValue({ ok: true, attachment: { AttachmentId: 'a1' }, sentBytes: 900 });
    useRecordsStore.getState().stageUpload({
      localId: 'upload-2',
      recordId: 'r1',
      uploadId: null,
      fileUri: 'file:///photo.jpg',
      fileName: 'photo.jpg',
      contentType: 'image/jpeg',
      byteSize: 900,
      sha256: 'abc',
      sentBytes: 0,
      classification: 1,
      createdOn: '2026-09-06T00:00:00Z',
    });

    const outcome = await useRecordsStore.getState().runUploads('r1');

    expect(outcome).toEqual({ uploaded: 1, failed: 0 });
    expect(useRecordsStore.getState().pendingUploads['upload-2']).toBeUndefined();
    expect(useRecordsStore.getState().uploadProgress['upload-2']).toBeUndefined();
  });

  it('hands a discarded upload back to the server and batches telemetry without content', async () => {
    useRecordsStore.getState().stageUpload({
      localId: 'upload-3',
      recordId: 'r1',
      uploadId: 'session-9',
      fileUri: 'file:///photo.jpg',
      fileName: 'photo.jpg',
      contentType: 'image/jpeg',
      byteSize: 10,
      sha256: 'abc',
      sentBytes: 0,
      classification: 1,
      createdOn: '2026-09-06T00:00:00Z',
    });

    await useRecordsStore.getState().discardUpload('upload-3');

    expect(uploads.cancelUpload).toHaveBeenCalledWith('session-9');
    expect(useRecordsStore.getState().pendingUploads['upload-3']).toBeUndefined();

    fieldApi.reportFieldRecordTelemetry.mockResolvedValue({ Data: { Accepted: 1 } });
    useRecordsStore.getState().report({ EventType: 'attachment', Outcome: 'ok', RecordId: 'r1', ItemCount: 12 });
    await useRecordsStore.getState().flushTelemetry();

    const batch = fieldApi.reportFieldRecordTelemetry.mock.calls[0][0];
    expect(batch.OriginClient).toBe(RECORDS_ORIGIN_CLIENT);
    expect(batch.Events[0]).toMatchObject({ EventType: 'attachment', Outcome: 'ok', ItemCount: 12 });
    expect(JSON.stringify(batch)).not.toContain('photo.jpg');

    fieldApi.reportFieldRecordTelemetry.mockClear();
    await useRecordsStore.getState().flushTelemetry();
    expect(fieldApi.reportFieldRecordTelemetry).not.toHaveBeenCalled();
  });

  it('drops the catalog when the context changes so it is never shown against another context', () => {
    useRecordsStore.setState({ catalog: { ContractVersion: 'field-catalog.v1', OriginClient: 'Dispatch', Ok: true, Reasons: [], ContextVerified: true, Definitions: [goldenCatalogEntry()], Exclusions: [], ServerTimestampMs: 0 } });

    useRecordsStore.getState().setContext({ CallId: 501 });

    expect(useRecordsStore.getState().catalog).toBeNull();
    expect(useRecordsStore.getState().context).toEqual({ CallId: 501 });
  });
});
