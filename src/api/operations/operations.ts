import { api } from '@/api/common/client';
import type {
  CalOesMarsAccess,
  CalOesMarsQueueItem,
  CalOesMarsValidation,
  CalOesMarsWorkItem,
  Deployment,
  DeploymentAccess,
  FieldCostAccess,
  OperationsResult,
  ResourceUsage,
  ResourceUsageInput,
  TimeEntry,
  TimeReport,
  TimeReportResponse,
} from '@/models/v4/operations';

// Deliberately uncached: access answers and open reports change under the person during a shift, and
// a stale "enabled" would let a screen render after the department turned the feature off.
export const getDeploymentAccess = async () => (await api.get<OperationsResult<DeploymentAccess>>('/Deployments/GetAccess')).data.Data;
export const getDeployments = async (active = true) => (await api.get<OperationsResult<Deployment[]>>('/Deployments/GetDeployments', { params: { active, skip: 0, take: 100 } })).data.Data;
export const getDeployment = async (id: string) => (await api.get<OperationsResult<Deployment>>('/Deployments/GetDeployment', { params: { id } })).data.Data;
export const getDeploymentByCallId = async (callId: number) => (await api.get<OperationsResult<Deployment>>('/Deployments/GetDeploymentByCallId', { params: { callId } })).data.Data;

export const getTimeReports = async (deploymentId: string) => (await api.get<OperationsResult<TimeReport[]>>('/TimeReports/GetTimeReports', { params: { deploymentId } })).data.Data;
export const getTimeReport = async (id: string) => (await api.get<OperationsResult<TimeReport>>('/TimeReports/GetTimeReport', { params: { id } })).data.Data;
export const newTimeReport = async (deploymentId: string, reportDate: string) => (await api.post<TimeReportResponse>('/TimeReports/NewTimeReport', { DeploymentId: deploymentId, ReportDate: reportDate })).data;
// The whole entry list is the unit of save: the server replaces the report's entries with what it is sent.
export const saveTimeEntries = async (timeReportId: string, entries: TimeEntry[]) => (await api.post<TimeReportResponse>('/TimeReports/SaveTimeEntries', { TimeReportId: timeReportId, Entries: entries })).data;
export const submitTimeReport = async (id: string) => (await api.post<TimeReportResponse>('/TimeReports/SubmitTimeReport', { Id: id })).data;

export const getFieldCostAccess = async () => (await api.get<OperationsResult<FieldCostAccess>>('/FieldCost/GetAccess')).data.Data;
export const getResourceUsage = async (deploymentId: string) => (await api.get<OperationsResult<ResourceUsage[]>>('/FieldCost/GetResourceUsage', { params: { deploymentId } })).data.Data;
export const addResourceUsage = async (input: ResourceUsageInput) => (await api.post<OperationsResult<ResourceUsage>>('/FieldCost/AddResourceUsage', input)).data.Data;

export const getCalOesMarsAccess = async () => (await api.get<OperationsResult<CalOesMarsAccess>>('/CalOesMars/GetAccess')).data.Data;
export const getCalOesMarsQueue = async () => (await api.get<OperationsResult<CalOesMarsQueueItem[]>>('/CalOesMars/GetQueue')).data.Data;
export const getCalOesMarsWorkItem = async (id: string) => (await api.get<OperationsResult<CalOesMarsWorkItem>>('/CalOesMars/GetWorkItem', { params: { id } })).data.Data;
export const buildF42 = async (deploymentId: string) => (await api.post<OperationsResult<CalOesMarsWorkItem>>('/CalOesMars/BuildF42', { DeploymentId: deploymentId })).data.Data;
export const validateCalOesMarsWorkItem = async (id: string) => (await api.post<OperationsResult<CalOesMarsValidation>>('/CalOesMars/Validate', null, { params: { id } })).data.Data;
