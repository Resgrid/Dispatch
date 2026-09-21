import { type RecordCommandInput, type RecordCreateDraftInput, type RecordData, type RecordDefinitionVersionData, type RecordsApiResult, type RecordSaveDraftInput } from '@/models/v4/records';

import { createApiEndpoint } from '../common/client';

// v4 Records authoring, and the definition version the renderer draws from. Lifecycle actions a field
// client may issue are create, save, submit-for-review, finalize and cancel; amendment, void and
// approval stay Web-first, so they are deliberately absent here.

const getRecordApi = createApiEndpoint('/Records/GetRecord');
const createDraftApi = createApiEndpoint('/Records/CreateDraft');
const saveDraftApi = createApiEndpoint('/Records/SaveDraft');
const submitForReviewApi = createApiEndpoint('/Records/SubmitForReview');
const finalizeApi = createApiEndpoint('/Records/Finalize');
const cancelApi = createApiEndpoint('/Records/Cancel');
const definitionVersionApi = createApiEndpoint('/RecordDefinitions/Version');

export const getRecord = async (id: string, signal?: AbortSignal) => {
  const response = await getRecordApi.get<RecordsApiResult<RecordData>>({ id }, signal);
  return response.data;
};

export const getRecordDefinitionVersion = async (key: string, version: number, signal?: AbortSignal) => {
  const response = await definitionVersionApi.get<RecordsApiResult<RecordDefinitionVersionData>>({ key, version }, signal);
  return response.data;
};

export const createRecordDraft = async (input: RecordCreateDraftInput, signal?: AbortSignal) => {
  const response = await createDraftApi.post<RecordsApiResult<RecordData>>(input as unknown as Record<string, unknown>, signal);
  return response.data;
};

export const saveRecordDraft = async (input: RecordSaveDraftInput, signal?: AbortSignal) => {
  const response = await saveDraftApi.post<RecordsApiResult<RecordData>>(input as unknown as Record<string, unknown>, signal);
  return response.data;
};

export const submitRecordForReview = async (input: RecordCommandInput, signal?: AbortSignal) => {
  const response = await submitForReviewApi.post<RecordsApiResult<RecordData>>(input as unknown as Record<string, unknown>, signal);
  return response.data;
};

export const finalizeRecord = async (input: RecordCommandInput, signal?: AbortSignal) => {
  const response = await finalizeApi.post<RecordsApiResult<RecordData>>(input as unknown as Record<string, unknown>, signal);
  return response.data;
};

export const cancelRecord = async (input: RecordCommandInput, signal?: AbortSignal) => {
  const response = await cancelApi.post<RecordsApiResult<RecordData>>(input as unknown as Record<string, unknown>, signal);
  return response.data;
};
