import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { createDirectMessage } from '@/api/chat/chat';
import { logger } from '@/lib/logging';
import { useToastStore } from '@/stores/toast/store';

/**
 * Opens a 1:1 conversation with someone and navigates to it.
 *
 * The server dedups on a normalized participant key, so calling this repeatedly for the same person
 * reuses the existing conversation rather than starting a new one — which is what makes it safe to
 * hang a "message" button off every contact on an incident.
 */
export const useDirectMessage = () => {
  const { t } = useTranslation();
  const [isOpening, setIsOpening] = useState(false);

  const openDirectMessage = useCallback(
    async (targetUserId?: string | null) => {
      if (!targetUserId) {
        useToastStore.getState().showToast('info', t('incident_command.dm_unavailable'));
        return;
      }

      setIsOpening(true);
      try {
        const channel = await createDirectMessage({ TargetUserId: targetUserId });
        const channelId = channel?.Data?.ChatChannelId;
        if (!channelId) {
          useToastStore.getState().showToast('error', t('incident_command.dm_failed'));
          return;
        }
        router.push(`/chat/${channelId}`);
      } catch (error) {
        logger.error({ message: 'chat: failed to open direct message', context: { error, targetUserId } });
        useToastStore.getState().showToast('error', t('incident_command.dm_failed'));
      } finally {
        setIsOpening(false);
      }
    },
    [t]
  );

  return { openDirectMessage, isOpening };
};
