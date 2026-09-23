import { Redirect, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { ExpensesPanel } from '@/components/operations/expenses-panel';
import { MarsPanel } from '@/components/operations/mars-panel';
import { AwaitingApproval, DayReports, ScopePicker, useScopeLabel } from '@/components/operations/scope-picker';
import { TimeReportEditor } from '@/components/operations/time-report-editor';
import { UsageForm } from '@/components/operations/usage-form';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { operationsCapabilities } from '@/lib/operations/capabilities';
import {
  availableScopes,
  canWriteSubject,
  coveringReport,
  dateOf,
  defaultScope,
  localDateKey,
  reportScope,
  reportsOnDate,
  scopeKey,
  scopeName,
  scopeSubjects,
  shiftDateKey,
  subjectNames,
  type TimeScope,
} from '@/lib/operations/time';
import { DeploymentFinanceMode, TimeReportStatus } from '@/models/v4/operations';
import useAuthStore from '@/stores/auth/store';
import { useDeploymentsStatus } from '@/stores/feature-flags/store';
import { useOperationsStore } from '@/stores/operations/store';

type Section = 'time' | 'expenses' | 'usage' | 'mars';

// One deployment: the crew or individual time report for a chosen day, expenses, resource usage readings and
// the MARS F-42 state. What the person may open and write comes from the server's TimeAccess (their roster row,
// the deployed units they crew) and this app's capabilities; approvers get the submitted queue.
export default function OperationsDeploymentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const flagStatus = useDeploymentsStatus();
  const userId = useAuthStore((state) => state.userId);
  const { costAccess, marsAccess, deployment, reports, scope, report, entries, dirty, issues, warnings, expenses, usage, marsItems, validation, busy, error } = useOperationsStore();
  const [dateKey, setDateKey] = useState(localDateKey());
  const dateRef = useRef(dateKey);
  const [section, setSection] = useState<Section>('time');
  const activeUnitId = operationsCapabilities.useActiveUnitId();
  const activeUnitRef = useRef(activeUnitId);
  activeUnitRef.current = activeUnitId;
  const scopeLabel = useScopeLabel();

  useFocusEffect(
    useCallback(() => {
      if (flagStatus !== 'enabled' || !id) return undefined;
      void (async () => {
        const store = useOperationsStore.getState();
        if (!store.access) await store.loadAccess();
        if (!useOperationsStore.getState().access?.Enabled) return;
        await useOperationsStore.getState().open(id);
        const opened = useOperationsStore.getState().deployment;
        if (opened) useOperationsStore.getState().setScope(defaultScope(opened, activeUnitRef.current), dateRef.current);
        await Promise.all([useOperationsStore.getState().loadExpenses(), useOperationsStore.getState().loadUsage(), useOperationsStore.getState().loadMars()]);
      })();
      return () => useOperationsStore.getState().close();
    }, [flagStatus, id])
  );

  const access = deployment?.TimeAccess ?? null;
  const scopes = useMemo(() => (deployment ? availableScopes(deployment) : []), [deployment]);
  const names = useMemo(() => (deployment ? subjectNames(deployment) : {}), [deployment]);
  // The picker offers the subjects of the open report's own scope (a manager may open any report on the day).
  const openScope: TimeScope | null = report ? reportScope(report) : scope;
  const subjects = useMemo(() => (deployment ? scopeSubjects(deployment, openScope) : []), [deployment, openScope]);
  const dayReports = useMemo(() => reportsOnDate(reports, dateKey), [reports, dateKey]);
  const awaiting = useMemo(() => reports.filter((candidate) => candidate.Status === TimeReportStatus.Submitted).sort((a, b) => a.ReportDate.localeCompare(b.ReportDate)), [reports]);
  const canApprove = operationsCapabilities.approveTime && !!access?.CanApprove;
  const supervises = !!access?.CanManage || canApprove;
  const covered = useMemo(() => {
    if (report || !scope) return null;
    const subject = scope.kind === 'crew' ? scope.unitId : scope.kind === 'individual' ? scope.personnelId : null;
    return subject ? coveringReport(reports, dateKey, subject) : null;
  }, [report, scope, reports, dateKey]);
  const canCreate = operationsCapabilities.editTime && !!scope && (scope.kind !== 'deployment' || !!access?.CanManage);
  const writable = useCallback((subjectId: string) => !!deployment && canWriteSubject(deployment, subjectId), [deployment]);
  const showUsage = operationsCapabilities.recordUsage && !!costAccess?.Enabled && !!costAccess.CanRecordUsage;
  const showExpenses = operationsCapabilities.recordExpenses && (access?.CanManage || (access?.WritableSubjectIds.length ?? 0) > 0);
  const showMars = !!marsAccess?.Enabled && deployment?.FinanceMode === DeploymentFinanceMode.CostRecovery;
  const canDraftF42 = operationsCapabilities.draftF42 && showMars && (!!marsAccess?.CanManage || (access?.WritableSubjectIds.length ?? 0) > 0);
  const usageUnits = useMemo(() => {
    if (!deployment) return [];
    const units = deployment.Units.filter((unit) => unit.IsActive);
    if (access?.CanManage) return units;
    const crewed = units.filter((unit) => access?.CrewUnitIds.includes(unit.Id));
    const mine = activeUnitId ? crewed.filter((unit) => String(unit.UnitId) === activeUnitId) : [];
    return mine.length > 0 ? mine : crewed;
  }, [deployment, access, activeUnitId]);

  const changeDay = (days: number) => {
    const next = shiftDateKey(dateKey, days);
    dateRef.current = next;
    setDateKey(next);
    useOperationsStore.getState().setScope(useOperationsStore.getState().scope, next);
  };

  const openReport = (target: { Id: string; ReportDate: string }) => {
    const day = dateOf(target.ReportDate);
    dateRef.current = day;
    setDateKey(day);
    setSection('time');
    useOperationsStore.getState().selectReport(target.Id);
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
            {access && access.CrewUnitIds.length > 0 ? (
              <Text className="text-typography-500">
                {t('operations.crewOf', {
                  names: access.CrewUnitIds.map((unitId) => scopeName(deployment, { kind: 'crew', unitId }))
                    .filter(Boolean)
                    .join(', '),
                })}
              </Text>
            ) : null}
          </VStack>
        ) : null}
        {deployment ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Button variant={section === 'time' ? 'solid' : 'outline'} size="sm" onPress={() => setSection('time')} testID="operations-section-time">
              <ButtonText>{t('operations.time.title')}</ButtonText>
            </Button>
            {showExpenses ? (
              <Button variant={section === 'expenses' ? 'solid' : 'outline'} size="sm" onPress={() => setSection('expenses')} testID="operations-section-expenses">
                <ButtonText>{t('operations.expenses.title')}</ButtonText>
              </Button>
            ) : null}
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
          </ScrollView>
        ) : null}
        {deployment && section !== 'mars' ? (
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
          <VStack space="md">
            {canApprove ? <AwaitingApproval deployment={deployment} reports={awaiting} onOpen={openReport} /> : null}
            <ScopePicker deployment={deployment} scopes={scopes} current={scope} onPick={(next) => useOperationsStore.getState().setScope(next, dateKey)} />
            {supervises ? <DayReports deployment={deployment} reports={dayReports} openId={report?.Id ?? null} onOpen={openReport} /> : null}
            {scopes.length === 0 && !supervises ? <Text className="text-typography-500">{t('operations.time.notOnRoster')}</Text> : null}
            {scope || report ? (
              <TimeReportEditor
                key={`${scopeKey(openScope)}:${dateKey}:${report?.Id ?? 'none'}`}
                dateKey={dateKey}
                report={report}
                entries={entries}
                subjects={subjects}
                names={names}
                scopeLabel={openScope ? scopeName(deployment, openScope) || scopeLabel(deployment, openScope) : ''}
                isCrew={openScope?.kind === 'crew'}
                coveredBy={covered}
                issues={issues}
                warnings={warnings}
                canCreate={canCreate}
                canApprove={canApprove}
                canWrite={writable}
                dirty={dirty}
                busy={busy}
                onStart={() => void useOperationsStore.getState().openReport(dateKey, true)}
                onChange={(next) => useOperationsStore.getState().setEntries(next)}
                onSave={() => void useOperationsStore.getState().save()}
                onSubmit={() => void useOperationsStore.getState().submit()}
                onSign={(crewBoss, customer) => void useOperationsStore.getState().sign(crewBoss, customer)}
                onApprove={() => report && void useOperationsStore.getState().approve(report.Id)}
              />
            ) : null}
          </VStack>
        ) : null}
        {deployment && section === 'expenses' && showExpenses ? (
          <ExpensesPanel
            dateKey={dateKey}
            currency={deployment.Currency}
            expenses={expenses}
            reportId={report?.CanAct && report.Status === TimeReportStatus.Draft ? report.Id : null}
            userId={userId ?? null}
            canManage={!!access?.CanManage}
            canAdd={deployment.Status <= 3}
            busy={busy}
            onAdd={(input) => useOperationsStore.getState().addExpense(input)}
            onRemove={(expenseId) => useOperationsStore.getState().removeExpense(expenseId)}
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
