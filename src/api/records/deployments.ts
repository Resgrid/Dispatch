import { type RecordsApiResult } from '@/models/v4/records';
import { type RecordDeploymentConnectorData, type RecordDeploymentConnectorRunData, type RecordDeploymentData, type RecordDeploymentReconciliationData } from '@/models/v4/records/deployments';

import { createApiEndpoint } from '../common/client';

// v4 RecordDeployments and RecordDeploymentConnectors (RMS plan section 4.1). Deployments need
// Record_View; every connector call is department administration and the server refuses anyone else.
// The only command here is Run ("read the feed now"). Create, update, enable, terms acknowledgement,
// token rotation and delete stay Web-first — a credential is never typed on a phone — so they are
// deliberately absent.

const listDeploymentsApi = createApiEndpoint('/RecordDeployments/List');
const getDeploymentApi = createApiEndpoint('/RecordDeployments/Get');
const listConnectorsApi = createApiEndpoint('/RecordDeploymentConnectors/List');
const getConnectorApi = createApiEndpoint('/RecordDeploymentConnectors/Get');
const connectorRunsApi = createApiEndpoint('/RecordDeploymentConnectors/Runs');
const reconciliationApi = createApiEndpoint('/RecordDeploymentConnectors/Reconciliation');

export const getRecordDeployments = async (includeClosed = false, signal?: AbortSignal) => {
  const response = await listDeploymentsApi.get<RecordsApiResult<RecordDeploymentData[]>>({ includeClosed }, signal);
  return response.data;
};

export const getRecordDeployment = async (id: string, signal?: AbortSignal) => {
  const response = await getDeploymentApi.get<RecordsApiResult<RecordDeploymentData>>({ id }, signal);
  return response.data;
};

export const getRecordDeploymentConnectors = async (signal?: AbortSignal) => {
  const response = await listConnectorsApi.get<RecordsApiResult<RecordDeploymentConnectorData[]>>(undefined, signal);
  return response.data;
};

export const getRecordDeploymentConnector = async (id: string, signal?: AbortSignal) => {
  const response = await getConnectorApi.get<RecordsApiResult<RecordDeploymentConnectorData>>({ id }, signal);
  return response.data;
};

export const getRecordDeploymentConnectorRuns = async (id: string, take = 50, signal?: AbortSignal) => {
  const response = await connectorRunsApi.get<RecordsApiResult<RecordDeploymentConnectorRunData[]>>({ id, take }, signal);
  return response.data;
};

export const getRecordDeploymentReconciliation = async (connectorId?: string | null, signal?: AbortSignal) => {
  const response = await reconciliationApi.get<RecordsApiResult<RecordDeploymentReconciliationData[]>>(connectorId ? { id: connectorId } : undefined, signal);
  return response.data;
};

/** Reads the connector's feed now. The server binds the id from the query, so the endpoint carries it. */
export const runRecordDeploymentConnector = async (id: string, signal?: AbortSignal) => {
  const runApi = createApiEndpoint(`/RecordDeploymentConnectors/Run?id=${encodeURIComponent(id)}`);
  const response = await runApi.post<RecordsApiResult<RecordDeploymentConnectorRunData>>({}, signal);
  return response.data;
};
