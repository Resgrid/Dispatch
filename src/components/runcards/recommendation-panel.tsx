import { AlertTriangleIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, ClipboardListIcon, MoveRightIcon, RefreshCwIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity } from 'react-native';

import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { dispatchModeKey, hasRecommendationContent, personnelDetailParts, selectionReasonKey, shortfallReasonKey, unitDetailParts } from '@/lib/run-cards';
import { type DispatchRecommendationResultData } from '@/models/v4/runcards/dispatchRecommendationResultData';

interface RecommendationPanelProps {
  recommendation: DispatchRecommendationResultData | null;
  isLoading: boolean;
  error: string | null;
  /** True once a fetch settled — distinguishes "not asked yet" from "asked, nothing matched". */
  hasFetched: boolean;
  /** Set once the dispatcher applies the recommendation, so the button reflects it. */
  isApplied: boolean;
  onApply: () => void;
  onRefresh: () => void;
  testID?: string;
}

/**
 * Explainability panel for a run card recommendation.
 *
 * Deliberately advisory: applying it only pre-checks the dispatch selection the dispatcher was
 * going to make by hand. Nothing here dispatches anything, so a wrong recommendation costs a click
 * to undo rather than an unwanted response.
 *
 * The caller is responsible for gating this behind the `Dispatch.RunCards` feature flag — the panel
 * renders nothing on its own when there is no recommendation, but it should not even be mounted for
 * a department that does not use run cards.
 */
