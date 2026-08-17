import { CalendarClockIcon, EditIcon, MoreVerticalIcon, Trash2Icon, UserPlusIcon, XIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Pressable } from '@/components/ui/';
import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper, ActionsheetItem, ActionsheetItemText } from '@/components/ui/actionsheet';
import { HStack } from '@/components/ui/hstack';
import { useAnalytics } from '@/hooks/use-analytics';

interface CallDetailMenuProps {
  onEditCall: () => void;
  onCloseCall: () => void;
  onDeleteCall?: () => void;
  onRescheduleCall?: () => void;
  onDispatchMore?: () => void;
  canUserCreateCalls?: boolean;
}

export const useCallDetailMenu = ({ onEditCall, onCloseCall, onDeleteCall, onRescheduleCall, onDispatchMore, canUserCreateCalls = false }: CallDetailMenuProps) => {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { colorScheme } = useColorScheme();
  const [isKebabMenuOpen, setIsKebabMenuOpen] = useState(false);

  // lucide icons draw with `stroke="currentColor"`, which react-native-svg resolves
  // to black — a `className` text colour never reaches them, so they need explicit colors.
  const menuIconColor = colorScheme === 'dark' ? '#d1d5db' : '#374151';
  const destructiveIconColor = colorScheme === 'dark' ? '#f87171' : '#dc2626';

  // Track when call detail menu is opened
  useEffect(() => {
    if (isKebabMenuOpen) {
      trackEvent('call_detail_menu_opened', {
        hasEditAction: canUserCreateCalls,
        hasCloseAction: canUserCreateCalls,
      });
    }
  }, [isKebabMenuOpen, trackEvent, canUserCreateCalls]);

  const openMenu = () => {
    setIsKebabMenuOpen(true);
  };
  const closeMenu = () => setIsKebabMenuOpen(false);

  const HeaderRightMenu = () => {
    // Don't show menu if user doesn't have create calls permission
    if (!canUserCreateCalls) {
      return null;
    }

    return (
      <Pressable onPressIn={openMenu} testID="kebab-menu-button" className="rounded p-2">
        <MoreVerticalIcon size={24} color={menuIconColor} />
      </Pressable>
    );
  };

  const CallDetailActionSheet = () => {
    // Don't show action sheet if user doesn't have create calls permission
    if (!canUserCreateCalls) {
      return null;
    }

    return (
      <Actionsheet isOpen={isKebabMenuOpen} onClose={closeMenu} testID="call-detail-actionsheet">
        <ActionsheetBackdrop />
        <ActionsheetContent className="bg-white dark:bg-gray-900">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          <ActionsheetItem
            onPress={() => {
              closeMenu();
              onEditCall();
            }}
            testID="edit-call-button"
          >
            <HStack className="items-center">
              <EditIcon size={16} color={menuIconColor} className="mr-3" />
              <ActionsheetItemText>{t('call_detail.edit_call')}</ActionsheetItemText>
            </HStack>
          </ActionsheetItem>

          {onDispatchMore ? (
            <ActionsheetItem
              onPress={() => {
                closeMenu();
                onDispatchMore();
              }}
              testID="dispatch-more-button"
            >
              <HStack className="items-center">
                <UserPlusIcon size={16} color={menuIconColor} className="mr-3" />
                <ActionsheetItemText>{t('call_detail.dispatch_more')}</ActionsheetItemText>
              </HStack>
            </ActionsheetItem>
          ) : null}

          {onRescheduleCall ? (
            <ActionsheetItem
              onPress={() => {
                closeMenu();
                onRescheduleCall();
              }}
              testID="reschedule-call-button"
            >
              <HStack className="items-center">
                <CalendarClockIcon size={16} color={menuIconColor} className="mr-3" />
                <ActionsheetItemText>{t('call_detail.reschedule')}</ActionsheetItemText>
              </HStack>
            </ActionsheetItem>
          ) : null}

          <ActionsheetItem
            onPress={() => {
              closeMenu();
              onCloseCall();
            }}
            testID="close-call-button"
          >
            <HStack className="items-center">
              <XIcon size={16} color={menuIconColor} className="mr-3" />
              <ActionsheetItemText>{t('call_detail.close_call')}</ActionsheetItemText>
            </HStack>
          </ActionsheetItem>

          {onDeleteCall ? (
            <ActionsheetItem
              onPress={() => {
                closeMenu();
                onDeleteCall();
              }}
              testID="delete-call-button"
            >
              <HStack className="items-center">
                <Trash2Icon size={16} color={destructiveIconColor} className="mr-3" />
                <ActionsheetItemText className="text-red-600 dark:text-red-400">{t('call_detail.delete_call')}</ActionsheetItemText>
              </HStack>
            </ActionsheetItem>
          ) : null}
        </ActionsheetContent>
      </Actionsheet>
    );
  };

  return {
    HeaderRightMenu,
    CallDetailActionSheet,
    isMenuOpen: isKebabMenuOpen,
    openMenu,
    closeMenu,
  };
};
