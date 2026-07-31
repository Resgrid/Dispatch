import { X } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';

import { type ToastType, useToastStore } from '../../stores/toast/store';
import { Toast, ToastDescription, ToastTitle } from '../ui/toast';

export const ToastMessage: React.FC<{
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  onPress?: () => void;
}> = ({ id, type, title, message, onPress }) => {
  const removeToast = useToastStore((state) => state.removeToast);
  const { t } = useTranslation();

  return (
    <Pressable onPress={onPress} disabled={!onPress} testID={`toast-${id}`}>
      <Toast className="rounded-lg border" action={type}>
        <HStack className="w-full items-start justify-between" space="sm">
          <VStack className="flex-1" space="xs">
            {title && <ToastTitle className="font-medium text-white">{t(title)}</ToastTitle>}
            <ToastDescription className="text-white">{t(message)}</ToastDescription>
          </VStack>
          <Pressable onPress={() => removeToast(id)} hitSlop={8} testID={`toast-dismiss-${id}`}>
            <X size={16} color="#fff" />
          </Pressable>
        </HStack>
      </Toast>
    </Pressable>
  );
};
