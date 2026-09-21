import { Redirect, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';

import { ConnectorRunItem, ReconciliationListItem } from '@/components/records/deployment-items';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { connectorStateAction, formatWhen } from '@/lib/records/deployments';
import { useDeploymentsStore } from '@/stores/records/deployments-store';
import { securityStore } from '@/stores/security/store';

// One connector (RMS plan section 4.1), department administrators only: its state, the one command
// a field client may issue — read the feed now — its run log, and its open reconciliation. Enabling,
// terms, credentials and the inbound token are Web-only; write authority does not exist at all.

const Row = ({ label, value, testID }: { label: string; value?: string | null; testID?: string }) =>
  value ? (
    <HStack className="justify-between px-4 py-1" space="md">
      <Text className="text-xs text-typography-500">{label}</Text>
      <Text className="flex-1 text-right text-xs text-typography-800" numberOfLines={2} testID={testID}>
        {value}
      </Text>
    </HStack>
  ) : null;

export default function ConnectorScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isAdmin = !!securityStore((state) => state.rights)?.IsAdmin;

  const connector = useDeploymentsStore((state) => state.connectors.find((existing) => existing.Id === id) ?? null);
  const runs = useDeploymentsStore((state) => (id ? (state.runs[id] ?? []) : []));
  const reconciliation = useDeploymentsStore((state) => state.reconciliation);
  const runningConnectorId = useDeploymentsStore((state) => state.runningConnectorId);
  const connectorsError = useDeploymentsStore((state) => state.connectorsError);
  const fetchConnector = useDeploymentsStore((state) => state.fetchConnector);
  const fetchRuns = useDeploymentsStore((state) => state.fetchRuns);
  const fetchReconciliation = useDeploymentsStore((state) => state.fetchReconciliation);
  const runConnector = useDeploymentsStore((state) => state.runConnector);

  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      return;
    }
    setRefreshing(true);
    await Promise.all([fetchConnector(id), fetchRuns(id), fetchReconciliation(id)]);
    setRefreshing(false);
  }, [id, fetchConnector, fetchRuns, fetchReconciliation]);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) {
        void load();
      }
    }, [isAdmin, load])
  );

  const items = useMemo(() => reconciliation.filter((item) => item.ConnectorId === id), [reconciliation, id]);
  const isRunning = runningConnectorId === id;

  const readNow = async () => {
    if (!id) {
      return;
    }
    setMessage(null);
    const result = await runConnector(id);
    if (result.run) {
      setMessage(
        t(result.ok ? 'records.run_finished' : 'records.run_not_ok', {
          outcome: t(`records.run_outcome_${result.run.Outcome}`, { defaultValue: result.run.Outcome }),
          created: result.run.OrdersCreated,
          snapshots: result.run.SnapshotsRecorded,
          requests: result.run.RequestsAdded,
          conflicts: result.run.Conflicts,
        })
      );
    } else {
      setMessage(t(`records.${result.error ?? 'run_failed'}`, { defaultValue: result.error ?? t('records.run_failed') }));
    }
  };

  if (!isAdmin) {
    return <Redirect href="/records/deployments" />;
  }

  return (
    <Box className="flex-1 bg-background-0">
      <FocusAwareStatusBar />
      <Stack.Screen options={{ title: connector?.Name ?? t('records.connectors') }} />

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}>
        {connectorsError ? (
          <Box className="mx-4 mt-3 rounded-md border border-error-300 bg-background-error p-3" testID="connector-error">
            <Text className="text-sm text-typography-800">{t(`records.${connectorsError}`, { defaultValue: connectorsError })}</Text>
          </Box>
        ) : null}
        {message ? (
          <Box className="mx-4 mt-3 rounded-md border border-info-300 bg-background-info p-3" testID="connector-message">
            <Text className="text-sm text-typography-800">{message}</Text>
          </Box>
        ) : null}

        {connector ? (
          <VStack>
            <VStack className="px-4 pt-3" space="xs">
              <HStack className="items-center" space="sm">
                <Heading size="md" className="flex-1" numberOfLines={1}>
                  {connector.Name}
                </Heading>
                <Badge action={connectorStateAction(connector)} size="sm" testID="connector-state">
                  <BadgeText>{connector.IsReadyToRun ? t('records.connector_ready') : connector.IsEnabled ? t('records.connector_not_ready') : t('records.connector_disabled')}</BadgeText>
                </Badge>
              </HStack>
              <Text className="text-xs text-typography-500">
                {connector.ProviderKey} · {connector.SourceScheme} · {connector.ProfileKey}
              </Text>
              <Text className="text-xs text-typography-400" numberOfLines={2}>
                {connector.BaseUrl}
              </Text>
            </VStack>

            <Box className="pt-2">
              <Row label={t('records.terms')} value={connector.TermsAcknowledgedOn ? `${t('records.terms_acknowledged')} · ${formatWhen(connector.TermsAcknowledgedOn)}` : t('records.terms_not_acknowledged')} />
              <Row label={t('records.read_authority')} value={connector.ReadEnabled ? t('records.granted') : t('records.not_granted')} />
              <Row label={t('records.write_authority')} value={t('records.write_refused')} />
              <Row label={t('records.last_read')} value={formatWhen(connector.LastPolledOn) || t('records.never_read')} />
              <Row label={t('records.last_success')} value={formatWhen(connector.LastSuccessOn) || null} />
              <Row label={t('records.last_error')} value={connector.LastError} testID="connector-last-error" />
              <Row label={t('records.requests_this_hour')} value={`${connector.RequestsThisHour} / ${connector.MaxRequestsPerHour}`} />
              <Row label={t('records.poll_interval')} value={t('records.minutes', { count: connector.PollIntervalMinutes })} />
            </Box>

            <HStack className="px-4 py-3" space="sm">
              <Button size="sm" isDisabled={!connector.IsReadyToRun || isRunning} onPress={() => void readNow()} testID="connector-read-now">
                <ButtonText>{isRunning ? t('records.reading_feed') : t('records.read_feed_now')}</ButtonText>
              </Button>
              <Button variant="outline" size="sm" onPress={() => router.push('/records/deployments')} testID="connector-open-deployments">
                <ButtonText>{t('records.deployments')}</ButtonText>
              </Button>
            </HStack>
            <Text className="px-4 pb-2 text-xs text-typography-500">{t('records.manage_on_web')}</Text>
            <Divider />

            <Heading size="xs" className="px-4 pb-1 pt-3 uppercase text-typography-500">
              {t('records.reconciliation')}
            </Heading>
            {items.length === 0 ? (
              <Text className="px-4 py-3 text-sm text-typography-500">{t('records.no_reconciliation')}</Text>
            ) : (
              <>
                <Text className="px-4 pb-1 text-xs text-typography-500">{t('records.reconciliation_hint')}</Text>
                {items.map((item, index) => (
                  <ReconciliationListItem
                    key={`${item.OrderId}-${item.Kind}-${item.RequestNumber ?? index}`}
                    item={item}
                    showOrder
                    onPress={() => router.push(`/records/deployments/${item.OrderId}`)}
                    testID={`connector-reconciliation-${index}`}
                  />
                ))}
              </>
            )}
            <Divider />

            <Heading size="xs" className="px-4 pb-1 pt-3 uppercase text-typography-500">
              {t('records.run_log')}
            </Heading>
            {runs.length === 0 ? <Text className="px-4 py-3 text-sm text-typography-500">{t('records.no_runs')}</Text> : runs.map((run) => <ConnectorRunItem key={run.Id} run={run} testID={`connector-run-${run.Id}`} />)}
          </VStack>
        ) : !connectorsError ? (
          <Text className="px-4 py-6 text-sm text-typography-500">{t('records.loading')}</Text>
        ) : null}
        <Box className="h-16" />
      </ScrollView>
    </Box>
  );
}
