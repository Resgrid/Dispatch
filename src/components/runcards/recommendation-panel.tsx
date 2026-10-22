import { AlertTriangleIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, ClipboardListIcon, MoveRightIcon, RefreshCwIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity } from 'react-native';

import { ResponseCodeChip } from '@/components/runcards/response-code-chip';
import { RunCardDecisionSection } from '@/components/runcards/run-card-decision-section';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { effectiveUnitResponseCodeId, type UnitResponseCodeChoices } from '@/lib/run-card-conditions';
import { dispatchModeKey, hasRecommendationContent, personnelDetailParts, selectionReasonKey, shortfallReasonKey, unitDetailParts, unitStatusColors } from '@/lib/run-cards';
import { type DispatchResponseCodeData } from '@/models/v4/awaitingResources/awaitingResourcesResultData';
import { type DispatchRecommendationResultData, type UnitRecommendationData } from '@/models/v4/runcards/dispatchRecommendationResultData';

/**
 * Conditional run cards (Dispatch.RunCardConditions) on the panel: the decision explanation, the row each resource fills,
 * response codes and re-evaluating a pinned decision. Left out (or `enabled` false), the panel shows what a fixed run
 * card shows and nothing more.
 */
export interface RecommendationConditionsProps {
  enabled: boolean;
  /** The department's pickable response codes. Empty hides the per-unit picker; codes the proposal carries still show. */
  responseCodes?: DispatchResponseCodeData[];
  /** The dispatcher's code choices over the proposal (unit id to code id, null for none). */
  unitResponseCodes?: UnitResponseCodeChoices;
  onUnitResponseCodeChange?: (unitId: number, codeId: number | null) => void;
  /** Offered when the decision is pinned (a call already out): walks the decision graph again. */
  onReevaluate?: () => void;
  isReevaluating?: boolean;
}

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
  /**
   * Shown when a card matched but there is nothing to add (adding resources to a call that already covers its run card).
   * Without it that case renders nothing, as on a new call.
   */
  coveredMessage?: string;
  /**
   * Set when adding resources to a call already out. Auto-dispatch only fires at call creation, so its badge and
   * explainer are left out: they would read as if the resources shown here had already been alerted.
   */
  isExistingCall?: boolean;
  /** Conditional run cards; see {@link RecommendationConditionsProps}. */
  conditions?: RecommendationConditionsProps;
  testID?: string;
}

/**
 * The response code a recommended unit goes with, and (when the department has codes) a picker to change it. The chip
 * opens an inline row of the department's codes plus "No code"; picking one closes it.
 */
const UnitResponseCodePicker: React.FC<{ unit: UnitRecommendationData; conditions: RecommendationConditionsProps; testID: string }> = ({ unit, conditions, testID }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isOpen, setIsOpen] = useState(false);

  const codes = conditions.responseCodes ?? [];
  const canPick = codes.length > 0 && !!conditions.onUnitResponseCodeChange;
  const effectiveId = effectiveUnitResponseCodeId(unit, conditions.unitResponseCodes);
  // A proposed code the catalog no longer lists (retired since) still shows as the proposal named it.
  const picked = effectiveId !== null ? codes.find((code) => code.Id === effectiveId) : undefined;
  const isProposal = effectiveId !== null && effectiveId === (unit.ResponseCodeId ?? null);
  const chipCode = picked?.Code ?? (isProposal ? unit.ResponseCode : null);
  const chipName = picked?.Name ?? (isProposal ? unit.ResponseCodeName : null);
  const chipColor = picked?.Color ?? (isProposal ? unit.ResponseCodeColor : null);

  if (!canPick) {
    return chipCode ? <ResponseCodeChip code={chipCode} name={chipName} color={chipColor} testID={`${testID}-code`} /> : null;
  }

  const choose = (codeId: number | null) => {
    conditions.onUnitResponseCodeChange?.(unit.UnitId, codeId);
    setIsOpen(false);
  };

  return (
    <VStack className="items-end gap-1">
      {chipCode ? (
        <ResponseCodeChip code={chipCode} name={chipName} color={chipColor} onPress={() => setIsOpen((open) => !open)} testID={`${testID}-code`} />
      ) : (
        <TouchableOpacity onPress={() => setIsOpen((open) => !open)} accessibilityRole="button" testID={`${testID}-code-add`}>
          <Box className={`rounded border border-dashed px-1.5 py-0.5 ${isDark ? 'border-neutral-600' : 'border-neutral-400'}`}>
            <Text className="text-xs text-neutral-500">{t('run_cards.conditions.response_code_add')}</Text>
          </Box>
        </TouchableOpacity>
      )}
      {isOpen ? (
        <HStack className="flex-wrap justify-end gap-1" testID={`${testID}-code-options`}>
          {codes.map((code) => (
            <ResponseCodeChip
              key={`rc-code-${unit.UnitId}-${code.Id}`}
              code={code.Code}
              name={code.Name}
              color={code.Color}
              isSelected={code.Id === effectiveId}
              onPress={() => choose(code.Id)}
              testID={`${testID}-code-option-${code.Id}`}
            />
          ))}
          <TouchableOpacity onPress={() => choose(null)} accessibilityRole="button" testID={`${testID}-code-option-none`}>
            <Box className={`rounded px-1.5 py-0.5 ${effectiveId === null ? 'border-2 border-blue-500' : `border ${isDark ? 'border-neutral-600' : 'border-neutral-300'}`}`}>
              <Text className="text-xs text-neutral-500">{t('run_cards.conditions.response_code_none')}</Text>
            </Box>
          </TouchableOpacity>
        </HStack>
      ) : null}
    </VStack>
  );
};

