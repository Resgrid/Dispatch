import { type Href, Redirect, Stack, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';

import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { operationsCapabilities } from '@/lib/operations/capabilities';
import { useDeploymentsStatus } from '@/stores/feature-flags/store';
import { useOperationsStore } from '@/stores/operations/store';

// Deployments the person may see (Workforce & Business Operations plan, Phase C): a rostered member's
// own, a manager's whole department. Gated by Operations.Deployments; unknown stays a spinner so a deep
// link never flashes the list before the flag resolves.
export default function OperationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const flagStatus = useDeploymentsStatus();
  const { access, deployments, includeClosed, busy, error } = useOperationsStore();

  const load = useCallback(async () => {
    await useOperationsStore.getState().loadAccess();
    if (useOperationsStore.getState().access?.Enabled) await useOperationsStore.getState().loadDeployments();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (flagStatus === 'enabled') void load();
    }, [flagStatus, load])
  );

  if (flagStatus === 'disabled') return <Redirect href={operationsCapabilities.homeRoute} />;

  return (
    <VStack className="flex-1 bg-background-0">
      <Stack.Screen options={{ title: t('operations.title') }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} />}>
        <Text className="text-xl font-bold">{t('operations.title')}</Text>
        {flagStatus === 'unknown' ? <Spinner /> : null}
        {error ? (
          <Text accessibilityRole="alert" className="text-error-600">
            {t(`operations.errors.${error}`, { defaultValue: t('operations.errors.retry') })}
          </Text>
        ) : null}
        {access && !access.Enabled ? <Text className="text-typography-500">{t('operations.disabled')}</Text> : null}
        {access?.Enabled ? (
          <HStack space="sm">
            <Button variant={includeClosed ? 'outline' : 'solid'} size="sm" onPress={() => void useOperationsStore.getState().loadDeployments(false)} testID="operations-filter-open">
              <ButtonText>{t('operations.open')}</ButtonText>
            </Button>
            <Button variant={includeClosed ? 'solid' : 'outline'} size="sm" onPress={() => void useOperationsStore.getState().loadDeployments(true)} testID="operations-filter-all">
              <ButtonText>{t('operations.all')}</ButtonText>
            </Button>
          </HStack>
        ) : null}
        {access?.Enabled && !busy && deployments.length === 0 ? <Text className="text-typography-500">{t('operations.none')}</Text> : null}
        {deployments.map((deployment) => (
          <Pressable key={deployment.Id} onPress={() => router.push(`/operations/${deployment.Id}` as Href)} testID={`operations-deployment-${deployment.Id}`} className="rounded-lg border border-outline-200 p-3">
            <HStack className="items-center justify-between">
              <Text className="flex-1 font-semibold">{deployment.Name}</Text>
              <Text className="text-typography-500">{t(`operations.status.${deployment.Status}`)}</Text>
            </HStack>
            <Text className="text-typography-500">{[deployment.IncidentNumber, deployment.RequestNumber, deployment.ResourceOrderNumber].filter(Boolean).join(' · ') || t('operations.noNumbers')}</Text>
            <Text className="text-typography-500">
              {String(deployment.StartOn ?? '').slice(0, 10)}
              {deployment.EndOn ? ` – ${String(deployment.EndOn).slice(0, 10)}` : ''}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </VStack>
  );
}
