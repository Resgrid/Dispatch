import { useColorScheme } from 'nativewind';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';

import { DispatchUnitRow, DispatchUserRow } from '@/components/calls/dispatch-recipient-rows';
import { Loading } from '@/components/common/loading';
import { TypeIcon } from '@/components/common/type-icon';
import { RecommendationPanel } from '@/components/runcards/recommendation-panel';
import { useAddResourcesRecommendation } from '@/components/runcards/use-add-resources-recommendation';
import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '@/components/ui/actionsheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { CheckIcon, SearchIcon, UsersIcon, X } from '@/components/ui/lucide-icons';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { isDispatchUnitAvailable, isDispatchUserAvailable, NEAREST_BADGE_COUNT, orderRecipients, rankBoardPersonnel, rankBoardUnits, type RecipientSort } from '@/lib/dispatch-board';
import { recommendedUnitIds, recommendedUserIds } from '@/lib/run-cards';
import { type DispatchRecommendationResultData } from '@/models/v4/runcards/dispatchRecommendationResultData';
import { boardKeyFor, type DispatchSelection, filterDispatchData, useDispatchStore } from '@/stores/dispatch/store';

/** Extras that ride a confirmed selection when adding resources (conditional run cards). */
export interface DispatchSelectionConfirmExtras {
  /** UnitResponseCodes for the save: the recommended units being added, with the response codes picked for them. */
  unitResponseCodes?: string;
}

interface DispatchSelectionModalProps {
  isVisible: boolean;
  onClose: () => void;
  /** `extras` is passed only when there is something in it, so callers that ignore it see the call they always did. */
  onConfirm: (selection: DispatchSelection, extras?: DispatchSelectionConfirmExtras) => void;
  initialSelection?: DispatchSelection;
  /**
   * Set when adding resources to a call already out: the picker then offers the run card's recommendation for what the
   * call still needs, counted against what it already has.
   */
  callId?: string | null;
  /**
   * The call's location. With it, personnel and units are ranked by response time to the call, with distance, ETA and a
   * "Nearest" badge (the nearest-unit board); without it they are listed by name.
   */
  callLocation?: { latitude: number; longitude: number } | null;
  /**
   * New Call's run card recommendation, so the rows it proposes carry a "Run card" badge. When adding resources to a
   * call (callId), the picker's own recommendation for what the call still needs is badged as well.
   */
  recommendation?: DispatchRecommendationResultData | null;
}

/** A usable call location: numbers, not 0,0 (what a call without a location carries). */
const usableLocation = (location: DispatchSelectionModalProps['callLocation']) =>
  location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude) && !(location.latitude === 0 && location.longitude === 0) ? location : null;

const SortChip: React.FC<{ label: string; active: boolean; onPress: () => void; testID: string }> = ({ label, active, onPress, testID }) => (
  <TouchableOpacity onPress={onPress} testID={testID} accessibilityRole="button" accessibilityState={{ selected: active }}>
    <Box className={`rounded-full border px-3 py-1 ${active ? 'border-blue-500 bg-blue-500' : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'}`}>
      <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>{label}</Text>
    </Box>
  </TouchableOpacity>
);

