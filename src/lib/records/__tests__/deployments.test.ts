import {
  connectorStateAction,
  deploymentStatusAction,
  fillStatusAction,
  formatWhen,
  isConnectorOwned,
  reconciliationCounts,
  reconciliationFor,
  runOutcomeAction,
  sortDeployments,
  statusKey,
  upsertDeployment,
} from '@/lib/records/deployments';
import { type RecordDeploymentData, type RecordDeploymentReconciliationData } from '@/models/v4/records/deployments';

// Presentation helpers for deployments and connectors (RMS plan section 4.1). Identical in all four
// app repositories: what a status looks like must not drift between Responder, Unit, IC and Dispatch.

const deployment = (orderId: string, modifiedOn: string, extra: Partial<RecordDeploymentData> = {}): RecordDeploymentData => ({
  OrderId: orderId,
  ProfileKey: 'us-wildland',
  ProfileVersion: 1,
  SourceScheme: 'iroc',
  OrderNumber: orderId.toUpperCase(),
  IncidentName: 'Bear Creek',
  HasArtifact: false,
  Status: 'Open',
  AllReturned: false,
  IsPreview: true,
  CreatedOn: modifiedOn,
  ModifiedOn: modifiedOn,
  RowVersion: 1,
  Fills: [],
  ...extra,
});

const item = (orderId: string, kind: string, requestNumber?: string): RecordDeploymentReconciliationData => ({ OrderId: orderId, OrderNumber: orderId.toUpperCase(), Kind: kind, RequestNumber: requestNumber });

describe('deployment presentation helpers', () => {
  it('recognises a connector-maintained order from the ownership marker only', () => {
    expect(isConnectorOwned(deployment('o1', '2026-09-06', { OwnershipMarker: 'connector' }))).toBe(true);
    expect(isConnectorOwned(deployment('o1', '2026-09-06', { OwnershipMarker: 'Connector' }))).toBe(true);
    expect(isConnectorOwned(deployment('o1', '2026-09-06', { OwnershipMarker: 'manual', ConnectorId: 'c1' }))).toBe(false);
    expect(isConnectorOwned(deployment('o1', '2026-09-06'))).toBe(false);
    expect(isConnectorOwned(null)).toBe(false);
  });

  it('maps every order and fill status the server can send onto a badge tone', () => {
    expect(['Open', 'Mobilized', 'Released', 'ClosedOut'].map(deploymentStatusAction)).toEqual(['info', 'warning', 'success', 'muted']);
    expect(['Requested', 'Accepted', 'Declined', 'Mobilized', 'CheckedIn', 'Assigned', 'Released', 'Demobilized', 'Returned'].map(fillStatusAction)).toEqual([
      'muted',
      'info',
      'error',
      'warning',
      'warning',
      'info',
      'success',
      'success',
      'success',
    ]);
    expect(fillStatusAction('SomethingNew')).toBe('muted');
    expect(deploymentStatusAction(undefined)).toBe('muted');
  });

  it('turns an API status name into its translation suffix', () => {
    expect(statusKey('CheckedIn')).toBe('checked_in');
    expect(statusKey('ClosedOut')).toBe('closed_out');
    expect(statusKey('Open')).toBe('open');
    expect(statusKey(null)).toBe('');
  });

  it('tones run outcomes and connector states from the server flags', () => {
    expect(['ok', 'failed', 'rate_limited', 'rejected', 'disabled'].map(runOutcomeAction)).toEqual(['success', 'error', 'warning', 'warning', 'muted']);
    expect(connectorStateAction({ IsEnabled: true, IsReadyToRun: true })).toBe('success');
    expect(connectorStateAction({ IsEnabled: true, IsReadyToRun: false })).toBe('warning');
    expect(connectorStateAction({ IsEnabled: false, IsReadyToRun: false })).toBe('muted');
  });

  it('filters and counts reconciliation items per order without reordering them', () => {
    const items = [item('o1', 'source_status_ahead', 'O-1'), item('o2', 'source_closed_local_open'), item('o1', 'local_fill_missing_in_source', 'L-7')];
    expect(reconciliationFor(items, 'o1').map((i) => i.RequestNumber)).toEqual(['O-1', 'L-7']);
    expect(reconciliationFor(items, undefined)).toEqual([]);
    expect(reconciliationCounts(items)).toEqual({ o1: 2, o2: 1 });
  });

  it('formats a server timestamp for display and never throws on a bad one', () => {
    expect(formatWhen('2026-09-06T12:30:00Z')).toMatch(/2026-09-06/);
    expect(formatWhen(undefined)).toBe('');
    expect(formatWhen('not a date')).toBe('');
  });

  it('sorts newest first and upserts without duplicating an order', () => {
    const list = sortDeployments([deployment('o1', '2026-09-01T00:00:00Z'), deployment('o2', '2026-09-03T00:00:00Z'), deployment('o3', '2026-09-02T00:00:00Z')]);
    expect(list.map((d) => d.OrderId)).toEqual(['o2', 'o3', 'o1']);

    const updated = upsertDeployment(list, deployment('o1', '2026-09-04T00:00:00Z', { Status: 'Mobilized' }));
    expect(updated.map((d) => d.OrderId)).toEqual(['o1', 'o2', 'o3']);
    expect(updated).toHaveLength(3);
    expect(updated[0].Status).toBe('Mobilized');
  });
});
