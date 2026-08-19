import { type Href, router } from 'expo-router';
import { AlertCircle, Bell, MailIcon, MessageCircle, Phone, Users } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/modal';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAnalytics } from '@/hooks/use-analytics';
import { isSafeRouteId, type NotificationType, usePushNotificationModalStore } from '@/stores/push-notification/store';

interface NotificationIconProps {
  type: NotificationType;
  size?: number;
  color?: string;
}

const NotificationIcon = ({ type }: { type: NotificationType }) => {
  const iconProps = {
    size: 24,
    color: '$red500',
    testID: 'notification-icon',
  };

  switch (type) {
    case 'call':
      return <Phone {...iconProps} />;
    case 'message':
      return <MailIcon {...iconProps} />;
    case 'chat':
      return <MessageCircle {...iconProps} />;
    case 'group-chat':
      return <Users {...iconProps} />;
    default:
      return <Bell {...iconProps} />;
  }
};

export const PushNotificationModal: React.FC = () => {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { isOpen, notification, hideNotificationModal } = usePushNotificationModalStore();

  const handleClose = () => {
    if (notification) {
      trackEvent('push_notification_modal_dismissed', {
        type: notification.type,
        id: notification.id,
        eventCode: notification.eventCode,
      });
    }
    hideNotificationModal();
  };

  const handleViewCall = () => {
    if (notification?.type === 'call' && isSafeRouteId(notification.id)) {
      trackEvent('push_notification_view_call_pressed', {
        id: notification.id,
        eventCode: notification.eventCode,
      });

      hideNotificationModal();
      router.push(`/call/${notification.id}` as Href);
    }
  };

  const handleViewMessage = () => {
    if ((notification?.type === 'message' || notification?.type === 'chat' || notification?.type === 'group-chat') && notification.id) {
      trackEvent('push_notification_view_message_pressed', {
        id: notification.id,
        eventCode: notification.eventCode,
        type: notification.type,
      });

      hideNotificationModal();
      // TODO: Navigate to message detail when messages feature is implemented
      // For now, we just log that the user wants to view the message
      // router.push(`/messages/${notification.id}`);
    }
  };

  const getNotificationTypeText = (type: NotificationType): string => {
    switch (type) {
      case 'call':
        return t('push_notifications.types.call');
      case 'message':
        return t('push_notifications.types.message');
      case 'chat':
        return t('push_notifications.types.chat');
      case 'group-chat':
        return t('push_notifications.types.group_chat');
      default:
        return t('push_notifications.types.notification');
    }
  };

  const getNotificationColor = (type: NotificationType): string => {
    switch (type) {
      case 'call':
        return '#EF4444'; // Red for calls
      case 'message':
        return '#3B82F6'; // Blue for messages
      case 'chat':
        return '#10B981'; // Green for chat
      case 'group-chat':
        return '#8B5CF6'; // Purple for group chat
      default:
        return '#6B7280'; // Gray for unknown
    }
  };

  if (!notification) {
    return null;
  }

  const iconColor = getNotificationColor(notification.type);
  const typeText = getNotificationTypeText(notification.type);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" {...({} as any)}>
      <ModalBackdrop />
      <ModalContent className="mx-4">
        <ModalHeader className="pb-4">
          <HStack className="items-center space-x-3">
            <NotificationIcon type={notification.type} />
            <VStack className="flex-1">
              <Text className="text-lg font-semibold">{t('push_notifications.new_notification')}</Text>
              <Text className="text-sm text-gray-600 dark:text-gray-400">{typeText}</Text>
            </VStack>
          </HStack>
        </ModalHeader>

        <ModalBody className="py-4">
          <VStack className="space-y-3">
            {notification.title ? (
              <VStack className="space-y-1">
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('push_notifications.title')}</Text>
                <Text className="text-base">{notification.title}</Text>
              </VStack>
            ) : null}

            {notification.body ? (
              <VStack className="space-y-1">
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('push_notifications.message')}</Text>
                <Text className="text-base">{notification.body}</Text>
              </VStack>
            ) : null}

            {notification.type === 'unknown' ? (
              <HStack className="mt-2 items-center space-x-2 rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900">
                <AlertCircle size={20} color="#F59E0B" />
                <Text className="flex-1 text-sm text-yellow-800 dark:text-yellow-200">{t('push_notifications.unknown_type_warning')}</Text>
              </HStack>
            ) : null}
          </VStack>
        </ModalBody>

        <ModalFooter className="pt-4">
          <HStack className="w-full space-x-3">
            {notification.type === 'call' && isSafeRouteId(notification.id) ? (
              <>
                <Button variant="outline" className="flex-1" onPress={handleClose}>
                  <ButtonText>{t('common.dismiss')}</ButtonText>
                </Button>
                <Button className="flex-1" onPress={handleViewCall}>
                  <ButtonText>{t('push_notifications.view_call')}</ButtonText>
                </Button>
              </>
            ) : (notification.type === 'message' || notification.type === 'chat' || notification.type === 'group-chat') && notification.id ? (
              <>
                <Button variant="outline" className="flex-1" onPress={handleClose}>
                  <ButtonText>{t('common.dismiss')}</ButtonText>
                </Button>
                <Button className="flex-1" onPress={handleViewMessage}>
                  <ButtonText>{t('push_notifications.view_message')}</ButtonText>
                </Button>
              </>
            ) : (
              <Button className="w-full" onPress={handleClose}>
                <ButtonText>{t('common.ok')}</ButtonText>
              </Button>
            )}
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
