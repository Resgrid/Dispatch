import { Redirect, Stack, useFocusEffect, useRouter } from 'expo-router';
import { GlobeIcon, Plus, RadioTower } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';

import { RecordsEntryRow } from '@/components/records/deployment-items';
import { AssignmentItem, PendingDraftItem, RecordListItem } from '@/components/records/record-list-item';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import { Fab, FabIcon } from '@/components/ui/fab';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useRecordsContext } from '@/hooks/use-records-context';
import { RmsRecordState } from '@/models/v4/records';
import { useRecordsFieldStatus } from '@/stores/feature-flags/store';
import { useDeploymentsStore, useOpenDeploymentCount, useReconciliationCount } from '@/stores/records/deployments-store';
import { useRecordsStore } from '@/stores/records/store';
import { securityStore } from '@/stores/security/store';

// Field Records home (RMS plan RMS-1D): New, Assigned, Drafts, Returned and Recent. Everything shown
// here came from the server's own filtering; this screen never decides what the person may author.

// Module-level so a re-render reuses the same component type; defining these inside the screen would
// remount every section on each keystroke and throw away their scroll position.
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <VStack className="mb-2">
    <Heading size="xs" className="px-4 pb-1 pt-3 uppercase text-typography-500">
      {title}
    </Heading>
    {children}
    <Divider />
  </VStack>
);

const Empty = ({ text }: { text: string }) => <Text className="px-4 py-3 text-sm text-typography-500">{text}</Text>;

