import {
  type FieldRecordAssignmentData,
  type FieldRecordCatalogData,
  type FieldRecordCatalogInput,
  type FieldRecordPrefillData,
  type FieldRecordPreflightData,
  type FieldRecordSyncData,
  type RecordsApiResult,
} from '@/models/v4/records';

import { createApiEndpoint } from '../common/client';

// v4 FieldRecords (RMS plan RMS-1D). The server derives the department, the app flag, the verified
// context and the Protected Data state from the authenticated principal; these inputs only narrow
// the response, so nothing here is a capability the client grants itself.

const preflightApi = createApiEndpoint('/FieldRecords/Preflight');
const catalogApi = createApiEndpoint('/FieldRecords/Catalog');
const prefillApi = createApiEndpoint('/FieldRecords/Prefill');
const syncApi = createApiEndpoint('/FieldRecords/Sync');
const assignmentsApi = createApiEndpoint('/FieldRecords/Assignments');
const recordAssignmentsApi = createApiEndpoint('/FieldRecords/RecordAssignments');
const acknowledgeAssignmentApi = createApiEndpoint('/FieldRecords/AcknowledgeAssignment');
const telemetryApi = createApiEndpoint('/FieldRecords/Telemetry');
const completeAssignmentApi = createApiEndpoint('/FieldRecords/CompleteAssignment');

export const getFieldRecordsPreflight = async (originClient: number, appVersion?: string | null, clientCapability?: string | null, signal?: AbortSignal) => {
  const response = await preflightApi.get<RecordsApiResult<FieldRecordPreflightData>>(
    {
      originClient,
      ...(appVersion ? { appVersion } : {}),
      ...(clientCapability ? { clientCapability } : {}),
    },
    signal
  );
  return response.data;
};

export const getFieldRecordsCatalog = async (input: FieldRecordCatalogInput, signal?: AbortSignal) => {
  const response = await catalogApi.post<RecordsApiResult<FieldRecordCatalogData>>(input as unknown as Record<string, unknown>, signal);
  return response.data;
};

export const getFieldRecordPrefill = async (input: FieldRecordCatalogInput & { DefinitionKey: string; Version: number }, signal?: AbortSignal) => {
  const response = await prefillApi.post<RecordsApiResult<FieldRecordPrefillData>>(input as unknown as Record<string, unknown>, signal);
  return response.data;
};

export interface FieldRecordSyncInput extends FieldRecordCatalogInput {
  Since?: number;
  SinceId?: string | null;
  ScopeStamp?: string | null;
  Take?: number;
  IncludeCatalog?: boolean;
}

export const syncFieldRecords = async (input: FieldRecordSyncInput, signal?: AbortSignal) => {
  const response = await syncApi.post<RecordsApiResult<FieldRecordSyncData>>(input as unknown as Record<string, unknown>, signal);
  return response.data;
};

export const getFieldRecordAssignments = async (input: FieldRecordCatalogInput, signal?: AbortSignal) => {
  const response = await assignmentsApi.post<RecordsApiResult<FieldRecordAssignmentData[]>>(input as unknown as Record<string, unknown>, signal);
  return response.data;
};

export const getAssignmentsForRecord = async (recordId: string, signal?: AbortSignal) => {
  const response = await recordAssignmentsApi.get<RecordsApiResult<FieldRecordAssignmentData[]>>({ recordId }, signal);
  return response.data;
};

export interface FieldRecordAssignmentCommandInput {
  AssignmentId: string;
  RowVersion?: number | null;
  Reason?: string | null;
  Context?: FieldRecordCatalogInput['Context'];
  OriginClient?: number | null;
}

export interface FieldRecordTelemetryBatch {
  OriginClient: number;
  AppVersion?: string | null;
  ClientCapability?: string | null;
  Events: {
    EventType: string;
    Outcome?: string;
    DefinitionKey?: string;
    DefinitionVersion?: number;
    RecordId?: string;
    DurationMs?: number;
    ItemCount?: number;
    OccurredOn?: string;
  }[];
}

/** Bounded, coded rollout datapoints (RMS plan RMS-1D). Counts and outcomes only, never content. */
export const reportFieldRecordTelemetry = async (batch: FieldRecordTelemetryBatch, signal?: AbortSignal) => {
  const response = await telemetryApi.post<RecordsApiResult<{ Accepted: number }>>(batch as unknown as Record<string, unknown>, signal);
  return response.data;
};

export const acknowledgeAssignment = async (input: FieldRecordAssignmentCommandInput, signal?: AbortSignal) => {
  const response = await acknowledgeAssignmentApi.post<RecordsApiResult<FieldRecordAssignmentData>>(input as unknown as Record<string, unknown>, signal);
  return response.data;
};

export const completeAssignment = async (input: FieldRecordAssignmentCommandInput, signal?: AbortSignal) => {
  const response = await completeAssignmentApi.post<RecordsApiResult<FieldRecordAssignmentData>>(input as unknown as Record<string, unknown>, signal);
  return response.data;
};
