import { AlertTriangleIcon, GitBranchIcon, InfoIcon, PinIcon, RefreshCwIcon, ZapIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { conditionResultKey, fallbackStepKey, formatMarginSeconds, formatResponseSeconds, isConditionUncertain, operandDisplay, parseServerUtc, pinSourceKey, timeSourceKey } from '@/lib/run-card-conditions';
import { formatDateForDisplay } from '@/lib/utils';
import { RecommendationOutcome, type RunCardConditionData, RunCardConditionResult, RunCardConditionType, type RunCardDecisionData } from '@/models/v4/runcards/dispatchRecommendationResultData';

interface RunCardDecisionSectionProps {
  decision: RunCardDecisionData;
  /**
   * Walks the decision graph again instead of using the decision pinned when the call was saved. Only offered for a call
   * already out whose decision is pinned; a New Call preview is always fresh.
   */
  onReevaluate?: () => void;
  isReevaluating?: boolean;
  testID: string;
}

/** One tested condition: what it asked, which way it went, and the times it compared. */
const ConditionRow: React.FC<{ condition: RunCardConditionData; index: number; testID: string; isDark: boolean }> = ({ condition, index, testID, isDark }) => {
  const { t } = useTranslation();
  const none = t('run_cards.conditions.none_available');
  const noTime = t('run_cards.conditions.no_time');
  const uncertain = isConditionUncertain(condition);
  const isYes = condition.Result === RunCardConditionResult.Yes;

  let detail: string | null = null;

  if (condition.ConditionType === RunCardConditionType.ArrivesBefore) {
    detail = t('run_cards.conditions.arrives_before_detail', {
      subject: operandDisplay(condition.Subject, none),
      subjectTime: formatResponseSeconds(condition.Subject?.ResponseSeconds) ?? noTime,
      reference: operandDisplay(condition.Reference, none),
      referenceTime: formatResponseSeconds(condition.Reference?.ResponseSeconds) ?? noTime,
    });
  } else if (condition.ConditionType === RunCardConditionType.AvailableWithin) {
    detail = t('run_cards.conditions.available_within_detail', {
      count: condition.RequiredCount,
      targets: condition.Subject?.TargetsLabel || none,
      threshold: formatResponseSeconds(condition.ThresholdSeconds) ?? noTime,
      pick: condition.Subject?.ResourceName || none,
      pickTime: formatResponseSeconds(condition.Subject?.ResponseSeconds) ?? noTime,
    });
  }

  const margin = formatMarginSeconds(condition.MarginSeconds);
  const threshold = condition.ConditionType === RunCardConditionType.ArrivesBefore ? formatResponseSeconds(condition.ThresholdSeconds) : null;
  const facts = [t(timeSourceKey(condition.TimeSource)), threshold ? t('run_cards.conditions.threshold', { threshold }) : null, margin ? t('run_cards.conditions.margin', { margin }) : null].filter(
    (part): part is string => !!part
  );

  return (
    <Box className={`rounded border p-2 ${isDark ? 'border-neutral-800' : 'border-neutral-200'}`} testID={`${testID}-condition-${index}`}>
      <HStack className="items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-medium">{condition.Label || t('run_cards.conditions.condition_fallback_label')}</Text>
        <HStack className="items-center gap-1">
          {uncertain ? (
            <Badge action="warning" testID={`${testID}-condition-${index}-uncertain`}>
              <BadgeText>{t('run_cards.conditions.uncertain')}</BadgeText>
            </Badge>
          ) : null}
          <Badge action={isYes ? 'success' : 'muted'} testID={`${testID}-condition-${index}-result`}>
            <BadgeText>{t(conditionResultKey(condition.Result))}</BadgeText>
          </Badge>
        </HStack>
      </HStack>
      {detail ? <Text className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-300">{detail}</Text> : null}
      {facts.length > 0 ? <Text className="text-xs text-neutral-500">{facts.join(' · ')}</Text> : null}
      {condition.Note ? <Text className="text-xs italic text-neutral-500">{condition.Note}</Text> : null}
    </Box>
  );
};

/**
 * How a conditional run card level decided what to ask for: the outcome and its response package, any advice for the
 * dispatcher, each condition tested on the way, the rows that could not be filled as configured (and which of those the
 * call will keep awaiting), and the first-arriving rows. Read-only explanation; the selection itself is the panel's.
 */
export const RunCardDecisionSection: React.FC<RunCardDecisionSectionProps> = ({ decision, onReevaluate, isReevaluating = false, testID }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const sectionTestID = `${testID}-decision`;

  const path = decision.Path ?? [];
  const fallbacks = decision.Fallbacks ?? [];
  const firstArriving = decision.FirstArriving ?? [];
  const advice = decision.AdviceText?.trim();
  const pinnedOn = parseServerUtc(decision.PinnedOn);
  const pinnedTime = pinnedOn ? formatDateForDisplay(pinnedOn, 'MMM dd HH:mm') : t('run_cards.conditions.pinned_unknown_time');
  const isAdvice = decision.Outcome === RecommendationOutcome.Advice;

  return (
    <VStack className="gap-2" testID={sectionTestID}>
      <HStack className="items-center gap-1">
        <GitBranchIcon size={14} color={isDark ? '#a3a3a3' : '#737373'} />
        <Text className="text-xs font-semibold uppercase text-neutral-500">{t('run_cards.conditions.decision_section')}</Text>
      </HStack>

      {decision.OutcomeLabel || decision.PackageName ? (
        <VStack className="gap-0.5">
          {decision.OutcomeLabel ? (
            <Text className="text-sm font-semibold" testID={`${sectionTestID}-outcome`}>
              {t('run_cards.conditions.outcome', { outcome: decision.OutcomeLabel })}
            </Text>
          ) : null}
          {decision.PackageName && !isAdvice ? (
            <Text className="text-xs text-neutral-500" testID={`${sectionTestID}-package`}>
              {t('run_cards.conditions.package', { package: decision.PackageName })}
            </Text>
          ) : null}
        </VStack>
      ) : null}

      {/* Advice is the outcome when the card only advises: it must not read like a footnote. */}
      {advice ? (
        <Box className={`rounded-lg border-l-4 border-blue-500 p-3 ${isDark ? 'bg-blue-950' : 'bg-blue-50'}`} testID={`${sectionTestID}-advice`}>
          <HStack className="items-start gap-2">
            <InfoIcon size={16} color={isDark ? '#93c5fd' : '#1d4ed8'} />
            <VStack className="flex-1">
              <Text className={`text-xs font-semibold uppercase ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{t('run_cards.conditions.advice_title')}</Text>
              <Text className={`text-sm font-medium ${isDark ? 'text-blue-100' : 'text-blue-900'}`}>{advice}</Text>
            </VStack>
          </HStack>
        </Box>
      ) : null}

      {decision.Uncertain ? (
        <HStack className="items-start gap-1" testID={`${sectionTestID}-uncertain`}>
          <AlertTriangleIcon size={14} color="#d97706" />
          <Text className="flex-1 text-xs text-amber-600">{t('run_cards.conditions.decision_uncertain')}</Text>
        </HStack>
      ) : null}

      {path.length > 0 ? (
        <VStack className="gap-1" testID={`${sectionTestID}-path`}>
          {path.map((condition, index) => (
            <ConditionRow key={`rc-cond-${condition.NodeKey ?? index}`} condition={condition} index={index} testID={sectionTestID} isDark={isDark} />
          ))}
        </VStack>
      ) : null}

      {decision.IdealConfigurationUnavailable || fallbacks.length > 0 ? (
        <Box className={`rounded-lg border p-2 ${isDark ? 'border-amber-800 bg-amber-950' : 'border-amber-300 bg-amber-50'}`} testID={`${sectionTestID}-fallbacks`}>
          <HStack className="items-center gap-1">
            <AlertTriangleIcon size={14} color="#d97706" />
            <Text className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-400">{t('run_cards.conditions.ideal_unavailable')}</Text>
          </HStack>
          {fallbacks.map((fallback, index) => (
            <VStack key={`rc-fallback-${fallback.RequirementScope}-${fallback.RequirementId}-${index}`} className="mt-1" testID={`${sectionTestID}-fallback-${index}`}>
              <Text className="text-xs text-amber-800 dark:text-amber-300">
                {t(fallbackStepKey(fallback.Step, !!fallback.SentInstead), {
                  row: fallback.RowLabel || t('run_cards.conditions.row_fallback_label'),
                  sent: fallback.SentInstead ?? '',
                  package: fallback.SubstitutePackageName || t('run_cards.conditions.substitute_package_fallback'),
                  filled: fallback.FilledCount,
                  required: fallback.RequiredCount,
                })}
              </Text>
              {fallback.Outstanding ? (
                <Text className="text-xs font-semibold text-amber-800 dark:text-amber-300" testID={`${sectionTestID}-fallback-${index}-outstanding`}>
                  {t('run_cards.conditions.keeps_awaiting')}
                </Text>
              ) : null}
            </VStack>
          ))}
        </Box>
      ) : null}

      {firstArriving.length > 0 ? (
        <VStack className="gap-0.5" testID={`${sectionTestID}-first-arriving`}>
          <HStack className="items-center gap-1">
            <ZapIcon size={14} color={isDark ? '#a3a3a3' : '#737373'} />
            <Text className="text-xs font-semibold uppercase text-neutral-500">{t('run_cards.conditions.first_arriving_section')}</Text>
          </HStack>
          {firstArriving.map((row, index) => (
            <Text key={`rc-first-${index}`} className="text-xs text-neutral-600 dark:text-neutral-300">
              {t('run_cards.conditions.first_arriving_line', {
                row: row.RowLabel || t('run_cards.conditions.row_fallback_label'),
                resource: row.ResourceName || t('run_cards.conditions.none_available'),
                time: formatResponseSeconds(row.ResponseSeconds) ?? t('run_cards.conditions.no_time'),
              })}
              {row.AlreadyIncluded ? ` (${t('run_cards.conditions.first_arriving_included')})` : ''}
            </Text>
          ))}
        </VStack>
      ) : null}

      {decision.Pinned ? (
        <HStack className="flex-wrap items-center justify-between gap-2" testID={`${sectionTestID}-pinned`}>
          <HStack className="flex-1 items-center gap-1">
            <PinIcon size={12} color={isDark ? '#a3a3a3' : '#737373'} />
            <Text className="flex-1 text-xs text-neutral-500">{t(pinSourceKey(decision.PinSource), { time: pinnedTime })}</Text>
          </HStack>
          {onReevaluate ? (
            <Button size="xs" variant="outline" action="secondary" onPress={onReevaluate} isDisabled={isReevaluating} testID={`${sectionTestID}-reevaluate`}>
              {isReevaluating ? <Spinner size="small" /> : <RefreshCwIcon size={12} color={isDark ? '#e5e5e5' : '#404040'} />}
              <ButtonText>{t('run_cards.conditions.reevaluate')}</ButtonText>
            </Button>
          ) : null}
        </HStack>
      ) : null}
    </VStack>
  );
};
