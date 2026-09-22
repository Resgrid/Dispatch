import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';

import { DeploymentFillItem, ReconciliationListItem } from '@/components/records/deployment-items';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { deploymentStatusAction, formatWhen, isConnectorOwned, reconciliationFor, statusKey } from '@/lib/records/deployments';
import { openLinkInBrowser } from '@/lib/utils';
import { useDeploymentsStore } from '@/stores/records/deployments-store';
import { securityStore } from '@/stores/security/store';

// One deployment: the order as the source last described it, the fills the department owes, and —
// for a department administrator — where the source and the department's record disagree. Fills
// are moved by a coordinator on the Web; nothing on this screen changes one.

const Row = ({ label, value }: { label: string; value?: string | null }) =>
  value ? (
    <HStack className="justify-between px-4 py-1" space="md">
      <Text className="text-xs text-typography-500">{label}</Text>
      <Text className="flex-1 text-right text-xs text-typography-800" numberOfLines={2}>
        {value}
      </Text>
    </HStack>
  ) : null;

export default function DeploymentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isAdmin = !!securityStore((state) => state.rights)?.IsAdmin;

  const deployment = useDeploymentsStore((state) => state.deployments.find((existing) => existing.OrderId === id) ?? null);
  const reconciliation = useDeploymentsStore((state) => state.reconciliation);
  const isLoading = useDeploymentsStore((state) => state.isLoading);
  const error = useDeploymentsStore((state) => state.error);
  const fetchDeployment = useDeploymentsStore((state) => state.fetchDeployment);
  const fetchReconciliation = useDeploymentsStore((state) => state.fetchReconciliation);

  useFocusEffect(
    useCallback(() => {
      if (!id) {
        return;
      }
      void fetchDeployment(id);
      if (isAdmin) {
        void fetchReconciliation();
      }
    }, [id, isAdmin, fetchDeployment, fetchReconciliation])
  );

  const items = useMemo(() => reconciliationFor(reconciliation, id), [reconciliation, id]);
  const connectorOwned = isConnectorOwned(deployment);

  return (
    <Box className="flex-1 bg-background-0">
      <FocusAwareStatusBar />
      <Stack.Screen options={{ title: deployment?.OrderNumber ?? t('records.deployments') }} />

      <ScrollView refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => id && void fetchDeployment(id)} />}>
        {error && !deployment ? (
          <Box className="mx-4 mt-3 rounded-md border border-error-300 bg-background-error p-3" testID="deployment-error">
            <Text className="text-sm text-typography-800">{t(`records.${error}`, { defaultValue: error })}</Text>
          </Box>
        ) : null}

        {deployment ? (
          <VStack>
            <VStack className="px-4 pt-3" space="xs">
              <HStack className="items-center" space="sm">
                <Heading size="md" className="flex-1" numberOfLines={1}>
                  {deployment.OrderNumber}
                </Heading>
                <Badge action={deploymentStatusAction(deployment.Status)} size="sm">
                  <BadgeText>{t(`records.deployment_status_${statusKey(deployment.Status)}`, { defaultValue: deployment.Status })}</BadgeText>
                </Badge>
              </HStack>
              <Text className="text-sm text-typography-700">
                {deployment.IncidentName}
                {deployment.IncidentNumber ? ` · ${deployment.IncidentNumber}` : ''}
              </Text>
              <HStack space="xs" className="flex-wrap">
                {connectorOwned ? (
                  <Badge action="info" size="sm" testID="deployment-connector-owned">
                    <BadgeText>{t('records.connector_maintained')}</BadgeText>
                  </Badge>
                ) : null}
                {deployment.IsPreview ? (
                  <Badge action="warning" size="sm">
                    <BadgeText>{t('records.preview')}</BadgeText>
                  </Badge>
                ) : null}
              </HStack>
              {deployment.ProvenanceStatement ? <Text className="text-xs text-typography-500">{deployment.ProvenanceStatement}</Text> : null}
            </VStack>

            <Box className="pt-2">
              <Row label={t('records.source')} value={[deployment.SourceScheme, deployment.SourceSystem, deployment.SourceVersion ? `v${deployment.SourceVersion}` : null].filter(Boolean).join(' · ')} />
              <Row label={t('records.captured_on')} value={formatWhen(deployment.SourceCapturedOn) || null} />
              <Row label={t('records.offices')} value={[deployment.OrderingOffice, deployment.DispatchOffice].filter(Boolean).join(' / ')} />
              <Row label={t('records.agencies')} value={[deployment.RequestingAgency, deployment.ReceivingAgency, deployment.SendingAgency].filter(Boolean).join(' · ')} />
              <Row label={t('records.cost_code')} value={deployment.CostCode} />
              <Row label={t('records.agreement')} value={deployment.AgreementReference} />
              <Row label={t('records.closed_out_on')} value={formatWhen(deployment.ClosedOutOn) || null} />
              <Row label={t('records.closeout_notes')} value={deployment.CloseoutNotes} />
            </Box>

            <HStack className="px-4 py-3" space="sm">
              {deployment.RecordId ? (
                <Button variant="outline" size="sm" onPress={() => router.push(`/records/${deployment.RecordId}`)} testID="deployment-open-record">
                  <ButtonText>{t('records.open_record')}</ButtonText>
                </Button>
              ) : null}
              {deployment.ArtifactSafeUrl ? (
                <Button variant="outline" size="sm" onPress={() => openLinkInBrowser(deployment.ArtifactSafeUrl as string)} testID="deployment-open-artifact">
                  <ButtonText>{t('records.open_artifact')}</ButtonText>
                </Button>
              ) : null}
            </HStack>
            <Divider />

            <Heading size="xs" className="px-4 pb-1 pt-3 uppercase text-typography-500">
              {t('records.fills')}
            </Heading>
            {deployment.Fills.length === 0 ? (
              <Text className="px-4 py-3 text-sm text-typography-500">{t('records.no_fills')}</Text>
            ) : (
              deployment.Fills.map((fill) => <DeploymentFillItem key={fill.FillId} fill={fill} testID={`deployment-fill-${fill.FillId}`} />)
            )}
            <Divider />

            {isAdmin && connectorOwned ? (
              <>
                <Heading size="xs" className="px-4 pb-1 pt-3 uppercase text-typography-500">
                  {t('records.reconciliation')}
                </Heading>
                {items.length === 0 ? (
                  <Text className="px-4 py-3 text-sm text-typography-500">{t('records.no_reconciliation')}</Text>
                ) : (
                  <>
                    <Text className="px-4 pb-1 text-xs text-typography-500">{t('records.reconciliation_hint')}</Text>
                    {items.map((item, index) => (
                      <ReconciliationListItem key={`${item.OrderId}-${item.Kind}-${item.RequestNumber ?? index}`} item={item} testID={`deployment-reconciliation-${index}`} />
                    ))}
                  </>
                )}
              </>
            ) : null}
          </VStack>
        ) : !error ? (
          <Text className="px-4 py-6 text-sm text-typography-500">{t('records.loading')}</Text>
        ) : null}
        <Box className="h-16" />
      </ScrollView>
    </Box>
  );
}