export default function RecordsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const flagStatus = useRecordsFieldStatus();
  const context = useRecordsContext();

  const { preflight, catalog, assignments, recent, drafts, pendingDrafts, isSyncing, error } = useRecordsStore();
  const setContext = useRecordsStore((state) => state.setContext);
  const runPreflight = useRecordsStore((state) => state.runPreflight);
  const fetchCatalog = useRecordsStore((state) => state.fetchCatalog);
  const sync = useRecordsStore((state) => state.sync);
  const pushAllDrafts = useRecordsStore((state) => state.pushAllDrafts);
  const runUploads = useRecordsStore((state) => state.runUploads);
  const flushTelemetry = useRecordsStore((state) => state.flushTelemetry);

  // Deployments (RMS plan section 4.1) ride along on the same focus: the list is small and read-only,
  // and the reconciliation count is the one number an administrator wants to see without opening it.
  const isAdmin = !!securityStore((state) => state.rights)?.IsAdmin;
  const openDeployments = useOpenDeploymentCount();
  const reconciliationCount = useReconciliationCount();
  const fetchDeployments = useDeploymentsStore((state) => state.fetchDeployments);
  const fetchReconciliation = useDeploymentsStore((state) => state.fetchReconciliation);

  useFocusEffect(
    useCallback(() => {
      setContext(context);
      void (async () => {
        const result = await runPreflight();
        if (!result?.Ok) {
          return;
        }
        await fetchCatalog();
        await sync();
        await pushAllDrafts();
        await runUploads();
        await flushTelemetry();
        void fetchDeployments();
        if (isAdmin) {
          void fetchReconciliation();
        }
      })();
    }, [context, setContext, runPreflight, fetchCatalog, sync, pushAllDrafts, runUploads, flushTelemetry, fetchDeployments, fetchReconciliation, isAdmin])
  );

  const pending = useMemo(() => Object.values(pendingDrafts), [pendingDrafts]);
  const returned = useMemo(() => drafts.filter((record) => record.State === RmsRecordState.Returned), [drafts]);
  const ownDrafts = useMemo(() => drafts.filter((record) => record.State === RmsRecordState.Draft), [drafts]);
  const canCreate = (catalog?.Definitions?.length ?? 0) > 0;

  // The flag is authoritative and resolves fail-closed; an unknown state waits rather than redirecting.
  if (flagStatus === 'disabled') {
    return <Redirect href="/(app)/home" />;
  }

  return (
    <Box className="flex-1 bg-background-0">
      <FocusAwareStatusBar />
      <Stack.Screen options={{ title: t('records.title') }} />

      <ScrollView refreshControl={<RefreshControl refreshing={isSyncing} onRefresh={() => void sync()} />}>
        {flagStatus === 'unknown' ? (
          <HStack className="items-center justify-center p-6" space="sm">
            <Spinner />
            <Text className="text-typography-500">{t('records.loading')}</Text>
          </HStack>
        ) : null}

        {preflight && !preflight.Ok ? (
          <Box className="m-4 rounded-md border border-warning-300 bg-background-warning p-3">
            <Text className="text-sm text-typography-800">{t('records.unavailable')}</Text>
            {(preflight.Reasons ?? []).map((reason) => (
              <Text key={reason} className="mt-1 text-xs text-typography-600">
                {t(`records.reason_${reason}`, { defaultValue: reason })}
              </Text>
            ))}
          </Box>
        ) : null}

        {error ? (
          <Box className="mx-4 mt-4 rounded-md border border-error-300 bg-background-error p-3">
            <Text className="text-sm text-typography-800">{error}</Text>
          </Box>
        ) : null}

        <Section title={t('records.assigned')}>
          {assignments.length === 0 ? (
            <Empty text={t('records.no_assignments')} />
          ) : (
            assignments.map((assignment) => (
              <AssignmentItem key={assignment.AssignmentId} assignment={assignment} onPress={() => router.push(`/records/${assignment.RecordId}`)} testID={`records-assignment-${assignment.AssignmentId}`} />
            ))
          )}
        </Section>

        <Section title={t('records.deployments')}>
          <RecordsEntryRow
            icon={<GlobeIcon size={18} color="#2563eb" />}
            title={t('records.deployments')}
            subtitle={t('records.deployments_home_hint')}
            count={openDeployments}
            onPress={() => router.push('/records/deployments')}
            testID="records-deployments"
          />
          {isAdmin ? (
            <RecordsEntryRow
              icon={<RadioTower size={18} color="#2563eb" />}
              title={t('records.connectors')}
              subtitle={t('records.connectors_home_hint')}
              count={reconciliationCount}
              attention
              onPress={() => router.push('/records/connectors')}
              testID="records-connectors"
            />
          ) : null}
        </Section>

        <Section title={t('records.drafts')}>
          {pending.length === 0 && ownDrafts.length === 0 ? (
            <Empty text={t('records.no_drafts')} />
          ) : (
            <>
              {pending.map((draft) => (
                <PendingDraftItem key={draft.clientRecordId} draft={draft} onPress={() => router.push(`/records/new?draft=${draft.clientRecordId}`)} testID={`records-pending-${draft.clientRecordId}`} />
              ))}
              {ownDrafts.map((record) => (
                <RecordListItem key={record.RecordId} record={record} onPress={() => router.push(`/records/${record.RecordId}`)} testID={`records-draft-${record.RecordId}`} />
              ))}
            </>
          )}
        </Section>

        <Section title={t('records.returned')}>
          {returned.length === 0 ? (
            <Empty text={t('records.no_returned')} />
          ) : (
            returned.map((record) => <RecordListItem key={record.RecordId} record={record} onPress={() => router.push(`/records/${record.RecordId}`)} testID={`records-returned-${record.RecordId}`} />)
          )}
        </Section>

        <Section title={t('records.recent')}>
          {recent.length === 0 ? (
            <Empty text={t('records.no_recent')} />
          ) : (
            recent.slice(0, 25).map((record) => <RecordListItem key={record.RecordId} record={record} onPress={() => router.push(`/records/${record.RecordId}`)} />)
          )}
        </Section>

        {!canCreate && preflight?.Ok ? (
          <Box className="m-4">
            <Text className="text-sm text-typography-500">{t('records.nothing_to_create')}</Text>
            <Button variant="outline" size="sm" className="mt-2" onPress={() => void fetchCatalog()}>
              <ButtonText>{t('records.refresh_catalog')}</ButtonText>
            </Button>
          </Box>
        ) : null}

        <Box className="h-24" />
      </ScrollView>

      {canCreate ? (
        <Fab onPress={() => router.push('/records/new')} testID="records-new-fab">
          <FabIcon as={Plus} />
        </Fab>
      ) : null}
    </Box>
  );
}
