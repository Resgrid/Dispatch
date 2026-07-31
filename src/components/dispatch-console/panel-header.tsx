import { ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

interface PanelHeaderProps {
  title: string;
  icon: React.ComponentType<any>;
  iconColor?: string;
  count?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  rightContent?: React.ReactNode;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({ title, icon, iconColor = '#6366f1', count, isCollapsed, onToggleCollapse, isExpanded, onToggleExpand, rightContent }) => {
  return (
    <Pressable onPress={onToggleCollapse}>
      <HStack className="items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
        <HStack className="items-center" space="sm">
          <Icon as={icon} size="sm" color={iconColor} />
          <Text className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</Text>
          {typeof count === 'number' ? (
            <HStack className="rounded-full bg-indigo-100 px-2 py-0.5 dark:bg-indigo-900">
              <Text className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{count}</Text>
            </HStack>
          ) : null}
        </HStack>

        <HStack className="items-center" space="xs">
          {rightContent}
          {onToggleExpand ? (
            <Pressable onPress={onToggleExpand} style={styles.iconButton}>
              <Icon as={isExpanded ? Minimize2 : Maximize2} size="xs" className="text-gray-500 dark:text-gray-400" />
            </Pressable>
          ) : null}
          {onToggleCollapse ? <Icon as={isCollapsed ? ChevronUp : ChevronDown} size="sm" className="text-gray-500 dark:text-gray-400" /> : null}
        </HStack>
      </HStack>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  iconButton: {
    padding: 4,
  },
});
