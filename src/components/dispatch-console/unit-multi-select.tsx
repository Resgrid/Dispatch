import { ListChecks, Square, SquareCheck } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type GestureResponderEvent, Platform, Pressable, StyleSheet } from 'react-native';

import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useUnitBulkActionsStore } from '@/stores/dispatch/unit-bulk-actions-store';

// Ctrl/Cmd-click on web adds a unit to a multi-unit selection, as in a desktop list
const isMultiSelectClick = (event?: GestureResponderEvent): boolean => {
  if (Platform.OS !== 'web' || !event) return false;
  const pressEvent = event as unknown as { ctrlKey?: boolean; metaKey?: boolean; nativeEvent?: { ctrlKey?: boolean; metaKey?: boolean } };
  return !!(pressEvent.ctrlKey || pressEvent.metaKey || pressEvent.nativeEvent?.ctrlKey || pressEvent.nativeEvent?.metaKey);
};

/**
 * Multi-unit selection on a units list, so one status change can be applied to several units at once (an ambulance and
 * the MUG that follows it to the hospital, or all apparatus returning from a fire). The selection lives in the bulk unit
 * actions store; the actions panel shows the bulk status form while it holds units.
 */
export function useUnitMultiSelect({ selectedUnitId, onSelectUnit }: { selectedUnitId?: string; onSelectUnit?: (unitId: string) => void }) {
  const isSelectionMode = useUnitBulkActionsStore((s) => s.isSelectionMode);
  const selectedUnitIds = useUnitBulkActionsStore((s) => s.selectedUnitIds);
  const startSelection = useUnitBulkActionsStore((s) => s.startSelection);
  const endSelection = useUnitBulkActionsStore((s) => s.endSelection);
  const toggleUnit = useUnitBulkActionsStore((s) => s.toggleUnit);
  const addUnits = useUnitBulkActionsStore((s) => s.addUnits);
  const clearSelection = useUnitBulkActionsStore((s) => s.clearSelection);

  const selectedUnitIdSet = useMemo(() => new Set(selectedUnitIds), [selectedUnitIds]);

  // Starting a multi-select takes along the unit whose actions are open, and closes its single-unit actions
  const enterSelection = useCallback(
    (unitId?: string) => {
      const seed = selectedUnitId ? [selectedUnitId] : [];
      if (unitId && unitId !== selectedUnitId) seed.push(unitId);
      if (selectedUnitId) onSelectUnit?.(selectedUnitId);
      startSelection(seed);
    },
    [selectedUnitId, onSelectUnit, startSelection]
  );

  const toggleSelectionMode = useCallback(() => {
    if (isSelectionMode) {
      endSelection();
    } else {
      enterSelection();
    }
  }, [isSelectionMode, endSelection, enterSelection]);

  /** A unit tap: in multi-select it adds/removes the unit; returns false when the tap is an ordinary single selection. */
  const handleUnitPress = useCallback(
    (unitId: string, event?: GestureResponderEvent): boolean => {
      if (isSelectionMode) {
        toggleUnit(unitId);
        return true;
      }
      if (isMultiSelectClick(event)) {
        enterSelection(unitId);
        return true;
      }
      return false;
    },
    [isSelectionMode, toggleUnit, enterSelection]
  );

  // A long press starts a multi-select with the unit (the touch counterpart of Ctrl-click)
  const handleUnitLongPress = useCallback(
    (unitId: string) => {
      if (isSelectionMode) {
        toggleUnit(unitId);
      } else {
        enterSelection(unitId);
      }
    },
    [isSelectionMode, toggleUnit, enterSelection]
  );

  return { isSelectionMode, selectedUnitIds, selectedUnitIdSet, toggleSelectionMode, handleUnitPress, handleUnitLongPress, addUnits, clearSelection, endSelection };
}

/** Header button that turns multi-unit selection on and off. */
export const UnitMultiSelectToggle: React.FC<{ isActive: boolean; onPress: () => void }> = ({ isActive, onPress }) => {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      style={StyleSheet.flatten([styles.toggleButton, isActive ? styles.toggleButtonActive : null])}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={t('dispatch.bulk_unit_actions.multi_select')}
      testID="unit-multi-select-toggle"
    >
      <Icon as={ListChecks} size="xs" className={isActive ? 'text-white' : 'text-indigo-500'} />
    </Pressable>
  );
};

/** The check box a unit row shows in multi-select. */
export const UnitSelectionCheckbox: React.FC<{ isChecked: boolean }> = ({ isChecked }) => (
  <Icon as={isChecked ? SquareCheck : Square} size="sm" className={isChecked ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'} />
);

/** Bar under a units list's search while multi-select is on: count, select all, clear, done. */
export const UnitSelectionBar: React.FC<{ selectedCount: number; onSelectAll: () => void; onClear: () => void; onDone: () => void }> = ({ selectedCount, onSelectAll, onClear, onDone }) => {
  const { t } = useTranslation();
  return (
    <HStack className="items-center justify-between border-b border-indigo-200 bg-indigo-50 px-2 py-1.5 dark:border-indigo-800 dark:bg-indigo-950" space="sm">
      <Text className="flex-1 text-xs text-indigo-700 dark:text-indigo-300" numberOfLines={1}>
        {selectedCount > 0 ? t('dispatch.bulk_unit_actions.selected_count', { count: selectedCount }) : t('dispatch.bulk_unit_actions.select_hint')}
      </Text>
      <HStack className="items-center" space="md">
        <Pressable onPress={onSelectAll} hitSlop={6} testID="unit-select-all">
          <Text className="text-xs font-medium text-indigo-600 dark:text-indigo-300">{t('dispatch.bulk_unit_actions.select_all')}</Text>
        </Pressable>
        {selectedCount > 0 ? (
          <Pressable onPress={onClear} hitSlop={6} testID="unit-select-clear">
            <Text className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('dispatch.bulk_unit_actions.clear')}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onDone} hitSlop={6} testID="unit-select-done">
          <Text className="text-xs font-semibold text-indigo-700 dark:text-indigo-200">{t('common.done')}</Text>
        </Pressable>
      </HStack>
    </HStack>
  );
};

const styles = StyleSheet.create({
  toggleButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  toggleButtonActive: {
    backgroundColor: '#6366f1',
  },
});