export const RecommendationPanel: React.FC<RecommendationPanelProps> = ({ recommendation, isLoading, error, hasFetched, isApplied, onApply, onRefresh, testID = 'run-card-recommendation-panel' }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleExpanded = useCallback(() => setIsExpanded((previous) => !previous), []);

  const hasContent = useMemo(() => hasRecommendationContent(recommendation), [recommendation]);
  const unitCount = recommendation?.Units?.length ?? 0;
  const personnelCount = recommendation?.Personnel?.length ?? 0;
  const canApply = unitCount > 0 || personnelCount > 0;

  const cardClass = `mb-4 rounded-lg border p-4 ${isDark ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`;

  if (isLoading) {
    return (
      <Card className={cardClass} testID={`${testID}-loading`}>
        <HStack className="items-center gap-3">
          <Spinner size="small" />
          <Text className="text-sm text-neutral-500">{t('run_cards.checking')}</Text>
        </HStack>
      </Card>
    );
  }

  if (error) {
    // A failed lookup must not read as "no run card applies" — that would quietly hide a response
    // plan the department depends on. It also must not block the manual flow, hence the soft tone.
    return (
      <Card className={cardClass} testID={`${testID}-error`}>
        <HStack className="items-center justify-between gap-3">
          <Text className="flex-1 text-sm text-amber-600">{t('run_cards.lookup_failed')}</Text>
          <TouchableOpacity onPress={onRefresh} testID={`${testID}-retry`}>
            <HStack className="items-center gap-1">
              <RefreshCwIcon size={14} color={isDark ? '#60a5fa' : '#2563eb'} />
              <Text className="text-sm font-semibold text-blue-500">{t('common.retry')}</Text>
            </HStack>
          </TouchableOpacity>
        </HStack>
      </Card>
    );
  }

  // Nothing asked for yet, or a department that has run cards on but none matching this call: stay
  // out of the way entirely rather than showing an empty box on every new call.
  if (!hasFetched || !hasContent || !recommendation) {
    return null;
  }

  return (
    <Card className={cardClass} testID={testID}>
      <TouchableOpacity onPress={toggleExpanded} testID={`${testID}-header`}>
        <HStack className="items-center justify-between">
          <HStack className="flex-1 items-center gap-2">
            <ClipboardListIcon size={18} color={isDark ? '#60a5fa' : '#2563eb'} />
            <VStack className="flex-1">
              <Text className="font-semibold">{recommendation.MatchedRunCardName || t('run_cards.title')}</Text>
              <Text className="text-xs text-neutral-500">
                {t('run_cards.summary', {
                  units: unitCount,
                  personnel: personnelCount,
                })}
              </Text>
            </VStack>
          </HStack>
          {isExpanded ? <ChevronUpIcon size={18} color={isDark ? '#a3a3a3' : '#737373'} /> : <ChevronDownIcon size={18} color={isDark ? '#a3a3a3' : '#737373'} />}
        </HStack>
      </TouchableOpacity>

      {isExpanded ? (
        <VStack className="mt-3 gap-3">
          <HStack className="flex-wrap items-center gap-2">
            <Badge action="info" testID={`${testID}-mode`}>
              <BadgeText>{t(dispatchModeKey(recommendation.ModeUsed))}</BadgeText>
            </Badge>
            {recommendation.AlarmLevel > 1 ? (
              <Badge action="warning">
                <BadgeText>{t('run_cards.alarm_level', { level: recommendation.AlarmLevel })}</BadgeText>
              </Badge>
            ) : null}
            {recommendation.AutoDispatch ? (
              <Badge action="success" testID={`${testID}-auto`}>
                <BadgeText>{t('run_cards.auto_dispatch')}</BadgeText>
              </Badge>
            ) : null}
          </HStack>

          {/* Auto-dispatch happens server-side at call creation; saying so avoids the dispatcher
              wondering why applying is optional. */}
          {recommendation.AutoDispatch ? <Text className="text-xs text-neutral-500">{t('run_cards.auto_dispatch_explainer')}</Text> : null}

          {unitCount > 0 ? (
            <VStack className="gap-1">
              <Text className="text-xs font-semibold uppercase text-neutral-500">{t('run_cards.units_section', { count: unitCount })}</Text>
              {recommendation.Units.map((unit) => {
                const details = unitDetailParts(unit);
                return (
                  <Box key={`rc-unit-${unit.UnitId}`} className={`rounded border p-2 ${isDark ? 'border-neutral-800' : 'border-neutral-200'}`}>
                    <HStack className="items-center justify-between gap-2">
                      <VStack className="flex-1">
                        <Text className="text-sm font-medium">{unit.UnitName}</Text>
                        {details.length > 0 ? <Text className="text-xs text-neutral-500">{details.join(' · ')}</Text> : null}
                      </VStack>
                      <VStack className="items-end">
                        <Text className="text-xs text-neutral-500">{t(selectionReasonKey(unit.SelectionReason))}</Text>
                        {unit.LocationIsStale ? <Text className="text-xs text-amber-600">{t('run_cards.stale_location')}</Text> : null}
                      </VStack>
                    </HStack>
                  </Box>
                );
              })}
            </VStack>
          ) : null}

          {personnelCount > 0 ? (
            <VStack className="gap-1">
              <Text className="text-xs font-semibold uppercase text-neutral-500">{t('run_cards.personnel_section', { count: personnelCount })}</Text>
              {recommendation.Personnel.map((person) => {
                const details = personnelDetailParts(person);
                return (
                  <Box key={`rc-person-${person.UserId}`} className={`rounded border p-2 ${isDark ? 'border-neutral-800' : 'border-neutral-200'}`}>
                    <HStack className="items-center justify-between gap-2">
                      <VStack className="flex-1">
                        <Text className="text-sm font-medium">{person.Name}</Text>
                        {details.length > 0 ? <Text className="text-xs text-neutral-500">{details.join(' · ')}</Text> : null}
                      </VStack>
                      <VStack className="items-end">
                        <Text className="text-xs text-neutral-500">{t(selectionReasonKey(person.SelectionReason))}</Text>
                        {person.LocationIsStale ? <Text className="text-xs text-amber-600">{t('run_cards.stale_location')}</Text> : null}
                      </VStack>
                    </HStack>
                  </Box>
                );
              })}
            </VStack>
          ) : null}

          {/* Shortfalls are the whole point of showing this panel on a bad day: the card asked for
              three engines and the engine could only find one. */}
          {recommendation.Shortfalls?.length > 0 ? (
            <VStack className="gap-1" testID={`${testID}-shortfalls`}>
              <HStack className="items-center gap-1">
                <AlertTriangleIcon size={14} color="#d97706" />
                <Text className="text-xs font-semibold uppercase text-amber-600">{t('run_cards.shortfalls_section')}</Text>
              </HStack>
              {recommendation.Shortfalls.map((shortfall) => (
                <Text key={`rc-short-${shortfall.IsUnitRequirement ? 'u' : 'p'}-${shortfall.RequirementId}`} className="text-xs text-amber-600">
                  {t('run_cards.shortfall_line', {
                    name: shortfall.TypeOrRoleName,
                    filled: shortfall.FilledCount,
                    required: shortfall.RequiredCount,
                    reason: t(shortfallReasonKey(shortfall.Reason)),
                  })}
                </Text>
              ))}
            </VStack>
          ) : null}

          {recommendation.MoveUps?.length > 0 ? (
            <VStack className="gap-1" testID={`${testID}-moveups`}>
              <HStack className="items-center gap-1">
                <MoveRightIcon size={14} color={isDark ? '#a3a3a3' : '#737373'} />
                <Text className="text-xs font-semibold uppercase text-neutral-500">{t('run_cards.move_ups_section')}</Text>
              </HStack>
              {/* Advisory only — move-ups are never dispatched by the engine. */}
              {recommendation.MoveUps.map((moveUp, index) => (
                <Text key={`rc-moveup-${moveUp.StationGroupId}-${index}`} className="text-xs text-neutral-500">
                  {t('run_cards.move_up_line', {
                    station: moveUp.StationGroupName,
                    resource: moveUp.SuggestedUnitName || moveUp.SuggestedUserName || t('run_cards.move_up_no_donor'),
                    available: moveUp.AvailableAfterDispatch,
                    minimum: moveUp.MinimumRequired,
                  })}
                </Text>
              ))}
            </VStack>
          ) : null}

          {recommendation.Notes?.length > 0 ? (
            <VStack className="gap-0.5" testID={`${testID}-notes`}>
              <Text className="text-xs font-semibold uppercase text-neutral-500">{t('run_cards.notes_section')}</Text>
              {recommendation.Notes.map((note, index) => (
                <Text key={`rc-note-${index}`} className="text-xs text-neutral-400">
                  {note}
                </Text>
              ))}
            </VStack>
          ) : null}

          {canApply ? (
            <HStack className="items-center gap-2">
              <Button variant={isApplied ? 'outline' : 'solid'} action="primary" onPress={onApply} className="flex-1" testID={`${testID}-apply`}>
                {isApplied ? <CheckIcon size={16} color={isDark ? '#e5e5e5' : '#404040'} /> : null}
                <ButtonText>{isApplied ? t('run_cards.applied') : t('run_cards.apply')}</ButtonText>
              </Button>
              <TouchableOpacity onPress={onRefresh} testID={`${testID}-refresh`}>
                <RefreshCwIcon size={18} color={isDark ? '#a3a3a3' : '#737373'} />
              </TouchableOpacity>
            </HStack>
          ) : null}
        </VStack>
      ) : null}
    </Card>
  );
};
