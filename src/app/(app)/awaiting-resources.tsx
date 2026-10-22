import { type Href, router, Stack, useFocusEffect } from 'expo-router';
import { HourglassIcon, MapPinIcon, RefreshCwIcon, SendIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';

import { DismissRequirementModal } from '@/components/awaiting-resources/dismiss-requirement-modal';
import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { ResponseCodeChip } from '@/components/runcards/response-code-chip';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { FlatList } from '@/components/ui/flat-list';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAnalytics } from '@/hooks/use-analytics';
import { awaitingCallLabel, formatResponseSeconds, minutesSinceServerUtc } from '@/lib/run-card-conditions';
import { type AwaitingResourceRequirementData, type AwaitingResourcesCallData, type DispatchResponseCodeData } from '@/models/v4/awaitingResources/awaitingResourcesResultData';
import { useAwaitingResourcesStore } from '@/stores/awaiting-resources/store';
import { FeatureFlagKeys, useFeatureFlagStatus, useIsRunCardConditionsEnabled } from '@/stores/feature-flags/store';
import { useSecurityStore } from '@/stores/security/store';

interface DismissTarget {
  callId: number;
  requirement: AwaitingResourceRequirementData;
}

/** One requirement of a waiting call: what is awaited, what went instead, and the units that could go now. */
const RequirementBlock: React.FC<{
  call: AwaitingResourcesCallData;
  requirement: AwaitingResourceRequirementData;
  canAct: boolean;
  busyKey: string | null;
  isDark: boolean;
  responseCodes: DispatchResponseCodeData[];
  onDispatch: (callId: number, unitId: number) => void;
  onDismiss: (target: DismissTarget) => void;
}> = ({ call, requirement, canAct, busyKey, isDark, responseCodes, onDispatch, onDismiss }) => {
  const { t } = useTranslation();
  const waiting = minutesSinceServerUtc(requirement.CreatedOn);
  const testID = `awaiting-requirement-${requirement.CallOutstandingRequirementId}`;
  const callLabel = awaitingCallLabel(call);
  // Newer servers send the code's id; older ones only its text, so fall back to matching the text in the catalog.
  const code = requirement.ResponseCode
    ? (requirement.ResponseCodeId != null ? responseCodes.find((entry) => entry.Id === requirement.ResponseCodeId) : undefined) ?? responseCodes.find((entry) => entry.Code === requirement.ResponseCode)
    : undefined;

  return (
    <Box className={`mt-2 rounded-lg border p-3 ${isDark ? 'border-neutral-700 bg-neutral-900' : 'border-neutral-200 bg-neutral-50'}`} testID={testID}>
      <HStack className="items-start justify-between gap-2">
        <VStack className="flex-1">
          <HStack className="flex-wrap items-center gap-2">
            <Text className="font-semibold">{t('awaiting_resources.requirement_progress', { label: requirement.Label, resolved: requirement.ResolvedCount, required: requirement.RequiredCount })}</Text>
            <ResponseCodeChip code={requirement.ResponseCode} name={code?.Name} color={code?.Color} testID={`${testID}-code`} />
          </HStack>
          {requirement.SentInstead ? <Text className="text-xs text-neutral-600 dark:text-neutral-300">{t('awaiting_resources.sent_instead', { sent: requirement.SentInstead })}</Text> : null}
          {waiting !== null ? <Text className="text-xs text-neutral-500">{t('awaiting_resources.waiting_minutes', { minutes: waiting })}</Text> : null}
        </VStack>
        {canAct ? (
          <Button
            size="xs"
            variant="outline"
            action="secondary"
            onPress={() => onDismiss({ callId: call.CallId, requirement })}
            isDisabled={busyKey === `dismiss:${requirement.CallOutstandingRequirementId}`}
            testID={`${testID}-dismiss`}
          >
            <ButtonText>{t('awaiting_resources.dismiss')}</ButtonText>
          </Button>
        ) : null}
      </HStack>

      {(requirement.AvailableUnits ?? []).length > 0 ? (
        <VStack className="mt-2 gap-1">
          <Text className="text-xs font-semibold uppercase text-neutral-500">{t('awaiting_resources.available_units')}</Text>
          {requirement.AvailableUnits.map((unit) => {
            const response = formatResponseSeconds(unit.ResponseSeconds);
            const isBusy = busyKey === `dispatch:${call.CallId}:${unit.UnitId}`;

            return (
              <HStack key={`awaiting-unit-${requirement.CallOutstandingRequirementId}-${unit.UnitId}`} className="items-center justify-between gap-2" testID={`${testID}-unit-${unit.UnitId}`}>
                <VStack className="flex-1">
                  <Text className="text-sm font-medium">{unit.UnitTypeName ? `${unit.UnitName} (${unit.UnitTypeName})` : unit.UnitName}</Text>
                  {response ? <Text className="text-xs text-neutral-500">{t('awaiting_resources.response_time', { time: response })}</Text> : null}
                </VStack>
                {canAct ? (
                  <Button
                    size="xs"
                    action="primary"
                    onPress={() => onDispatch(call.CallId, unit.UnitId)}
                    isDisabled={isBusy}
                    accessibilityLabel={t('awaiting_resources.dispatch_unit_to_call', { unit: unit.UnitName, call: callLabel })}
                    testID={`${testID}-unit-${unit.UnitId}-dispatch`}
                  >
                    {isBusy ? <ActivityIndicator size="small" color="#ffffff" /> : <SendIcon size={14} color="#ffffff" />}
                    <ButtonText>{t('awaiting_resources.dispatch')}</ButtonText>
                  </Button>
                ) : null}
              </HStack>
            );
          })}
        </VStack>
      ) : (
        <Text className="mt-2 text-xs italic text-neutral-500" testID={`${testID}-no-units`}>
          {t('awaiting_resources.no_units_available')}
        </Text>
      )}
    </Box>
  );
};

