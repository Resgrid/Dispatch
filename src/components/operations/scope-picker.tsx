import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { dateOf, reportScope, scopeKey, scopeName, sumHours, type TimeScope } from '@/lib/operations/time';
import type { Deployment, TimeReport } from '@/models/v4/operations';

export const useScopeLabel = () => {
  const { t } = useTranslation();
  return (deployment: Deployment, scope: TimeScope | null) => {
    if (!scope) return '';
    if (scope.kind === 'deployment') return t('operations.scope.deployment');
    if (scope.kind === 'individual' && scope.personnelId === deployment.TimeAccess?.PersonnelId) return t('operations.scope.mine');
    return scope.kind === 'crew' ? t('operations.scope.crew', { name: scopeName(deployment, scope) }) : t('operations.scope.individual', { name: scopeName(deployment, scope) });
  };
};

interface ScopePickerProps {
  deployment: Deployment;
  scopes: TimeScope[];
  current: TimeScope | null;
  onPick: (scope: TimeScope) => void;
}

// Which report the person is working on: their crew's Crew Time Report, their own time, or — for a manager —
// the deployment-wide DTR. Only the scopes the server's TimeAccess grants are offered.
export const ScopePicker = ({ deployment, scopes, current, onPick }: ScopePickerProps) => {
  const label = useScopeLabel();
  if (scopes.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {scopes.map((scope) => (
        <Button key={scopeKey(scope)} size="sm" variant={scopeKey(scope) === scopeKey(current) ? 'solid' : 'outline'} onPress={() => onPick(scope)} testID={`operations-scope-${scopeKey(scope)}`}>
          <ButtonText>{label(deployment, scope)}</ButtonText>
        </Button>
      ))}
    </ScrollView>
  );
};

interface DayReportsProps {
  deployment: Deployment;
  reports: TimeReport[];
  openId: string | null;
  onOpen: (report: TimeReport) => void;
}

// Every live report on the day (managers and approvers): who it covers, its status and hours, so a supervisor
// can open each crew's report to review and approve it.
export const DayReports = ({ deployment, reports, openId, onOpen }: DayReportsProps) => {
  const { t } = useTranslation();
  const label = useScopeLabel();
  if (reports.length === 0) return null;
  return (
    <VStack space="xs" testID="operations-day-reports">
      <Text className="font-semibold">{t('operations.time.dayReports')}</Text>
      {reports.map((report) => (
        <Pressable key={report.Id} onPress={() => onOpen(report)} testID={`operations-day-report-${report.Id}`} className={`rounded-lg border p-2 ${report.Id === openId ? 'border-primary-500' : 'border-outline-200'}`}>
          <HStack className="items-center justify-between">
            <Text className="flex-1">
              #{report.ReportNumber} · {label(deployment, reportScope(report))}
            </Text>
            <Text className="text-typography-500">
              {t(`operations.reportStatus.${report.Status}`)} · {t('operations.time.hours', { hours: sumHours(report.Entries) })}
            </Text>
          </HStack>
          <Text className="text-typography-500">{dateOf(report.ReportDate)}</Text>
        </Pressable>
      ))}
    </VStack>
  );
};

interface AwaitingApprovalProps {
  deployment: Deployment;
  reports: TimeReport[];
  onOpen: (report: TimeReport) => void;
}

/** Submitted reports on any day, oldest first: the approver's queue for this deployment. */
export const AwaitingApproval = ({ deployment, reports, onOpen }: AwaitingApprovalProps) => {
  const { t } = useTranslation();
  const label = useScopeLabel();
  if (reports.length === 0) return null;
  return (
    <VStack space="xs" className="rounded-lg bg-background-50 p-3" testID="operations-awaiting-approval">
      <Text className="font-semibold">{t('operations.time.awaitingApproval', { count: reports.length })}</Text>
      {reports.map((report) => (
        <Pressable key={report.Id} onPress={() => onOpen(report)} testID={`operations-awaiting-${report.Id}`}>
          <Text className="text-primary-600">
            {dateOf(report.ReportDate)} · #{report.ReportNumber} · {label(deployment, reportScope(report))}
          </Text>
        </Pressable>
      ))}
    </VStack>
  );
};
