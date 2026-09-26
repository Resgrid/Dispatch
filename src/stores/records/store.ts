import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  acknowledgeAssignment as acknowledgeAssignmentApi,
  completeAssignment as completeAssignmentApi,
  getFieldRecordPrefill,
  getFieldRecordsCatalog,
  getFieldRecordsPreflight,
  reportFieldRecordTelemetry,
  syncFieldRecords,
} from '@/api/records/field-records';
import { createRecordDraft, finalizeRecord, getRecordDefinitionVersion, saveRecordDraft, submitRecordForReview } from '@/api/records/records';
import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';
import { canAuthorOffline, CLIENT_CAPABILITY, toValueList, type ValueMap } from '@/lib/records/schema';
import { type PendingUpload, type UploadOptions, type UploadOutcome } from '@/lib/records/uploads';
import { zustandStorage } from '@/lib/storage';
import {
  type FieldRecordAssignmentData,
  type FieldRecordCatalogData,
  type FieldRecordCatalogEntry,
  type FieldRecordConflictKind,
  type FieldRecordContextInput,
  type FieldRecordPrefillData,
  type FieldRecordPreflightData,
  type RecordDefinitionSchema,
  type RecordSummaryData,
  type RecordValueInput,
  RmsOriginClient,
  RmsRecordState,
} from '@/models/v4/records';

// Field Records working set for this app (RMS plan RMS-1D). The server owns every filter; this store
// holds what it returned, the drafts this device is carrying, and the conflicts a person must resolve.
// Nothing here widens access: a tombstoned or unauthorized Record is dropped rather than displayed.

/** This app's origin. Every other app repo ships the same store with its own value. */
export const RECORDS_ORIGIN_CLIENT: RmsOriginClient = RmsOriginClient.Dispatch;

const SYNC_TAKE = 200;

/** Most rollout events held before the oldest are dropped; telemetry never grows without a bound. */
const TELEMETRY_MAX = 100;

/** One safe rollout datapoint (RMS plan RMS-1D): a coded outcome, a count, a duration. Never content. */
export interface FieldRecordTelemetryEvent {
  EventType: string;
  Outcome?: string;
  DefinitionKey?: string;
  DefinitionVersion?: number;
  RecordId?: string;
  DurationMs?: number;
  ItemCount?: number;
  OccurredOn?: string;
}

// Module scope rather than store state: the queue is transient, must not be persisted, and must not
// make every consumer of the store re-render each time an event is added.
let telemetryQueue: FieldRecordTelemetryEvent[] = [];

// The upload driver reaches for the camera roll and the crypto module, so it is loaded only when an
// upload actually runs. Importing it here would drag those native modules into every screen that
// touches this store, which is most of them.
interface UploaderModule {
  runUpload: (pending: PendingUpload, options?: UploadOptions) => Promise<UploadOutcome>;
  cancelUpload: (uploadId: string | null) => Promise<void>;
}

// The type-only imports above are erased, so nothing native loads until this runs.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const loadUploader = (): UploaderModule => require('@/lib/records/uploads');

export interface PendingRecordDraft {
  /** Client id until the server issues one; also the offline queue key. */
  clientRecordId: string;
  recordId: string | null;
  definitionKey: string;
  definitionVersion: number;
  name: string;
  values: RecordValueInput[];
  callId?: number | null;
  stationGroupId?: number | null;
  rowVersion?: number | null;
  updatedOn: string;
  /** Set when the last push failed; the person is told rather than the write being replayed. */
  lastError?: string | null;
  conflict?: FieldRecordConflictKind | null;
}

interface RecordsState {
  preflight: FieldRecordPreflightData | null;
  catalog: FieldRecordCatalogData | null;
  assignments: FieldRecordAssignmentData[];
  recent: RecordSummaryData[];
  drafts: RecordSummaryData[];
  pendingDrafts: Record<string, PendingRecordDraft>;
  /** Attachments this device is carrying; an interrupted upload resumes from the server's own count. */
  pendingUploads: Record<string, PendingUpload>;
  /** Bytes sent per upload, kept out of the persisted slice because it is only meaningful live. */
  uploadProgress: Record<string, number>;
  schemas: Record<string, RecordDefinitionSchema>;
  scopeStamp: string | null;
  lastSyncTimestampMs: number;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  context: FieldRecordContextInput;

