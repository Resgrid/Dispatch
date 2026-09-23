import { api } from '@/api/common/client';
import type {
  CalOesMarsAccess,
  CalOesMarsQueueItem,
  CalOesMarsValidation,
  CalOesMarsWorkItem,
  Deployment,
  DeploymentAccess,
  Expense,
  ExpenseInput,
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

/** Who a new report covers: one deployed unit's crew (CTR), one person, or — managers only — the whole deployment. */
export interface TimeReportScopeInput {
  deploymentUnitId?: string | null;
  deploymentPersonnelId?: string | null;
}

// Reports come back with their entries so a day's report opens straight from the list.
export const getTimeReports = async (deploymentId: string) => (await api.get<OperationsResult<TimeReport[]>>('/TimeReports/GetTimeReports', { params: { deploymentId } })).data.Data;
export const getTimeReport = async (id: string) => (await api.get<OperationsResult<TimeReport>>('/TimeReports/GetTimeReport', { params: { id } })).data.Data;
export const newTimeReport = async (deploymentId: string, reportDate: string, scope: TimeReportScopeInput = {}) =>
  (
    await api.post<TimeReportResponse>('/TimeReports/NewTimeReport', {
      DeploymentId: deploymentId,
      ReportDate: reportDate,
      DeploymentUnitId: scope.deploymentUnitId ?? null,
      DeploymentPersonnelId: scope.deploymentPersonnelId ?? null,
    })
  ).data;
// The server replaces the entries of the subjects the caller may write with what it is sent; everyone else's stay as stored.
// Only the local wall clock travels (StartLocal/EndLocal): the server converts it in the department's zone.
export const saveTimeEntries = async (timeReportId: string, entries: TimeEntry[]) =>
  (
    await api.post<TimeReportResponse>('/TimeReports/SaveTimeEntries', {
      TimeReportId: timeReportId,
      Entries: entries.map(({ StartTime: _start, EndTime: _end, Hours: _hours, ...entry }) => entry),
    })
  ).data;
export const submitTimeReport = async (id: string) => (await api.post<TimeReportResponse>('/TimeReports/SubmitTimeReport', { Id: id })).data;
/** The crew boss signs as the acting user; the customer (agency) signer is a typed name. */
export const signTimeReport = async (id: string, contractorSigned: boolean, customerSignerName?: string | null) =>
  (await api.post<TimeReportResponse>('/TimeReports/SignTimeReport', { Id: id, ContractorSigned: contractorSigned, CustomerSignerName: customerSignerName || null })).data;
export const approveTimeReport = async (id: string) => (await api.post<TimeReportResponse>('/TimeReports/ApproveTimeReport', { Id: id })).data;

export const getExpenses = async (deploymentId: string) => (await api.get<OperationsResult<Expense[]>>('/TimeReports/GetExpenses', { params: { deploymentId } })).data.Data;
// Receipts ride as base64; allow a slower link than the default request timeout.
export const saveExpense = async (input: ExpenseInput) => (await api.post<OperationsResult<Expense>>('/TimeReports/SaveExpense', input, { timeout: 60000 })).data.Data;
export const deleteExpense = async (id: string) => (await api.delete<OperationsResult<null>>('/TimeReports/DeleteExpense', { params: { id } })).data;

export const getFieldCostAccess = async () => (await api.get<OperationsResult<FieldCostAccess>>('/FieldCost/GetAccess')).data.Data;
export const getResourceUsage = async (deploymentId: string) => (await api.get<OperationsResult<ResourceUsage[]>>('/FieldCost/GetResourceUsage', { params: { deploymentId } })).data.Data;
export const addResourceUsage = async (input: ResourceUsageInput) => (await api.post<OperationsResult<ResourceUsage>>('/FieldCost/AddResourceUsage', input)).data.Data;

export const getCalOesMarsAccess = async () => (await api.get<OperationsResult<CalOesMarsAccess>>('/CalOesMars/GetAccess')).data.Data;
export const getCalOesMarsQueue = async () => (await api.get<OperationsResult<CalOesMarsQueueItem[]>>('/CalOesMars/GetQueue')).data.Data;
export const getCalOesMarsWorkItem = async (id: string) => (await api.get<OperationsResult<CalOesMarsWorkItem>>('/CalOesMars/GetWorkItem', { params: { id } })).data.Data;
export const buildF42 = async (deploymentId: string) => (await api.post<OperationsResult<CalOesMarsWorkItem>>('/CalOesMars/BuildF42', { DeploymentId: deploymentId })).data.Data;
export const validateCalOesMarsWorkItem = async (id: string) => (await api.post<OperationsResult<CalOesMarsValidation>>('/CalOesMars/Validate', null, { params: { id } })).data.Data;
