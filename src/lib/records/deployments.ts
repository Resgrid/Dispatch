import { formatDateForDisplay, parseDateISOString } from '@/lib/utils';
import { type RecordDeploymentConnectorData, type RecordDeploymentData, type RecordDeploymentReconciliationData, RmsConnectorRunOutcomes, RmsExternalOrderOwnership } from '@/models/v4/records/deployments';

// Presentation helpers for deployments and connectors (RMS plan section 4.1). Pure functions over the
// server's data: nothing here decides what a person may see or do, only how what came back is shown.

export type BadgeAction = 'muted' | 'info' | 'warning' | 'success' | 'error';

/** A server timestamp for display, or an empty string when it is missing or unparsable. */
export const formatWhen = (timestamp: string | null | undefined, format = 'yyyy-MM-dd HH:mm'): string => {
  if (!timestamp) {
    return '';
  }
  try {
    const parsed = parseDateISOString(timestamp);
    // Older utils return an Invalid Date instead of throwing; either way the row shows nothing rather than NaN.
    return Number.isNaN(parsed.getTime()) ? '' : formatDateForDisplay(parsed, format);
  } catch {
    return '';
  }
};

/** True when an external ordering-system connector maintains this order's snapshots. */
export const isConnectorOwned = (deployment: Pick<RecordDeploymentData, 'OwnershipMarker'> | null | undefined): boolean => (deployment?.OwnershipMarker ?? '').toLowerCase() === RmsExternalOrderOwnership.Connector;

export const deploymentStatusAction = (status: string | null | undefined): BadgeAction => {
  switch ((status ?? '').toLowerCase()) {
    case 'open':
      return 'info';
    case 'mobilized':
      return 'warning';
    case 'released':
      return 'success';
    case 'closedout':
      return 'muted';
    default:
      return 'muted';
  }
};

export const fillStatusAction = (status: string | null | undefined): BadgeAction => {
  switch ((status ?? '').toLowerCase()) {
    case 'requested':
      return 'muted';
    case 'accepted':
    case 'assigned':
      return 'info';
    case 'mobilized':
    case 'checkedin':
      return 'warning';
    case 'released':
    case 'demobilized':
    case 'returned':
      return 'success';
    case 'declined':
      return 'error';
    default:
      return 'muted';
  }
};

/** Translation suffix for a status name as the API spells it (CheckedIn -> checked_in). */
export const statusKey = (status: string | null | undefined): string => (status ?? '').replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();

export const runOutcomeAction = (outcome: string | null | undefined): BadgeAction => {
  switch ((outcome ?? '').toLowerCase()) {
    case RmsConnectorRunOutcomes.Ok:
      return 'success';
    case RmsConnectorRunOutcomes.Failed:
      return 'error';
    case RmsConnectorRunOutcomes.RateLimited:
    case RmsConnectorRunOutcomes.Rejected:
      return 'warning';
    default:
      return 'muted';
  }
};

/** A connector is shown as ready, enabled-but-blocked, or off; the server's own flags decide. */
export const connectorStateAction = (connector: Pick<RecordDeploymentConnectorData, 'IsEnabled' | 'IsReadyToRun'>): BadgeAction => {
  if (connector.IsReadyToRun) {
    return 'success';
  }
  return connector.IsEnabled ? 'warning' : 'muted';
};

/** Reconciliation items for one order, in the order the server listed them. */
export const reconciliationFor = (items: RecordDeploymentReconciliationData[], orderId: string | null | undefined): RecordDeploymentReconciliationData[] =>
  orderId ? items.filter((item) => item.OrderId === orderId) : [];

/** Open items per order id, for the count shown beside a deployment. */
export const reconciliationCounts = (items: RecordDeploymentReconciliationData[]): Record<string, number> =>
  items.reduce<Record<string, number>>((counts, item) => {
    counts[item.OrderId] = (counts[item.OrderId] ?? 0) + 1;
    return counts;
  }, {});

/** Newest first by modification, so the deployment that just changed is at the top. */
export const sortDeployments = (deployments: RecordDeploymentData[]): RecordDeploymentData[] =>
  [...deployments].sort((a, b) => (b.ModifiedOn ?? '').localeCompare(a.ModifiedOn ?? '') || a.OrderNumber.localeCompare(b.OrderNumber));

/** Merges one freshly fetched deployment into a list without duplicating it. */
export const upsertDeployment = (deployments: RecordDeploymentData[], deployment: RecordDeploymentData): RecordDeploymentData[] =>
  sortDeployments([deployment, ...deployments.filter((existing) => existing.OrderId !== deployment.OrderId)]);
