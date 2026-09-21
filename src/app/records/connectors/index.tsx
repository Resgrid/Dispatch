import { Redirect, Stack, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';

import { ConnectorListItem, ReconciliationListItem } from '@/components/records/deployment-items';
import { Box } from '@/components/ui/box';
import { Divider } from '@/components/ui/divider';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { useDeploymentsStore } from '@/stores/records/deployments-store';
import { securityStore } from '@/stores/security/store';

// External ordering-system connectors (RMS plan section 4.1), department administrators only. Shows
// each connector's state and the open reconciliation across them. A connector is created, changed
// and given its credential on the Web; here an administrator can watch it and read the feed now.

export default function ConnectorsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isAdmin = !!securityStore((state) => state.rights)?.IsAdmin;

  const connectors = useDeploymentsStore((state) => state.connectors);
  const reconciliation = useDeploymentsStore((state) => state.reconciliation);
  const connectorsError = useDeploymentsStore((state) => state.connectorsError);
  const fetchConnectors = useDeploymentsStore((state) => state.fetchConnectors);
  const fetchReconciliation = useDeploymentsStore((state) => state.fetchReconciliation);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchConnectors(), fetchReconciliation()]);
    setRefreshing(false);
  }, [fetchConnectors, fetchReconciliation]);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) {
        void load();
      }
    }, [isAdmin, load])
  );

  const countsByConnector = useMemo(
    () =>
      reconciliation.reduce<Record<string, number>>((counts, item) => {
        if (item.ConnectorId) {
          counts[item.ConnectorId] = (counts[item.ConnectorId] ?? 0) + 1;
        }
        return counts;
      }, {}),
    [reconciliation]
  );

  // The server refuses a non-administrator anyway; the redirect just spares them the refusal.
  if (!isAdmin) {
    return <Redirect href="/records/deployments" />;
  }

  return (
    <Box className="flex-1 bg-background-0">
      <FocusAwareStatusBar />
      <Stack.Screen options={{ title: t('records.connectors') }} />

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}>
        <Text className="px-4 pt-3 text-xs text-typography-500">{t('records.connectors_hint')}</Text>
        <Text className="px-4 pb-2 pt-1 text-xs text-typography-500">{t('records.manage_on_web')}</Text>

        {connectorsError ? (
          <Box className="mx-4 mt-2 rounded-md border border-error-300 bg-background-error p-3" testID="connectors-error">
            <Text className="text-sm text-typography-800">{t(`records.${connectorsError}`, { defaultValue: connectorsError })}</Text>
          </Box>
        ) : null}

        {connectors.length === 0 && !refreshing ? (
          <Text className="px-4 py-6 text-sm text-typography-500">{t('records.no_connectors')}</Text>
        ) : (
          connectors.map((connector) => (
            <ConnectorListItem
              key={connector.Id}
              connector={connector}
              conflicts={countsByConnector[connector.Id]}
              onPress={() => router.push(`/records/connectors/${connector.Id}`)}
              testID={`connector-${connector.Id}`}
            />
          ))
        )}
        <Divider />

        <Heading size="xs" className="px-4 pb-1 pt-3 uppercase text-typography-500">
          {t('records.reconciliation')}
        </Heading>
        <Text className="px-4 pb-1 text-xs text-typography-500">{t('records.reconciliation_hint')}</Text>
        {reconciliation.length === 0 ? (
          <Text className="px-4 py-3 text-sm text-typography-500">{t('records.no_reconciliation')}</Text>
        ) : (
          reconciliation.map((item, index) => (
            <ReconciliationListItem
              key={`${item.OrderId}-${item.Kind}-${item.RequestNumber ?? index}`}
              item={item}
              showOrder
              onPress={() => router.push(`/records/deployments/${item.OrderId}`)}
              testID={`reconciliation-${index}`}
            />
          ))
        )}
        <Box className="h-16" />
      </ScrollView>
    </Box>
  );
}