/**
 * Calls awaiting resources (conditional run cards): calls that went out without a required resource marked "keep
 * outstanding", because it was not available. Each requirement shows what went instead and the matching units available
 * now, with one-step Dispatch (adds the unit to the call, notifies only it) and Dismiss. Highest priority, then oldest,
 * first. The list stays current through the `outstandingRequirementsUpdated` push.
 */
export default function AwaitingResources() {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isEnabled = useIsRunCardConditionsEnabled();
  const conditionsStatus = useFeatureFlagStatus(FeatureFlagKeys.DispatchRunCardConditions);
  const { canUserCreateCalls } = useSecurityStore();

  const calls = useAwaitingResourcesStore((state) => state.calls);
  const isLoading = useAwaitingResourcesStore((state) => state.isLoading);
  const error = useAwaitingResourcesStore((state) => state.error);
  const lastFetched = useAwaitingResourcesStore((state) => state.lastFetched);
  const busyKey = useAwaitingResourcesStore((state) => state.busyKey);
  const allResponseCodes = useAwaitingResourcesStore((state) => state.allResponseCodes);
  const fetchAwaitingCalls = useAwaitingResourcesStore((state) => state.fetchAwaitingCalls);
  const dispatchUnit = useAwaitingResourcesStore((state) => state.dispatchUnit);
  const dismissRequirement = useAwaitingResourcesStore((state) => state.dismissRequirement);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dismissTarget, setDismissTarget] = useState<DismissTarget | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (isEnabled) {
        void fetchAwaitingCalls();
      }
    }, [isEnabled, fetchAwaitingCalls])
  );

  useEffect(() => {
    trackEvent('awaiting_resources_view_rendered', { callsCount: calls.length });
  }, [trackEvent, calls.length]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchAwaitingCalls().finally(() => setIsRefreshing(false));
  }, [fetchAwaitingCalls]);

  const handleDispatch = useCallback(
    (callId: number, unitId: number) => {
      void dispatchUnit(callId, unitId);
    },
    [dispatchUnit]
  );

  const handleDismissConfirm = useCallback(
    async (note: string) => {
      const target = dismissTarget;
      if (!target) {
        return;
      }

      const dismissed = await dismissRequirement(target.callId, target.requirement.CallOutstandingRequirementId, note);
      if (dismissed) {
        setDismissTarget(null);
      }
    },
    [dismissTarget, dismissRequirement]
  );

  const canAct = !!canUserCreateCalls;

  const renderCall = useCallback(
    ({ item }: { item: AwaitingResourcesCallData }) => {
      const age = minutesSinceServerUtc(item.LoggedOn);
      const callLabel = awaitingCallLabel(item);

      return (
        <Box className={`mb-3 rounded-xl border-l-4 p-4 shadow-xs ${isDark ? 'bg-gray-800' : 'bg-white'}`} style={{ borderLeftColor: item.PriorityColor || '#6b7280' }} testID={`awaiting-call-${item.CallId}`}>
          <Pressable onPress={() => router.push(`/call/${item.CallId}` as Href)} accessibilityRole="link" testID={`awaiting-call-${item.CallId}-open`}>
            <HStack className="items-start justify-between gap-2">
              <VStack className="flex-1">
                <Text className="text-base font-bold" numberOfLines={2}>
                  {item.CallName ? `${callLabel} · ${item.CallName}` : callLabel}
                </Text>
                <HStack className="flex-wrap items-center gap-2">
                  {item.PriorityName ? (
                    <HStack className="items-center gap-1">
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.PriorityColor || '#6b7280' }} />
                      <Text className="text-xs text-neutral-600 dark:text-neutral-300">{item.PriorityName}</Text>
                    </HStack>
                  ) : null}
                  {age !== null ? <Text className="text-xs text-neutral-500">{t('awaiting_resources.call_age', { minutes: age })}</Text> : null}
                </HStack>
              </VStack>
              <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400">{t('awaiting_resources.open_call')}</Text>
            </HStack>
            {item.Address ? (
              <HStack className="mt-1 items-center gap-1">
                <MapPinIcon size={12} color={isDark ? '#9ca3af' : '#6b7280'} />
                <Text className="flex-1 text-xs text-neutral-500" numberOfLines={1}>
                  {item.Address}
                </Text>
              </HStack>
            ) : null}
          </Pressable>

          {(item.Requirements ?? []).map((requirement) => (
            <RequirementBlock
              key={`awaiting-req-${requirement.CallOutstandingRequirementId}`}
              call={item}
              requirement={requirement}
              canAct={canAct}
              busyKey={busyKey}
              responseCodes={allResponseCodes}
              isDark={isDark}
              onDispatch={handleDispatch}
              onDismiss={setDismissTarget}
            />
          ))}
        </Box>
      );
    },
    [isDark, t, canAct, busyKey, allResponseCodes, handleDispatch]
  );

  const content = useMemo(() => {
    if (!isEnabled) {
      // A deep link while flags are still resolving shows the loader rather than a "not available" flash.
      return conditionsStatus === 'unknown' ? <Loading /> : <ZeroState heading={t('awaiting_resources.not_enabled')} description={t('awaiting_resources.not_enabled_description')} icon={HourglassIcon} />;
    }

    // Only the first load replaces the list; a refresh from a push keeps the cards on screen.
    if (isLoading && calls.length === 0 && lastFetched === 0) {
      return <Loading text={t('awaiting_resources.loading')} />;
    }

    if (error && calls.length === 0) {
      return <ZeroState heading={t('common.errorOccurred')} description={error} isError={true} />;
    }

    if (calls.length === 0) {
      return <ZeroState heading={t('awaiting_resources.empty_title')} description={t('awaiting_resources.empty_description')} icon={HourglassIcon} />;
    }

    return (
      <FlatList<AwaitingResourcesCallData>
        testID="awaiting-resources-list"
        data={calls}
        renderItem={renderCall}
        keyExtractor={(item: AwaitingResourcesCallData) => String(item.CallId)}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    );
  }, [isEnabled, conditionsStatus, isLoading, calls, lastFetched, error, renderCall, isRefreshing, handleRefresh, t]);

  return (
    <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
      <FocusAwareStatusBar />
      <Stack.Screen
        options={{
          title: t('awaiting_resources.title'),
          headerShown: true,
          headerBackTitle: '',
        }}
      />
      <Box className="flex-1 px-4 pt-4">
        {isEnabled ? (
          <HStack className="mb-3 items-center justify-between">
            <VStack className="flex-1">
              <Text className="text-lg font-bold">{t('awaiting_resources.title')}</Text>
              <Text className="text-xs text-neutral-500">{t('awaiting_resources.subtitle')}</Text>
            </VStack>
            <Pressable onPress={handleRefresh} accessibilityRole="button" accessibilityLabel={t('common.retry')} testID="awaiting-resources-refresh">
              {isRefreshing ? <ActivityIndicator size="small" /> : <RefreshCwIcon size={18} color={isDark ? '#a3a3a3' : '#737373'} />}
            </Pressable>
          </HStack>
        ) : null}
        <Box className="flex-1">{content}</Box>
      </Box>
      <DismissRequirementModal
        isOpen={!!dismissTarget}
        requirementLabel={dismissTarget?.requirement.Label ?? null}
        isSubmitting={!!dismissTarget && busyKey === `dismiss:${dismissTarget.requirement.CallOutstandingRequirementId}`}
        onConfirm={(note) => void handleDismissConfirm(note)}
        onClose={() => setDismissTarget(null)}
      />
    </View>
  );
}
