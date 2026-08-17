import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { IncidentCommandTab } from '@/components/incident-command/incident-command-tab';
import { FocusAwareStatusBar } from '@/components/ui';

/** Full-screen incident command board for a call (a larger canvas than the call-detail tab). */
export default function CallCommandBoard() {
  const { id } = useLocalSearchParams();
  const callId = Array.isArray(id) ? id[0] : id;
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('incident_command.title'), headerShown: true, headerBackTitle: '' }} />
      <ScrollView className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
        <FocusAwareStatusBar />
        {callId ? <IncidentCommandTab callId={callId} /> : null}
      </ScrollView>
    </>
  );
}
