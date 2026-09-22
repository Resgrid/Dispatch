import { Redirect, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { MarsPanel } from '@/components/operations/mars-panel';
import { TimeReportEditor } from '@/components/operations/time-report-editor';
import { UsageForm } from '@/components/operations/usage-form';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { operationsCapabilities } from '@/lib/operations/capabilities';
import { localDateKey, rosterSubjects } from '@/lib/operations/time';
import { DeploymentFinanceMode } from '@/models/v4/operations';
import useAuthStore from '@/stores/auth/store';
import { useDeploymentsStatus } from '@/stores/feature-flags/store';
import { useOperationsStore } from '@/stores/operations/store';

type Section = 'time' | 'usage' | 'mars';

const shiftDay = (dateKey: string, days: number) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return localDateKey(new Date(y, m - 1, d + days));
};

// One deployment: the daily time report for a chosen day, resource usage readings and the MARS F-42
// state. What the person may edit follows the server's access answer and this app's capabilities.
export default function OperationsDeploymentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const flagStatus = useDeploymentsStatus();
  const userId = useAuthStore((state) => state.userId);
  const { access, costAccess, marsAccess, deployment, report, entries, dirty, issues, warnings, usage, marsItems, validation, busy, error } = useOperationsStore();
  const [dateKey, setDateKey] = useState(localDateKey());
  const dateRef = useRef(dateKey);
  const [section, setSection] = useState<Section>('time');

  useFocusEffect(
    useCallback(() => {
      if (flagStatus !== 'enabled' || !id) return undefined;
      void (async () => {
        const store = useOperationsStore.getState();
        if (!store.access) await store.loadAccess();
        if (!useOperationsStore.getState().access?.Enabled) return;
        await useOperationsStore.getState().open(id);
        await useOperationsStore.getState().openReport(dateRef.current, false);
        await Promise.all([useOperationsStore.getState().loadUsage(), useOperationsStore.getState().loadMars()]);
      })();
      return () => useOperationsStore.getState().close();
    }, [flagStatus, id])
  );

  const activeUnitId = operationsCapabilities.useActiveUnitId();
  const subjects = useMemo(() => (deployment ? rosterSubjects(deployment, { userId: userId ?? null, activeUnitId, manager: !!access?.CanManage }) : []), [deployment, userId, activeUnitId, access?.CanManage]);
  const canEditTime = operationsCapabilities.editTime && !!access?.Enabled && subjects.length > 0;
  const showUsage = operationsCapabilities.recordUsage && !!costAccess?.Enabled && !!costAccess.CanRecordUsage;
  const showMars = !!marsAccess?.Enabled && deployment?.FinanceMode === DeploymentFinanceMode.CostRecovery;
  const canDraftF42 = operationsCapabilities.draftF42 && showMars && (!!marsAccess?.CanManage || subjects.length > 0);
  const usageUnits = useMemo(() => {
    if (!deployment) return [];
    const units = deployment.Units.filter((unit) => unit.IsActive);
    if (access?.CanManage || !activeUnitId) return units;
    const mine = units.filter((unit) => String(unit.UnitId) === activeUnitId);
    return mine.length > 0 ? mine : units;
  }, [deployment, access?.CanManage, activeUnitId]);

  const changeDay = (days: number) => {
    const next = shiftDay(dateKey, days);
    dateRef.current = next;
    setDateKey(next);
    void useOperationsStore.getState().openReport(next, false);
  };

  if (flagStatus === 'disabled') return <Redirect href={operationsCapabilities.homeRoute} />;

  return (
    <VStack className="flex-1 bg-background-0">
      <Stack.Screen options={{ title: deployment?.Name ?? t('operations.title') }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <HStack space="sm" className="items-center">
          <Pressable onPress={() => router.back()} testID="operations-back" accessibilityRole="button" accessibilityLabel={t('operations.back')}>
            <ArrowLeft size={22} color="#2563eb" />
          </Pressable>
          <Text className="flex-1 text-xl font-bold">{deployment?.Name ?? t('operations.title')}</Text>
        </HStack>
        {flagStatus === 'unknown' || (busy && !deployment) ? <Spinner /> : null}
        {error ? (
          <Text accessibilityRole="alert" className="text-error-600">
            {t(`operations.errors.${error}`, { defaultValue: t('operations.errors.retry') })}
          </Text>
        ) : null}
        {deployment ? (
          <VStack space="xs">
            <Text className="text-typography-500">
              {t(`operations.status.${deployment.Status}`)} · {t(`operations.financeMode.${deployment.FinanceMode}`)}
            </Text>
            <Text className="text-typography-500">
              {[deployment.IncidentNumber, deployment.RequestNumber, deployment.ResourceOrderNumber, deployment.CostCode].filter(Boolean).join(' · ') || t('operations.noNumbers')}
            </Text>
            <Text className="text-typography-500">
              {t('operations.roster', { units: deployment.Units.filter((unit) => unit.IsActive).length, personnel: deployment.Personnel.filter((person) => person.IsActive).length })}
            </Text>
          </VStack>
        ) : null}
        {deployment ? (
          <HStack space="sm">
            <Button variant={section === 'time' ? 'solid' : 'outline'} size="sm" onPress={() => setSection('time')} testID="operations-section-time">
              <ButtonText>{t('operations.time.title')}</ButtonText>
            </Button>
            {showUsage ? (
              <Button variant={section === 'usage' ? 'solid' : 'outline'} size="sm" onPress={() => setSection('usage')} testID="operations-section-usage">
                <ButtonText>{t('operations.usage.title')}</ButtonText>
              </Button>
            ) : null}
            {showMars ? (
              <Button variant={section === 'mars' ? 'solid' : 'outline'} size="sm" onPress={() => setSection('mars')} testID="operations-section-mars">
                <ButtonText>{t('operations.mars.title')}</ButtonText>
              </Button>
            ) : null}
          </HStack>
        ) : null}
        {deployment && (section === 'time' || section === 'usage') ? (
          <HStack className="items-center justify-between">
            <Pressable onPress={() => changeDay(-1)} testID="operations-day-previous" accessibilityRole="button" accessibilityLabel={t('operations.previousDay')}>
              <ChevronLeft size={22} color="#2563eb" />
            </Pressable>
            <Text className="font-semibold">{dateKey}</Text>
            <Pressable onPress={() => changeDay(1)} testID="operations-day-next" accessibilityRole="button" accessibilityLabel={t('operations.nextDay')}>
              <ChevronRight size={22} color="#2563eb" />
            </Pressable>
          </HStack>
        ) : null}
        {deployment && section === 'time' ? (
          <TimeReportEditor
            dateKey={dateKey}
            report={report}
            entries={entries}
            subjects={subjects}
            issues={issues}
            warnings={warnings}
            canEdit={canEditTime}
            dirty={dirty}
            busy={busy}
            onStart={() => void useOperationsStore.getState().openReport(dateKey, true)}
            onChange={(next) => useOperationsStore.getState().setEntries(next)}
            onSave={() => void useOperationsStore.getState().save()}
            onSubmit={() => void useOperationsStore.getState().submit()}
          />
        ) : null}
        {deployment && section === 'usage' && showUsage ? (
          <UsageForm dateKey={dateKey} units={usageUnits} defaultUnitId={activeUnitId} readings={usage} busy={busy} onAdd={(input) => useOperationsStore.getState().addUsage(input)} />
        ) : null}
        {deployment && section === 'mars' && showMars ? (
          <MarsPanel
            items={marsItems}
            validation={validation}
            canDraft={canDraftF42}
            busy={busy}
            onDraft={() => void useOperationsStore.getState().draftF42()}
            onValidate={(workItemId) => void useOperationsStore.getState().validate(workItemId)}
          />
        ) : null}
      </ScrollView>
    </VStack>
  );
}
