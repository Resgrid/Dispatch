import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { RadioTower } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';

import { DeploymentListItem, RecordsEntryRow } from '@/components/records/deployment-items';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { Text } from '@/components/ui/text';
import { reconciliationCounts } from '@/lib/records/deployments';
import { useDeploymentsStore } from '@/stores/records/deployments-store';
import { securityStore } from '@/stores/security/store';

// Deployments (RMS plan section 4.1): the external resource orders this department is filling, each
// with the fills it owes. The ordering system stays authoritative — a connector or a coordinator on
// the Web maintains the source snapshots — so this list is read-only here. Department administrators
// also see how many reconciliation items each order carries and can reach the connectors from here.

export default function DeploymentsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isAdmin = !!securityStore((state) => state.rights)?.IsAdmin;

  const deployments = useDeploymentsStore((state) => state.deployments);
  const includeClosed = useDeploymentsStore((state) => state.includeClosed);
  const reconciliation = useDeploymentsStore((state) => state.reconciliation);
  const isLoading = useDeploymentsStore((state) => state.isLoading);
  const error = useDeploymentsStore((state) => state.error);
  const fetchDeployments = useDeploymentsStore((state) => state.fetchDeployments);
  const fetchReconciliation = useDeploymentsStore((state) => state.fetchReconciliation);

  useFocusEffect(
    useCallback(() => {
      void fetchDeployments();
      if (isAdmin) {
        void fetchReconciliation();
      }
    }, [fetchDeployments, fetchReconciliation, isAdmin])
  );

  const counts = useMemo(() => reconciliationCounts(reconciliation), [reconciliation]);

  return (
    <Box className="flex-1 bg-background-0">
      <FocusAwareStatusBar />
      <Stack.Screen options={{ title: t('records.deployments') }} />

      <ScrollView refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void fetchDeployments()} />}>
        <Text className="px-4 pt-3 text-xs text-typography-500">{t('records.deployments_hint')}</Text>

        {error ? (
          <Box className="mx-4 mt-3 rounded-md border border-error-300 bg-background-error p-3" testID="deployments-error">
            <Text className="text-sm text-typography-800">{t(`records.${error}`, { defaultValue: error })}</Text>
          </Box>
        ) : null}

        {isAdmin ? (
          <>
            <RecordsEntryRow
              icon={<RadioTower size={18} color="#2563eb" />}
              title={t('records.connectors')}
              subtitle={t('records.connectors_hint')}
              count={reconciliation.length}
              attention
              onPress={() => router.push('/records/connectors')}
              testID="deployments-connectors"
            />
            <Divider />
          </>
        ) : null}

        {deployments.length === 0 && !isLoading ? (
          <Text className="px-4 py-6 text-sm text-typography-500">{t('records.no_deployments')}</Text>
        ) : (
          deployments.map((deployment) => (
            <DeploymentListItem
              key={deployment.OrderId}
              deployment={deployment}
              conflicts={counts[deployment.OrderId]}
              onPress={() => router.push(`/records/deployments/${deployment.OrderId}`)}
              testID={`deployment-${deployment.OrderId}`}
            />
          ))
        )}

        <Box className="m-4">
          <Button variant="outline" size="sm" onPress={() => void fetchDeployments({ includeClosed: !includeClosed })} testID="deployments-toggle-closed">
            <ButtonText>{includeClosed ? t('records.hide_closed') : t('records.include_closed')}</ButtonText>
          </Button>
        </Box>
        <Box className="h-16" />
      </ScrollView>
    </Box>
  );
}
