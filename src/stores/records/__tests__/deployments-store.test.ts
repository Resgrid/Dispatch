import { useDeploymentsStore } from '@/stores/records/deployments-store';

// Deployments and connector store conformance (RMS plan section 4.1). Identical in all four app
// repositories: the store reads, it issues exactly one command, and a refusal stays a refusal.

jest.mock('@/api/records/deployments', () => ({
  getRecordDeployments: jest.fn(),
  getRecordDeployment: jest.fn(),
  getRecordDeploymentConnectors: jest.fn(),
  getRecordDeploymentConnector: jest.fn(),
  getRecordDeploymentConnectorRuns: jest.fn(),
  getRecordDeploymentReconciliation: jest.fn(),
  runRecordDeploymentConnector: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const api = jest.requireMock('@/api/records/deployments');

const deployment = (orderId: string, modifiedOn: string, status = 'Open') => ({
  OrderId: orderId,
  ProfileKey: 'local-mutual-aid',
  ProfileVersion: 1,
  SourceScheme: 'local',
  OrderNumber: orderId.toUpperCase(),
  IncidentName: 'Bear Creek',
  HasArtifact: false,
  Status: status,
  OwnershipMarker: 'connector',
  ConnectorId: 'c1',
  AllReturned: false,
  IsPreview: true,
  CreatedOn: modifiedOn,
  ModifiedOn: modifiedOn,
  RowVersion: 1,
  Fills: [],
});

const connector = (id: string, name: string, ready = true) => ({
  Id: id,
  ProviderKey: 'generic-feed',
  Name: name,
  SourceScheme: 'local',
  ProfileKey: 'local-mutual-aid',
  BaseUrl: 'https://orders.example.gov/feed',
  CredentialKind: 'bearer',
  HasCredential: true,
  HasInboundToken: true,
  ReadEnabled: true,
  WriteEnabled: false,
  PollIntervalMinutes: 30,
  MaxRequestsPerHour: 12,
  RequestsThisHour: 1,
  IsEnabled: ready,
  IsReadyToRun: ready,
  ConsecutiveFailures: 0,
  CreatedOn: '2026-09-06T00:00:00Z',
  ModifiedOn: '2026-09-06T00:00:00Z',
  RowVersion: 1,
});

const run = (id: string, outcome = 'ok') => ({
  Id: id,
  ConnectorId: 'c1',
  Trigger: 'manual',
  StartedOn: '2026-09-06T12:00:00Z',
  Outcome: outcome,
  Error: outcome === 'ok' ? null : 'The source answered 503 Service Unavailable.',
  RequestCount: 1,
  OrdersSeen: 2,
  OrdersCreated: 1,
  SnapshotsRecorded: 1,
  RequestsAdded: 1,
  Unchanged: 0,
  Rejected: 0,
  Conflicts: 1,
  Messages: [],
});

const forbidden = () => Object.assign(new Error('Request failed with status code 403'), { response: { status: 403 } });

describe('Deployments store conformance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDeploymentsStore.getState().reset();
  });

  it('holds the department deployments newest first and remembers the closed filter', async () => {
    api.getRecordDeployments.mockResolvedValue({ Data: [deployment('o1', '2026-09-01T00:00:00Z'), deployment('o2', '2026-09-03T00:00:00Z', 'ClosedOut')] });

    const list = await useDeploymentsStore.getState().fetchDeployments({ includeClosed: true });

    expect(api.getRecordDeployments).toHaveBeenCalledWith(true);
    expect(list.map((d) => d.OrderId)).toEqual(['o2', 'o1']);
    expect(useDeploymentsStore.getState().includeClosed).toBe(true);
    expect(useDeploymentsStore.getState().lastFetchedOn).not.toBeNull();
    expect(useDeploymentsStore.getState().error).toBeNull();
  });

  it('keeps what it had and surfaces the error when the list cannot be read', async () => {
    useDeploymentsStore.setState({ deployments: [deployment('o1', '2026-09-01T00:00:00Z')] });
    api.getRecordDeployments.mockRejectedValue(new Error('offline'));

    const list = await useDeploymentsStore.getState().fetchDeployments();

    expect(list).toHaveLength(1);
    expect(useDeploymentsStore.getState().error).toBe('offline');
    expect(useDeploymentsStore.getState().isLoading).toBe(false);
  });

  it('upserts a single deployment and drops one the server no longer returns', async () => {
    useDeploymentsStore.setState({ deployments: [deployment('o1', '2026-09-01T00:00:00Z'), deployment('o2', '2026-09-02T00:00:00Z')] });
    api.getRecordDeployment.mockResolvedValueOnce({ Data: deployment('o1', '2026-09-05T00:00:00Z', 'Mobilized') }).mockResolvedValueOnce({ Data: null });

    const fresh = await useDeploymentsStore.getState().fetchDeployment('o1');
    expect(fresh?.Status).toBe('Mobilized');
    expect(useDeploymentsStore.getState().deployments.map((d) => d.OrderId)).toEqual(['o1', 'o2']);

    const gone = await useDeploymentsStore.getState().fetchDeployment('o2');
    expect(gone).toBeNull();
    expect(useDeploymentsStore.getState().deployments.map((d) => d.OrderId)).toEqual(['o1']);
    expect(useDeploymentsStore.getState().error).toBe('not_found');
  });

  it('replaces only one connector slice of the reconciliation when asked for that connector', async () => {
    useDeploymentsStore.setState({
      reconciliation: [
        { ConnectorId: 'c1', OrderId: 'o1', OrderNumber: 'O1', Kind: 'source_status_ahead', RequestNumber: 'O-1' },
        { ConnectorId: 'c2', OrderId: 'o9', OrderNumber: 'O9', Kind: 'source_closed_local_open' },
      ],
    });
    api.getRecordDeploymentReconciliation.mockResolvedValue({ Data: [{ ConnectorId: 'c1', OrderId: 'o1', OrderNumber: 'O1', Kind: 'local_fill_missing_in_source', RequestNumber: 'L-7' }] });

    await useDeploymentsStore.getState().fetchReconciliation('c1');

    expect(api.getRecordDeploymentReconciliation).toHaveBeenCalledWith('c1');
    expect(useDeploymentsStore.getState().reconciliation.map((i) => `${i.ConnectorId}:${i.Kind}`)).toEqual(['c2:source_closed_local_open', 'c1:local_fill_missing_in_source']);

    api.getRecordDeploymentReconciliation.mockResolvedValue({ Data: [] });
    await useDeploymentsStore.getState().fetchReconciliation();
    expect(useDeploymentsStore.getState().reconciliation).toEqual([]);
  });

  it('shows a refusal as a refusal rather than retrying or hiding it', async () => {
    api.getRecordDeploymentConnectors.mockRejectedValue(forbidden());

    const connectors = await useDeploymentsStore.getState().fetchConnectors();

    expect(connectors).toEqual([]);
    expect(useDeploymentsStore.getState().connectorsError).toBe('forbidden');
    expect(api.getRecordDeploymentConnectors).toHaveBeenCalledTimes(1);
  });

  it('lists connectors by name and keeps their run logs per connector', async () => {
    api.getRecordDeploymentConnectors.mockResolvedValue({ Data: [connector('c2', 'Zulu'), connector('c1', 'Alpha', false)] });
    api.getRecordDeploymentConnectorRuns.mockResolvedValue({ Data: [run('r1'), run('r0', 'failed')] });

    const connectors = await useDeploymentsStore.getState().fetchConnectors();
    const runs = await useDeploymentsStore.getState().fetchRuns('c1');

    expect(connectors.map((c) => c.Name)).toEqual(['Alpha', 'Zulu']);
    expect(runs.map((r) => r.Id)).toEqual(['r1', 'r0']);
    expect(useDeploymentsStore.getState().runs.c1).toHaveLength(2);
    expect(useDeploymentsStore.getState().runs.c2).toBeUndefined();
  });

  it('reads the feed now, records the run first in the log, then re-reads everything the run may have changed', async () => {
    useDeploymentsStore.setState({ connectors: [connector('c1', 'Alpha')], runs: { c1: [run('r0')] } });
    api.runRecordDeploymentConnector.mockResolvedValue({ Data: run('r1') });
    api.getRecordDeploymentConnector.mockResolvedValue({ Data: { ...connector('c1', 'Alpha'), LastPolledOn: '2026-09-06T12:00:00Z' } });
    api.getRecordDeploymentReconciliation.mockResolvedValue({ Data: [{ ConnectorId: 'c1', OrderId: 'o1', OrderNumber: 'O1', Kind: 'source_status_ahead' }] });
    api.getRecordDeployments.mockResolvedValue({ Data: [deployment('o1', '2026-09-06T12:00:00Z')] });

    const result = await useDeploymentsStore.getState().runConnector('c1');

    expect(result.ok).toBe(true);
    expect(result.run?.Id).toBe('r1');
    expect(api.runRecordDeploymentConnector).toHaveBeenCalledWith('c1');
    const state = useDeploymentsStore.getState();
    expect(state.runs.c1.map((r) => r.Id)).toEqual(['r1', 'r0']);
    expect(state.connectors[0].LastPolledOn).toBe('2026-09-06T12:00:00Z');
    expect(state.reconciliation).toHaveLength(1);
    expect(state.deployments).toHaveLength(1);
    expect(state.runningConnectorId).toBeNull();
  });

  it('reports a run that did not succeed with the server outcome and refuses to overlap runs', async () => {
    api.runRecordDeploymentConnector.mockResolvedValue({ Data: run('r1', 'rate_limited') });
    api.getRecordDeploymentConnector.mockResolvedValue({ Data: connector('c1', 'Alpha') });
    api.getRecordDeploymentReconciliation.mockResolvedValue({ Data: [] });
    api.getRecordDeployments.mockResolvedValue({ Data: [] });

    const result = await useDeploymentsStore.getState().runConnector('c1');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('503');

    useDeploymentsStore.setState({ runningConnectorId: 'c9' });
    const overlapped = await useDeploymentsStore.getState().runConnector('c1');
    expect(overlapped).toEqual({ ok: false, error: 'busy' });
    expect(api.runRecordDeploymentConnector).toHaveBeenCalledTimes(1);
  });

  it('turns a refused run into a refusal and clears the running flag', async () => {
    api.runRecordDeploymentConnector.mockRejectedValue(forbidden());

    const result = await useDeploymentsStore.getState().runConnector('c1');

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(useDeploymentsStore.getState().runningConnectorId).toBeNull();
    expect(useDeploymentsStore.getState().connectorsError).toBe('forbidden');
  });

  it('reset drops everything, including connector rows that must not outlive the session', () => {
    useDeploymentsStore.setState({ deployments: [deployment('o1', '2026-09-01T00:00:00Z')], connectors: [connector('c1', 'Alpha')], runs: { c1: [run('r1')] }, reconciliation: [], error: 'x', connectorsError: 'y' });

    useDeploymentsStore.getState().reset();

    const state = useDeploymentsStore.getState();
    expect(state.deployments).toEqual([]);
    expect(state.connectors).toEqual([]);
    expect(state.runs).toEqual({});
    expect(state.error).toBeNull();
    expect(state.connectorsError).toBeNull();
  });
});