/**
 * A recommended unit's status in the status's own colours, as it shows everywhere else, so the dispatcher reads it at a
 * glance. A status with no colour (or from a server that predates the field) gets a plain outlined badge. The border
 * keeps a white or very light status visible on the card.
 */
const UnitStatusBadge: React.FC<{ unit: UnitRecommendationData; isDark: boolean; testID: string }> = ({ unit, isDark, testID }) => {
  if (!unit.CurrentStatusText) {
    return null;
  }

  const colors = unitStatusColors(unit);

  return (
    <Box
      className={`rounded border px-1.5 py-0.5 ${colors ? 'border-black/20' : isDark ? 'border-neutral-700' : 'border-neutral-300'}`}
      style={colors ? { backgroundColor: colors.backgroundColor } : undefined}
      testID={testID}
    >
      <Text className={`text-xs font-medium ${colors ? '' : 'text-neutral-500'}`} style={colors ? { color: colors.color } : undefined}>
        {unit.CurrentStatusText}
      </Text>
    </Box>
  );
};

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
export const RecommendationPanel: React.FC<RecommendationPanelProps> = ({
  recommendation,
  isLoading,
  error,
  hasFetched,
  isApplied,
  onApply,
  onRefresh,
  coveredMessage,
  isExistingCall = false,
  conditions,
  testID = 'run-card-recommendation-panel',
}) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isExpanded, setIsExpanded] = useState(true);
  const showAutoDispatch = !isExistingCall && !!recommendation?.AutoDispatch;
  // Conditional run card extras only with the flag on; a fixed card's recommendation never carries them anyway.
  const showConditions = !!conditions?.enabled;
  const decision = showConditions ? (recommendation?.Decision ?? null) : null;
  const canReevaluate = !!decision?.Pinned && !!conditions?.onReevaluate;

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

  if (hasFetched && !hasContent && coveredMessage && recommendation?.MatchedRunCardId) {
    return (
      <Card className={cardClass} testID={`${testID}-covered`}>
        <HStack className="items-center justify-between gap-3">
          <HStack className="flex-1 items-center gap-2">
            <ClipboardListIcon size={18} color={isDark ? '#60a5fa' : '#2563eb'} />
            <VStack className="flex-1">
              <Text className="font-semibold">{recommendation.MatchedRunCardName || t('run_cards.title')}</Text>
              <Text className="text-xs text-neutral-500">{coveredMessage}</Text>
            </VStack>
          </HStack>
          <TouchableOpacity onPress={onRefresh} testID={`${testID}-refresh`}>
            <RefreshCwIcon size={18} color={isDark ? '#a3a3a3' : '#737373'} />
          </TouchableOpacity>
        </HStack>
        {/* Covered against the decision pinned at save time; things may have changed since, so a fresh walk stays one tap away. */}
        {canReevaluate ? (
          <Box className="mt-2">
            <Button size="xs" variant="outline" action="secondary" onPress={conditions?.onReevaluate} isDisabled={!!conditions?.isReevaluating} testID={`${testID}-decision-reevaluate`}>
              {conditions?.isReevaluating ? <Spinner size="small" /> : <RefreshCwIcon size={12} color={isDark ? '#e5e5e5' : '#404040'} />}
              <ButtonText>{t('run_cards.conditions.reevaluate')}</ButtonText>
            </Button>
          </Box>
        ) : null}
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
            {showAutoDispatch ? (
              <Badge action="success" testID={`${testID}-auto`}>
                <BadgeText>{t('run_cards.auto_dispatch')}</BadgeText>
              </Badge>
            ) : null}
          </HStack>

          {/* Auto-dispatch happens server-side at call creation; saying so avoids the dispatcher
              wondering why applying is optional. */}
          {showAutoDispatch ? <Text className="text-xs text-neutral-500">{t('run_cards.auto_dispatch_explainer')}</Text> : null}

          {decision ? <RunCardDecisionSection decision={decision} onReevaluate={canReevaluate ? conditions?.onReevaluate : undefined} isReevaluating={conditions?.isReevaluating} testID={testID} /> : null}

          {unitCount > 0 ? (
            <VStack className="gap-1">
              <Text className="text-xs font-semibold uppercase text-neutral-500">{t('run_cards.units_section', { count: unitCount })}</Text>
              {recommendation.Units.map((unit) => {
                const details = unitDetailParts(unit);
                return (
                  <Box key={`rc-unit-${unit.UnitId}`} className={`rounded border p-2 ${isDark ? 'border-neutral-800' : 'border-neutral-200'}`}>
                    <HStack className="items-center justify-between gap-2">
                      <VStack className="flex-1">
                        <HStack className="flex-wrap items-center gap-2">
                          <Text className="text-sm font-medium">{unit.UnitName}</Text>
                          <UnitStatusBadge unit={unit} isDark={isDark} testID={`${testID}-unit-${unit.UnitId}-status`} />
                        </HStack>
                        {showConditions && unit.RowLabel ? (
                          <Text className="text-xs font-medium text-blue-600 dark:text-blue-400" testID={`${testID}-unit-${unit.UnitId}-row`}>
                            {t('run_cards.conditions.fills_row', { row: unit.RowLabel })}
                          </Text>
                        ) : null}
                        {details.length > 0 ? <Text className="text-xs text-neutral-500">{details.join(' · ')}</Text> : null}
                      </VStack>
                      <VStack className="items-end gap-1">
                        {showConditions && conditions ? <UnitResponseCodePicker unit={unit} conditions={conditions} testID={`${testID}-unit-${unit.UnitId}`} /> : null}
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
                        {showConditions && person.RowLabel ? (
                          <Text className="text-xs font-medium text-blue-600 dark:text-blue-400" testID={`${testID}-person-${person.UserId}-row`}>
                            {t('run_cards.conditions.fills_row', { row: person.RowLabel })}
                          </Text>
                        ) : null}
                        {details.length > 0 ? <Text className="text-xs text-neutral-500">{details.join(' · ')}</Text> : null}
                      </VStack>
                      <VStack className="items-end gap-1">
                        {/* Codes are posted per unit only, so a person's proposed code is shown, not picked. */}
                        {showConditions ? <ResponseCodeChip code={person.ResponseCode} name={person.ResponseCodeName} color={person.ResponseCodeColor} testID={`${testID}-person-${person.UserId}-code`} /> : null}
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
                <HStack key={`rc-short-${shortfall.IsUnitRequirement ? 'u' : 'p'}-${shortfall.RequirementScope ?? 0}-${shortfall.RequirementId}`} className="flex-wrap items-center gap-1">
                  <Text className="text-xs text-amber-600">
                    {t('run_cards.shortfall_line', {
                      name: shortfall.TypeOrRoleName,
                      filled: shortfall.FilledCount,
                      required: shortfall.RequiredCount,
                      reason: t(shortfallReasonKey(shortfall.Reason)),
                    })}
                  </Text>
                  {/* Kept on the call once saved: it shows on the Awaiting Resources list until a matching resource goes. */}
                  {showConditions && shortfall.Outstanding ? (
                    <Badge action="warning" testID={`${testID}-shortfall-${shortfall.RequirementId}-awaiting`}>
                      <BadgeText>{t('run_cards.conditions.awaiting_marker')}</BadgeText>
                    </Badge>
                  ) : null}
                </HStack>
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

          {/* Refresh stays put even when there is nothing to apply: a shortfall-only recommendation
              is the one most worth re-running, once a unit clears or a crew signs on. */}
          <HStack className="items-center gap-2">
            {canApply ? (
              <Button variant={isApplied ? 'outline' : 'solid'} action="primary" onPress={onApply} className="flex-1" testID={`${testID}-apply`}>
                {isApplied ? <CheckIcon size={16} color={isDark ? '#e5e5e5' : '#404040'} /> : null}
                <ButtonText>{isApplied ? t('run_cards.applied') : t('run_cards.apply')}</ButtonText>
              </Button>
            ) : null}
            <TouchableOpacity onPress={onRefresh} testID={`${testID}-refresh`}>
              <RefreshCwIcon size={18} color={isDark ? '#a3a3a3' : '#737373'} />
            </TouchableOpacity>
          </HStack>
        </VStack>
      ) : null}
    </Card>
  );
};