export const DispatchSelectionModal: React.FC<DispatchSelectionModalProps> = ({ isVisible, onClose, onConfirm, initialSelection, callId, callLocation, recommendation }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const {
    data,
    selection,
    isLoading,
    error,
    loadFailures,
    searchQuery,
    fetchDispatchData,
    setSelection,
    toggleEveryone,
    toggleUser,
    toggleGroup,
    toggleRole,
    toggleUnit,
    setSearchQuery,
    clearSelection,
    board = null,
    boardKey = null,
    isBoardLoading = false,
    boardError = false,
    fetchNearestBoard,
  } = useDispatchStore();

  const hasLoadFailure = loadFailures.users || loadFailures.groups || loadFailures.roles || loadFailures.units;

  const filteredData = useMemo(() => filterDispatchData(data, searchQuery), [data, searchQuery]);

  const location = usableLocation(callLocation);
  const locationLatitude = location?.latitude;
  const locationLongitude = location?.longitude;
  // Only a board built for this call's location ranks the rows.
  const callBoard = location && boardKey === boardKeyFor(location.latitude, location.longitude) ? board : null;
  const [sort, setSort] = useState<RecipientSort>('closest');
  const [availableOnly, setAvailableOnly] = useState(false);

  useEffect(() => {
    if (isVisible && typeof locationLatitude === 'number' && typeof locationLongitude === 'number') {
      void fetchNearestBoard?.(locationLatitude, locationLongitude);
    }
  }, [isVisible, locationLatitude, locationLongitude, fetchNearestBoard]);

  const personnelRanks = useMemo(() => rankBoardPersonnel(callBoard), [callBoard]);
  const unitRanks = useMemo(() => rankBoardUnits(callBoard), [callBoard]);

  const orderedUsers = useMemo(
    () => orderRecipients(filteredData.users, personnelRanks, { sort, availableOnly, selectedIds: selection.users, isAvailable: isDispatchUserAvailable }),
    [filteredData.users, personnelRanks, sort, availableOnly, selection.users]
  );
  const orderedUnits = useMemo(
    () => orderRecipients(filteredData.units, unitRanks, { sort, availableOnly, selectedIds: selection.units, isAvailable: isDispatchUnitAvailable }),
    [filteredData.units, unitRanks, sort, availableOnly, selection.units]
  );

  const addResources = useAddResourcesRecommendation({ callId, enabled: isVisible && !!callId });

  // What the run card proposes: New Call's recommendation and, when adding resources, what the call still needs.
  const addResourcesRecommendation = callId && addResources.isRunCardsEnabled ? addResources.recommendation : null;
  const runCardUnits = useMemo(() => new Set([...recommendedUnitIds(recommendation ?? null), ...recommendedUnitIds(addResourcesRecommendation ?? null)]), [recommendation, addResourcesRecommendation]);
  const runCardUsers = useMemo(() => new Set([...recommendedUserIds(recommendation ?? null), ...recommendedUserIds(addResourcesRecommendation ?? null)]), [recommendation, addResourcesRecommendation]);

  const handleApplyRecommendation = () => {
    setSelection(addResources.applyToSelection(selection));
  };

  useEffect(() => {
    if (isVisible) {
      fetchDispatchData();
      if (initialSelection) {
        setSelection(initialSelection);
      }
    }
  }, [isVisible, initialSelection, fetchDispatchData, setSelection]);

  const handleConfirm = () => {
    // Response codes the dispatcher saw on the run card proposal for the units being added (none unless the
    // department has conditional run cards and a code catalog).
    const unitResponseCodes = callId && !selection.everyone ? addResources.getUnitResponseCodes?.(selection.units) : undefined;
    if (unitResponseCodes) {
      onConfirm(selection, { unitResponseCodes });
    } else {
      onConfirm(selection);
    }
    onClose();
  };

  const handleCancel = () => {
    clearSelection();
    onClose();
  };

  const getSelectionCount = () => {
    if (selection.everyone) return 1;
    return selection.users.length + selection.groups.length + selection.roles.length + selection.units.length;
  };

  return (
    <Actionsheet isOpen={isVisible} onClose={handleCancel} snapPoints={[80]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="w-full bg-white dark:bg-gray-900">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        {/* Header */}
        <HStack className="w-full items-center justify-between border-b border-gray-200 p-2 pb-3 dark:border-gray-700">
          <HStack className="flex-1 items-center">
            <UsersIcon size={22} color={colorScheme === 'dark' ? '#d1d5db' : '#374151'} />
            <Text className="pl-3 text-lg font-bold" numberOfLines={1}>
              {t('calls.select_dispatch_recipients')}
            </Text>
          </HStack>
          <TouchableOpacity onPress={handleCancel} className="p-1">
            <X size={22} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />
          </TouchableOpacity>
        </HStack>

        {/* Search */}
        <Box className="w-full px-2 py-3">
          <Input>
            <SearchIcon size={20} className="ml-3 mr-2 text-neutral-500" />
            <InputField placeholder={t('common.search')} value={searchQuery} onChangeText={setSearchQuery} className="flex-1" />
          </Input>
        </Box>

        {/* Content */}
        {isLoading ? (
          <Box className="w-full flex-1 items-center justify-center">
            <Loading />
          </Box>
        ) : error ? (
          <Box className="w-full flex-1 items-center justify-center p-4">
            <Text className="text-center text-red-500">{error}</Text>
            <Button variant="outline" className="mt-4" onPress={() => fetchDispatchData(true)}>
              <ButtonText>{t('common.retry')}</ButtonText>
            </Button>
          </Box>
        ) : (
          <ScrollView className="w-full flex-1 px-2" keyboardShouldPersistTaps="handled">
            {/* Partial load warning — the sections that did load are still usable. */}
            {hasLoadFailure && (
              <Card className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
                <HStack className="items-center justify-between gap-3">
                  <Text className="flex-1 text-sm text-amber-700">{t('calls.dispatch_recipients_partial_load')}</Text>
                  <TouchableOpacity onPress={() => fetchDispatchData(true)}>
                    <Text className="text-sm font-semibold text-blue-500">{t('common.retry')}</Text>
                  </TouchableOpacity>
                </HStack>
              </Card>
            )}

            {/* Run card recommendation for what the call still needs (adding resources only). */}
            {callId && addResources.isRunCardsEnabled ? (
              <RecommendationPanel
                recommendation={addResources.recommendation}
                isLoading={addResources.isLoading}
                error={addResources.error}
                hasFetched={addResources.hasFetched}
                isApplied={addResources.isApplied}
                onApply={handleApplyRecommendation}
                onRefresh={() => void addResources.refresh()}
                coveredMessage={t('run_cards.covered_on_call', { level: addResources.recommendation?.AlarmLevel ?? 1 })}
                isExistingCall
                conditions={addResources.conditions}
                testID="add-resources-recommendation"
              />
            ) : null}

            {/* How the people and units below are ordered: closest to the call (with a location) or by name. */}
            <VStack className="mb-4 gap-2">
              <HStack className="flex-wrap items-center gap-2">
                {location ? (
                  <>
                    <SortChip label={t('calls.dispatch_board.sort_closest')} active={sort === 'closest'} onPress={() => setSort('closest')} testID="dispatch-sort-closest" />
                    <SortChip label={t('calls.dispatch_board.sort_name')} active={sort === 'name'} onPress={() => setSort('name')} testID="dispatch-sort-name" />
                  </>
                ) : null}
                <SortChip label={t('calls.dispatch_board.available_only')} active={availableOnly} onPress={() => setAvailableOnly(!availableOnly)} testID="dispatch-available-only" />
                {location && isBoardLoading ? <ActivityIndicator size="small" testID="dispatch-board-loading" /> : null}
              </HStack>
              <Text className="text-xs text-gray-500 dark:text-gray-400" testID="dispatch-board-hint">
                {!location
                  ? t('calls.dispatch_board.set_location_to_rank')
                  : boardError
                    ? t('calls.dispatch_board.board_error')
                    : isBoardLoading && !callBoard
                      ? t('calls.dispatch_board.loading_board')
                      : t('calls.dispatch_board.ranked_from_location')}
              </Text>
            </VStack>

            {/* Everyone Option */}
            <Card className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
              <TouchableOpacity onPress={toggleEveryone}>
                <HStack className="items-center gap-3">
                  <Box className={`size-6 items-center justify-center rounded border-2 ${selection.everyone ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
                    {selection.everyone ? <CheckIcon size={16} color="#ffffff" /> : null}
                  </Box>
                  <VStack className="flex-1">
                    <Text className="pl-4 text-lg font-semibold">{t('calls.everyone')}</Text>
                    <Text className="pl-4 text-sm text-neutral-500">{t('calls.dispatch_to_everyone')}</Text>
                  </VStack>
                </HStack>
              </TouchableOpacity>
            </Card>

            {/* Users Section */}
            {orderedUsers.length > 0 && (
              <VStack className="mb-6">
                <Text className="mb-3 text-lg font-semibold">
                  {t('calls.users')} ({orderedUsers.length})
                </Text>
                {orderedUsers.map((user) => {
                  const rank = personnelRanks.get(user.Id);
                  return (
                    <DispatchUserRow
                      key={`user-${user.Id}`}
                      user={user}
                      rank={rank}
                      selected={selection.users.includes(user.Id)}
                      available={isDispatchUserAvailable(user, rank)}
                      showNearest={!!rank?.nearestRank && rank.nearestRank <= NEAREST_BADGE_COUNT}
                      recommended={runCardUsers.has(user.Id)}
                      onToggle={toggleUser}
                    />
                  );
                })}
              </VStack>
            )}

            {/* Groups Section */}
            {filteredData.groups.length > 0 && (
              <VStack className="mb-6">
                <Text className="mb-3 text-lg font-semibold">
                  {t('calls.groups')} ({filteredData.groups.length})
                </Text>
                {filteredData.groups.map((group) => (
                  <Card key={`group-${group.Id}`} className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                    <TouchableOpacity onPress={() => toggleGroup(group.Id)}>
                      <HStack className="items-center gap-3">
                        <Box className={`size-5 items-center justify-center rounded border-2 ${selection.groups.includes(group.Id) ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
                          {selection.groups.includes(group.Id) ? <CheckIcon size={12} color="#ffffff" /> : null}
                        </Box>
                        <VStack className="flex-1">
                          <Text className="pl-4 font-medium">{group.Name}</Text>
                        </VStack>
                      </HStack>
                    </TouchableOpacity>
                  </Card>
                ))}
              </VStack>
            )}

            {/* Roles Section */}
            {filteredData.roles.length > 0 && (
              <VStack className="mb-6">
                <Text className="mb-3 text-lg font-semibold">
                  {t('calls.roles')} ({filteredData.roles.length})
                </Text>
                {filteredData.roles.map((role) => (
                  <Card key={`role-${role.Id}`} className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                    <TouchableOpacity onPress={() => toggleRole(role.Id)}>
                      <HStack className="items-center gap-3">
                        <Box className={`size-5 items-center justify-center rounded border-2 ${selection.roles.includes(role.Id) ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
                          {selection.roles.includes(role.Id) ? <CheckIcon size={12} color="#ffffff" /> : null}
                        </Box>
                        <VStack className="flex-1">
                          <HStack className="items-center gap-2 pl-4">
                            <TypeIcon iconUrl={role.TypeIconUrl} size={20} testID={`dispatch-role-icon-${role.Id}`} />
                            <Text className="font-medium">{role.Name}</Text>
                          </HStack>
                        </VStack>
                      </HStack>
                    </TouchableOpacity>
                  </Card>
                ))}
              </VStack>
            )}

            {/* Units Section */}
            {orderedUnits.length > 0 && (
              <VStack className="mb-6">
                <Text className="mb-3 text-lg font-semibold">
                  {t('calls.units')} ({orderedUnits.length})
                </Text>
                {orderedUnits.map((unit) => {
                  const rank = unitRanks.get(unit.Id);
                  return (
                    <DispatchUnitRow
                      key={`unit-${unit.Id}`}
                      unit={unit}
                      rank={rank}
                      selected={selection.units.includes(unit.Id)}
                      available={isDispatchUnitAvailable(unit, rank)}
                      showNearest={!!rank?.nearestRank && rank.nearestRank <= NEAREST_BADGE_COUNT}
                      recommended={runCardUnits.has(unit.Id)}
                      onToggle={toggleUnit}
                    />
                  );
                })}
              </VStack>
            )}

            {/* No Results */}
            {!!searchQuery && orderedUsers.length === 0 && filteredData.groups.length === 0 && filteredData.roles.length === 0 && orderedUnits.length === 0 && (
              <Box className="items-center justify-center py-8">
                <Text className="text-center text-neutral-500">{t('common.no_results_found')}</Text>
              </Box>
            )}

            {/* Everything loaded and there is genuinely nothing to pick beyond Everyone. Say so, rather
                than leaving the dispatcher staring at a single option wondering what broke. */}
            {!searchQuery && !hasLoadFailure && data.users.length === 0 && data.groups.length === 0 && data.roles.length === 0 && data.units.length === 0 && (
              <Box className="items-center justify-center px-4 py-8">
                <Text className="text-center text-neutral-500">{t('calls.dispatch_recipients_empty')}</Text>
              </Box>
            )}
          </ScrollView>
        )}

        {/* Footer */}
        <Box className="w-full border-t border-gray-200 p-4 dark:border-gray-700">
          <Text className="mb-3 text-sm text-gray-500 dark:text-gray-400">
            {getSelectionCount()} {t('calls.selected')}
          </Text>
          <HStack space="sm" className="w-full">
            <Button variant="outline" onPress={handleCancel} className="flex-1">
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
            <Button variant="solid" action="primary" onPress={handleConfirm} disabled={getSelectionCount() === 0} className="flex-1">
              <ButtonText>{t('common.confirm')}</ButtonText>
            </Button>
          </HStack>
        </Box>
      </ActionsheetContent>
    </Actionsheet>
  );
};