  setContext: (context: FieldRecordContextInput) => void;
  runPreflight: () => Promise<FieldRecordPreflightData | null>;
  fetchCatalog: () => Promise<FieldRecordCatalogData | null>;
  sync: (options?: { full?: boolean }) => Promise<void>;
  fetchSchema: (definitionKey: string, version: number) => Promise<RecordDefinitionSchema | null>;
  prefill: (definitionKey: string, version: number) => Promise<FieldRecordPrefillData | null>;

  stageDraft: (draft: PendingRecordDraft) => void;
  discardDraft: (clientRecordId: string) => void;
  /** Sends a staged draft, or `draft` itself when it was not staged (a definition that seals values never is). */
  pushDraft: (clientRecordId: string, draft?: PendingRecordDraft) => Promise<{ ok: boolean; recordId?: string; conflict?: FieldRecordConflictKind; error?: string }>;
  pushAllDrafts: () => Promise<void>;
  submitForReview: (recordId: string, rowVersion: number) => Promise<{ ok: boolean; error?: string }>;
  finalize: (recordId: string, rowVersion: number, attested: boolean) => Promise<{ ok: boolean; error?: string }>;

  stageUpload: (upload: PendingUpload) => void;
  discardUpload: (localId: string) => Promise<void>;
  retryUpload: (localId: string) => Promise<void>;
  runUploads: (recordId?: string) => Promise<{ uploaded: number; failed: number }>;

  report: (event: FieldRecordTelemetryEvent) => void;
  flushTelemetry: () => Promise<void>;

  acknowledge: (assignmentId: string, rowVersion: number) => Promise<void>;
  complete: (assignmentId: string, rowVersion: number) => Promise<void>;

  entryFor: (definitionKey: string, version?: number) => FieldRecordCatalogEntry | null;
  reset: () => void;
}

const catalogInput = (context: FieldRecordContextInput) => ({
  OriginClient: RECORDS_ORIGIN_CLIENT as number,
  AppVersion: Env.VERSION,
  ClientCapability: CLIENT_CAPABILITY,
  Context: context,
});

/** An axios failure carries the server's problem type; that is what tells a conflict apart. */
const conflictFrom = (error: unknown): FieldRecordConflictKind | undefined => {
  const response = (error as { response?: { status?: number; data?: { type?: string } } })?.response;
  if (!response) {
    return undefined;
  }
  const type = response.data?.type ?? '';
  if (type.includes('concurrency') || type.includes('conflict') || response.status === 412) {
    return 'etag';
  }
  if (response.status === 403) {
    return type.includes('field_records_disabled') ? 'app-version' : 'permission';
  }
  if (type.includes('definition')) {
    return 'definition-retired';
  }
  if (type.includes('protected')) {
    return 'protected-data';
  }
  if (response.status === 409) {
    return 'etag';
  }
  return undefined;
};

const messageFrom = (error: unknown): string => {
  const response = (error as { response?: { data?: { title?: string } } })?.response;
  return response?.data?.title ?? (error instanceof Error ? error.message : 'Request failed');
};

/**
 * Only a definition the catalog confirms may be authored offline leaves its values on the device. An unknown
 * one (the catalog is not persisted, so it is often not loaded yet) is refused: it may be one that seals values.
 */
const mayKeepOnDevice = (entry: FieldRecordCatalogEntry | null): boolean => canAuthorOffline(entry);

