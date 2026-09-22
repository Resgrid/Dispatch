import { AlertTriangle, ChevronRight, GlobeIcon, RadioTower } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { connectorStateAction, deploymentStatusAction, fillStatusAction, formatWhen, isConnectorOwned, runOutcomeAction, statusKey } from '@/lib/records/deployments';
import {
  type RecordDeploymentConnectorData,
  type RecordDeploymentConnectorRunData,
  type RecordDeploymentData,
  type RecordDeploymentFillData,
  type RecordDeploymentReconciliationData,
} from '@/models/v4/records/deployments';

// Rows for deployments, fills, reconciliation items, connectors and connector runs (RMS plan section
// 4.1). Presentation only: every value shown came from the server, and no row offers a way to change
// a fill or an order — those are a coordinator's actions on the Web.

/** A navigation row on the Records home: icon, title, a line of context and an optional count. */
export const RecordsEntryRow: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string; count?: number; attention?: boolean; onPress: () => void; testID?: string }> = ({
  icon,
  title,
  subtitle,
  count,
  attention,
  onPress,
  testID,
}) => (
  <Pressable onPress={onPress} className="px-4 py-3" testID={testID}>
    <HStack className="items-center" space="md">
      <Box className="size-10 items-center justify-center rounded-full bg-primary-100">{icon}</Box>
      <VStack className="flex-1">
        <Text className="font-medium text-typography-900" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-xs text-typography-500" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </VStack>
      {count !== undefined && count > 0 ? (
        <Badge action={attention ? 'warning' : 'info'} size="sm">
          <BadgeText>{count}</BadgeText>
        </Badge>
      ) : null}
      <ChevronRight size={18} color="#94a3b8" />
    </HStack>
  </Pressable>
);

export const DeploymentListItem: React.FC<{ deployment: RecordDeploymentData; conflicts?: number; onPress: () => void; testID?: string }> = ({ deployment, conflicts, onPress, testID }) => {
  const { t } = useTranslation();
  const connectorOwned = isConnectorOwned(deployment);

  return (
    <Pressable onPress={onPress} className="px-4 py-3" testID={testID}>
      <HStack className="items-center" space="md">
        <Box className="size-10 items-center justify-center rounded-full bg-primary-100">{connectorOwned ? <RadioTower size={18} color="#2563eb" /> : <GlobeIcon size={18} color="#2563eb" />}</Box>
        <VStack className="flex-1">
          <Text className="font-medium text-typography-900" numberOfLines={1}>
            {deployment.OrderNumber}
          </Text>
          <Text className="text-xs text-typography-500" numberOfLines={1}>
            {deployment.IncidentName}
            {deployment.IncidentNumber ? ` · ${deployment.IncidentNumber}` : ''}
          </Text>
          <Text className="text-xs text-typography-400" numberOfLines={1}>
            {deployment.SourceScheme}
            {deployment.SourceSystem ? ` · ${deployment.SourceSystem}` : ''}
            {connectorOwned ? ` · ${t('records.connector_maintained')}` : ''}
          </Text>
        </VStack>
        <VStack className="items-end" space="xs">
          <Badge action={deploymentStatusAction(deployment.Status)} size="sm">
            <BadgeText>{t(`records.deployment_status_${statusKey(deployment.Status)}`, { defaultValue: deployment.Status })}</BadgeText>
          </Badge>
          {conflicts ? (
            <Badge action="warning" size="sm" testID={testID ? `${testID}-conflicts` : undefined}>
              <BadgeText>{t('records.reconciliation_count', { count: conflicts })}</BadgeText>
            </Badge>
          ) : null}
        </VStack>
      </HStack>
    </Pressable>
  );
};

export const DeploymentFillItem: React.FC<{ fill: RecordDeploymentFillData; testID?: string }> = ({ fill, testID }) => {
  const { t } = useTranslation();
  const what = [fill.Position, fill.ResourceType, fill.ResourceKind].filter(Boolean).join(' · ');
  const when = fill.NeededOn ? formatWhen(fill.NeededOn) : '';

  return (
    <Box className="px-4 py-2" testID={testID}>
      <HStack className="items-center" space="md">
        <VStack className="flex-1">
          <Text className="font-medium text-typography-900" numberOfLines={1}>
            {fill.RequestNumber}
            {fill.RequestCategory ? ` · ${fill.RequestCategory}` : ''}
            {fill.IsTrainee ? ` · ${t('records.trainee')}` : ''}
          </Text>
          {what ? (
            <Text className="text-xs text-typography-500" numberOfLines={1}>
              {what}
            </Text>
          ) : null}
          {fill.HomeUnit || when ? (
            <Text className="text-xs text-typography-400" numberOfLines={1}>
              {[fill.HomeUnit, when ? `${t('records.needed_on')} ${when}` : null].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {fill.DeclineReason ? (
            <Text className="text-xs text-error-600" numberOfLines={2}>
              {fill.DeclineReason}
            </Text>
          ) : null}
        </VStack>
        <Badge action={fillStatusAction(fill.Status)} size="sm">
          <BadgeText>{t(`records.fill_status_${statusKey(fill.Status)}`, { defaultValue: fill.Status })}</BadgeText>
        </Badge>
      </HStack>
    </Box>
  );
};

/** One disagreement between the source and the department's record. Shown, never applied. */
export const ReconciliationListItem: React.FC<{ item: RecordDeploymentReconciliationData; showOrder?: boolean; onPress?: () => void; testID?: string }> = ({ item, showOrder, onPress, testID }) => {
  const { t } = useTranslation();
  const body = (
    <HStack className="items-start" space="md">
      <Box className="mt-0.5">
        <AlertTriangle size={18} color="#d97706" />
      </Box>
      <VStack className="flex-1">
        <Text className="font-medium text-typography-900" numberOfLines={2}>
          {t(`records.reconciliation_${item.Kind}`, { defaultValue: item.Kind })}
        </Text>
        <Text className="text-xs text-typography-500" numberOfLines={1}>
          {[showOrder ? item.OrderNumber : null, item.RequestNumber].filter(Boolean).join(' · ')}
        </Text>
        <Text className="text-xs text-typography-500" numberOfLines={2}>
          {t('records.source_says')} {item.SourceStatus ?? '—'} · {t('records.your_record_says')} {item.LocalStatus ?? '—'}
        </Text>
        {item.SourceCapturedOn ? (
          <Text className="text-xs text-typography-400" numberOfLines={1}>
            {formatWhen(item.SourceCapturedOn)}
            {item.SourceVersion ? ` · v${item.SourceVersion}` : ''}
          </Text>
        ) : null}
      </VStack>
      {onPress ? <ChevronRight size={18} color="#94a3b8" /> : null}
    </HStack>
  );

  return onPress ? (
    <Pressable onPress={onPress} className="px-4 py-3" testID={testID}>
      {body}
    </Pressable>
  ) : (
    <Box className="px-4 py-3" testID={testID}>
      {body}
    </Box>
  );
};

export const ConnectorListItem: React.FC<{ connector: RecordDeploymentConnectorData; conflicts?: number; onPress: () => void; testID?: string }> = ({ connector, conflicts, onPress, testID }) => {
  const { t } = useTranslation();

  return (
    <Pressable onPress={onPress} className="px-4 py-3" testID={testID}>
      <HStack className="items-center" space="md">
        <Box className="size-10 items-center justify-center rounded-full bg-primary-100">
          <RadioTower size={18} color="#2563eb" />
        </Box>
        <VStack className="flex-1">
          <Text className="font-medium text-typography-900" numberOfLines={1}>
            {connector.Name}
          </Text>
          <Text className="text-xs text-typography-500" numberOfLines={1}>
            {connector.ProviderKey} · {connector.SourceScheme} · {connector.ProfileKey}
          </Text>
          <Text className="text-xs text-typography-400" numberOfLines={1}>
            {connector.LastPolledOn ? `${t('records.last_read')} ${formatWhen(connector.LastPolledOn)}` : t('records.never_read')}
          </Text>
          {connector.LastError ? (
            <Text className="text-xs text-error-600" numberOfLines={2}>
              {connector.LastError}
            </Text>
          ) : null}
        </VStack>
        <VStack className="items-end" space="xs">
          <Badge action={connectorStateAction(connector)} size="sm">
            <BadgeText>{connector.IsReadyToRun ? t('records.connector_ready') : connector.IsEnabled ? t('records.connector_not_ready') : t('records.connector_disabled')}</BadgeText>
          </Badge>
          {conflicts ? (
            <Badge action="warning" size="sm">
              <BadgeText>{t('records.reconciliation_count', { count: conflicts })}</BadgeText>
            </Badge>
          ) : null}
        </VStack>
      </HStack>
    </Pressable>
  );
};

export const ConnectorRunItem: React.FC<{ run: RecordDeploymentConnectorRunData; testID?: string }> = ({ run, testID }) => {
  const { t } = useTranslation();

  return (
    <Box className="px-4 py-2" testID={testID}>
      <HStack className="items-start" space="md">
        <VStack className="flex-1">
          <Text className="text-sm text-typography-900" numberOfLines={1}>
            {formatWhen(run.StartedOn)} · {t(`records.run_trigger_${run.Trigger}`, { defaultValue: run.Trigger })}
          </Text>
          <Text className="text-xs text-typography-500" numberOfLines={2}>
            {t('records.run_counts', {
              seen: run.OrdersSeen,
              created: run.OrdersCreated,
              snapshots: run.SnapshotsRecorded,
              requests: run.RequestsAdded,
              unchanged: run.Unchanged,
              rejected: run.Rejected,
              conflicts: run.Conflicts,
            })}
          </Text>
          {run.Error ? (
            <Text className="text-xs text-error-600" numberOfLines={3}>
              {run.Error}
            </Text>
          ) : null}
        </VStack>
        <Badge action={runOutcomeAction(run.Outcome)} size="sm">
          <BadgeText>{t(`records.run_outcome_${run.Outcome}`, { defaultValue: run.Outcome })}</BadgeText>
        </Badge>
      </HStack>
    </Box>
  );
};