export const useRecordsStore = create<RecordsState>()(
  persist(
    (set, get) => ({
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

      setContext: (context) => {
        const current = get().context;
        if (current.CallId === context.CallId && current.UnitId === context.UnitId && current.GroupId === context.GroupId && current.CommandRole === context.CommandRole) {
          return;
        }
        // The catalog is context-specific, so it is dropped rather than shown against a new context.
        set({ context, catalog: null });
      },

      runPreflight: async () => {
        try {
          const response = await getFieldRecordsPreflight(RECORDS_ORIGIN_CLIENT, Env.VERSION, CLIENT_CAPABILITY);
          const preflight = response?.Data ?? null;
          set({ preflight, error: null });
          return preflight;
        } catch (error) {
          logger.error({ message: 'Field Records preflight failed', context: { error } });
          set({ error: messageFrom(error) });
          return null;
        }
      },

      fetchCatalog: async () => {
        set({ isLoading: true });
        try {
          const response = await getFieldRecordsCatalog(catalogInput(get().context));
          const catalog = response?.Data ?? null;
          set({ catalog, scopeStamp: catalog?.ScopeStamp ?? get().scopeStamp, error: null });
          return catalog;
        } catch (error) {
          logger.error({ message: 'Field Records catalog failed', context: { error } });
          set({ error: messageFrom(error) });
          return null;
        } finally {
          set({ isLoading: false });
        }
      },

      sync: async (options) => {
        if (get().isSyncing) {
          return;
        }
        set({ isSyncing: true });
        const full = options?.full === true;
        // A reset answers with no page, so the full re-pull is run after this one releases the
        // in-flight guard; recursing inside it would be swallowed by that same guard.
        let resetAndRetry = false;
        try {
          const response = await syncFieldRecords({
            ...catalogInput(get().context),
            Since: full ? 0 : get().lastSyncTimestampMs,
            ScopeStamp: full ? null : get().scopeStamp,
            Take: SYNC_TAKE,
            IncludeCatalog: true,
          });
          const bundle = response?.Data;
          if (!bundle) {
            return;
          }

          if (bundle.ResetRequired) {
            // Scope changed under us: everything cached for the old scope is dropped, including the
            // catalog. Staged drafts survive — they are this person's unsent work, not server state.
            set({
              catalog: bundle.Catalog ?? null,
              recent: [],
              drafts: [],
              assignments: [],
              scopeStamp: bundle.ScopeStamp ?? null,
              lastSyncTimestampMs: 0,
            });
            // Returning here would skip the retry below, since finally runs but the function exits.
            resetAndRetry = !full;
          } else {
            const tombstoned = new Set(bundle.Tombstones ?? []);
            const merged = new Map<string, RecordSummaryData>();
            for (const record of get().recent) {
              if (!tombstoned.has(record.RecordId)) {
                merged.set(record.RecordId, record);
              }
            }
            for (const record of bundle.Records ?? []) {
              if (record.IsTombstone || tombstoned.has(record.RecordId)) {
                merged.delete(record.RecordId);
                continue;
              }
              merged.set(record.RecordId, record);
            }

            set({
              catalog: bundle.Catalog ?? get().catalog,
              recent: [...merged.values()].sort((a, b) => (b.ModifiedOn ?? '').localeCompare(a.ModifiedOn ?? '')).slice(0, SYNC_TAKE),
              drafts: bundle.Drafts ?? [],
              assignments: bundle.Assignments ?? [],
              scopeStamp: bundle.ScopeStamp ?? get().scopeStamp,
              lastSyncTimestampMs: bundle.ServerTimestampMs > 0 ? bundle.ServerTimestampMs : get().lastSyncTimestampMs,
              error: bundle.Ok ? null : (bundle.Reasons ?? []).join(', '),
            });
          }
        } catch (error) {
          logger.error({ message: 'Field Records sync failed', context: { error } });
          get().report({ EventType: 'sync', Outcome: 'failed' });
          set({ error: messageFrom(error) });
        } finally {
          set({ isSyncing: false });
        }

        if (resetAndRetry) {
          await get().sync({ full: true });
        }
      },

      fetchSchema: async (definitionKey, version) => {
        const key = `${definitionKey}:${version}`;
        const cached = get().schemas[key];
        if (cached) {
          return cached;
        }
        try {
          const response = await getRecordDefinitionVersion(definitionKey, version);
          const schema = response?.Data?.Schema ?? null;
          if (schema) {
            set({ schemas: { ...get().schemas, [key]: schema } });
          }
          return schema;
        } catch (error) {
          logger.error({ message: 'Record definition schema fetch failed', context: { error, definitionKey, version } });
          return null;
        }
      },

      prefill: async (definitionKey, version) => {
        try {
          const response = await getFieldRecordPrefill({ ...catalogInput(get().context), DefinitionKey: definitionKey, Version: version });
          return response?.Data ?? null;
        } catch (error) {
          // Prefill is a convenience; a refusal leaves an empty form rather than blocking authoring.
          logger.warn({ message: 'Record prefill unavailable', context: { error, definitionKey, version } });
          return null;
        }
      },

      stageDraft: (draft) => {
        if (!mayKeepOnDevice(get().entryFor(draft.definitionKey, draft.definitionVersion))) {
          // A definition that seals values never leaves plaintext on the device, so one not confirmed safe is not staged.
          logger.info({ message: 'Draft not staged offline: definition is not confirmed to allow offline authoring', context: { definitionKey: draft.definitionKey } });
          return;
        }
        set({ pendingDrafts: { ...get().pendingDrafts, [draft.clientRecordId]: { ...draft, updatedOn: new Date().toISOString() } } });
      },

      discardDraft: (clientRecordId) => {
        const pending = { ...get().pendingDrafts };
        delete pending[clientRecordId];
        set({ pendingDrafts: pending });
      },

      pushDraft: async (clientRecordId, supplied) => {
        const draft = supplied ?? get().pendingDrafts[clientRecordId];
        if (!draft) {
          return { ok: false, error: 'not_found' };
        }
        try {
          const result = draft.recordId
            ? await saveRecordDraft({
                RecordId: draft.recordId,
                RowVersion: draft.rowVersion ?? null,
                Values: draft.values,
                IdempotencyKey: clientRecordId,
                OriginClient: RECORDS_ORIGIN_CLIENT,
              })
            : await createRecordDraft({
                DefinitionKey: draft.definitionKey,
                CallId: draft.callId ?? null,
                StationGroupId: draft.stationGroupId ?? null,
                Values: draft.values,
                IdempotencyKey: clientRecordId,
                ClientRecordId: clientRecordId,
                OriginClient: RECORDS_ORIGIN_CLIENT,
              });

          const recordId = result?.Data?.RecordId;
          if (!recordId) {
            throw new Error('The server did not return a record.');
          }
          get().discardDraft(clientRecordId);
          get().report({ EventType: 'draft_saved', Outcome: 'ok', RecordId: recordId, DefinitionKey: draft.definitionKey, DefinitionVersion: draft.definitionVersion });
          void get().sync();
          return { ok: true, recordId };
        } catch (error) {
          const conflict = conflictFrom(error);
          // Never replayed silently: the draft is kept and flagged so a person decides what happens —
          // unless its definition seals values, which are never left on the device. A draft already staged
          // passed that check when it was staged, so a catalog that has not loaded yet does not drop it.
          const entry = get().entryFor(draft.definitionKey, draft.definitionVersion);
          if (entry ? mayKeepOnDevice(entry) : clientRecordId in get().pendingDrafts) {
            set({
              pendingDrafts: {
                ...get().pendingDrafts,
                [clientRecordId]: { ...draft, lastError: messageFrom(error), conflict: conflict ?? null },
              },
            });
          }
          logger.error({ message: 'Record draft push failed', context: { error, clientRecordId, conflict } });
          get().report({ EventType: 'draft_saved', Outcome: conflict ?? 'failed', DefinitionKey: draft.definitionKey, DefinitionVersion: draft.definitionVersion });
          if (conflict) {
            get().report({ EventType: 'conflict', Outcome: conflict, DefinitionKey: draft.definitionKey });
          }
          return { ok: false, conflict, error: messageFrom(error) };
        }
      },

      pushAllDrafts: async () => {
        // Deliberately one at a time. Each push carries an idempotency key and the server compares
        // row versions; sending a device's whole backlog in parallel would turn one bad connection
        // into a burst of half-applied writes and conflicts that a person then has to untangle.
        for (const clientRecordId of Object.keys(get().pendingDrafts)) {
          const draft = get().pendingDrafts[clientRecordId];
          if (draft?.conflict) {
            // A conflicted draft waits for a person; retrying it in a loop would be the silent replay.
            continue;
          }
          await get().pushDraft(clientRecordId);
        }
      },

      submitForReview: async (recordId, rowVersion) => {
        try {
          await submitRecordForReview({ RecordId: recordId, RowVersion: rowVersion, OriginClient: RECORDS_ORIGIN_CLIENT, IdempotencyKey: `submit:${recordId}:${rowVersion}` });
          get().report({ EventType: 'completed', Outcome: 'submitted', RecordId: recordId });
          void get().sync();
          return { ok: true };
        } catch (error) {
          logger.error({ message: 'Submit for review failed', context: { error, recordId } });
          return { ok: false, error: messageFrom(error) };
        }
      },

      finalize: async (recordId, rowVersion, attested) => {
        try {
          await finalizeRecord({ RecordId: recordId, RowVersion: rowVersion, Attested: attested, OriginClient: RECORDS_ORIGIN_CLIENT, IdempotencyKey: `finalize:${recordId}:${rowVersion}` });
          get().report({ EventType: 'completed', Outcome: 'finalized', RecordId: recordId });
          void get().sync();
          return { ok: true };
        } catch (error) {
          logger.error({ message: 'Finalize failed', context: { error, recordId } });
          return { ok: false, error: messageFrom(error) };
        }
      },

      stageUpload: (upload) => {
        set({ pendingUploads: { ...get().pendingUploads, [upload.localId]: upload }, uploadProgress: { ...get().uploadProgress, [upload.localId]: upload.sentBytes } });
      },

      discardUpload: async (localId) => {
        const upload = get().pendingUploads[localId];
        // Hand the session back so its chunks are not left occupying server storage.
        const { cancelUpload } = loadUploader();
        await cancelUpload(upload?.uploadId ?? null);
        const uploads = { ...get().pendingUploads };
        const progress = { ...get().uploadProgress };
        delete uploads[localId];
        delete progress[localId];
        set({ pendingUploads: uploads, uploadProgress: progress });
      },

      retryUpload: async (localId) => {
        const upload = get().pendingUploads[localId];
        if (!upload || upload.isUnrecoverable) {
          return;
        }
        set({ pendingUploads: { ...get().pendingUploads, [localId]: { ...upload, lastError: null } } });
        await get().runUploads(upload.recordId);
      },

      runUploads: async (recordId) => {
        const uploads = Object.values(get().pendingUploads).filter((upload) => (recordId ? upload.recordId === recordId : true));
        let uploaded = 0;
        let failed = 0;
        if (uploads.length === 0) {
          return { uploaded, failed };
        }
        const { runUpload } = loadUploader();

        for (const upload of uploads) {
          // A file that is gone cannot be uploaded by trying again; it waits for the person instead.
          if (upload.isUnrecoverable) {
            continue;
          }
          const startedAt = Date.now();
          const outcome = await runUpload(upload, {
            onProgress: ({ sentBytes }) => set({ uploadProgress: { ...get().uploadProgress, [upload.localId]: sentBytes } }),
          });

          if (outcome.ok) {
            uploaded += 1;
            get().report({ EventType: 'attachment', Outcome: 'ok', RecordId: upload.recordId, DurationMs: Date.now() - startedAt, ItemCount: Math.round(upload.byteSize / 1024) });
            const remaining = { ...get().pendingUploads };
            const progress = { ...get().uploadProgress };
            delete remaining[upload.localId];
            delete progress[upload.localId];
            set({ pendingUploads: remaining, uploadProgress: progress });
            continue;
          }

          failed += 1;
          get().report({ EventType: 'attachment', Outcome: outcome.code ?? 'failed', RecordId: upload.recordId });
          set({
            pendingUploads: {
              ...get().pendingUploads,
              [upload.localId]: {
                ...upload,
                uploadId: outcome.uploadId ?? upload.uploadId,
                sentBytes: outcome.sentBytes ?? upload.sentBytes,
                lastError: outcome.message ?? outcome.code ?? 'failed',
                isUnrecoverable: outcome.code === 'file_missing',
              },
            },
          });
        }

        return { uploaded, failed };
      },

      report: (event) => {
        // Telemetry is bounded and best-effort: it queues, it batches, and it is dropped rather than
        // grown without limit. Nothing here carries record content — codes, counts and durations only.
        const queued = [...telemetryQueue, { ...event, OccurredOn: event.OccurredOn ?? new Date().toISOString() }];
        telemetryQueue = queued.slice(-TELEMETRY_MAX);
      },

      flushTelemetry: async () => {
        if (telemetryQueue.length === 0) {
          return;
        }
        const batch = telemetryQueue;
        telemetryQueue = [];
        try {
          await reportFieldRecordTelemetry({
            OriginClient: RECORDS_ORIGIN_CLIENT as number,
            AppVersion: Env.VERSION,
            ClientCapability: CLIENT_CAPABILITY,
            Events: batch,
          });
        } catch (error) {
          // A rollout number is never worth a retry storm; the batch is dropped and the next one goes.
          logger.info({ message: 'Field Records telemetry batch was dropped', context: { count: batch.length } });
        }
      },

      acknowledge: async (assignmentId, rowVersion) => {
        try {
          const response = await acknowledgeAssignmentApi({ AssignmentId: assignmentId, RowVersion: rowVersion, Context: get().context, OriginClient: RECORDS_ORIGIN_CLIENT });
          const updated = response?.Data;
          if (updated) {
            set({ assignments: get().assignments.map((assignment) => (assignment.AssignmentId === updated.AssignmentId ? updated : assignment)) });
          }
        } catch (error) {
          logger.error({ message: 'Acknowledge assignment failed', context: { error, assignmentId } });
          set({ error: messageFrom(error) });
        }
      },

      complete: async (assignmentId, rowVersion) => {
        try {
          await completeAssignmentApi({ AssignmentId: assignmentId, RowVersion: rowVersion, Context: get().context, OriginClient: RECORDS_ORIGIN_CLIENT });
          set({ assignments: get().assignments.filter((assignment) => assignment.AssignmentId !== assignmentId) });
        } catch (error) {
          logger.error({ message: 'Complete assignment failed', context: { error, assignmentId } });
          set({ error: messageFrom(error) });
        }
      },

      entryFor: (definitionKey, version) => {
        const definitions = get().catalog?.Definitions ?? [];
        return definitions.find((entry) => entry.DefinitionKey.toLowerCase() === definitionKey.toLowerCase() && (version === undefined || entry.Version === version)) ?? null;
      },

      reset: () => {
        // Queued telemetry belongs to the identity that produced it; a reset drops it rather than
        // letting the next session flush another member's counts under their own name.
        telemetryQueue = [];
        set({
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
          error: null,
          context: {},
        });
      },
    }),
    {
      name: 'records-field-storage',
      storage: createJSONStorage(() => zustandStorage),
      // Server-owned lists are re-fetched on every open; only the device's own unsent work, the sync
      // cursor and the scope it belongs to are worth keeping across launches.
      partialize: (state) => ({
        pendingDrafts: state.pendingDrafts,
        // Pending uploads persist so an app killed mid-upload resumes from the server's count.
        pendingUploads: state.pendingUploads,
        scopeStamp: state.scopeStamp,
        lastSyncTimestampMs: state.lastSyncTimestampMs,
      }),
    }
  )
);

export const useRecordsDraftCount = () => useRecordsStore((state) => Object.keys(state.pendingDrafts).length);

export const useOpenAssignments = () => useRecordsStore((state) => state.assignments.filter((assignment) => assignment.State === 'Open' || assignment.State === 'Acknowledged'));

export const useReturnedRecords = () => useRecordsStore((state) => state.drafts.filter((record) => record.State === RmsRecordState.Returned));

export const useOwnDrafts = () => useRecordsStore((state) => state.drafts.filter((record) => record.State === RmsRecordState.Draft));

export const buildValuesPayload = (values: ValueMap): RecordValueInput[] => toValueList(values);
