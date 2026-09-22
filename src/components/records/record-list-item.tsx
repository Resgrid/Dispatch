import { AlertTriangle, CloudOff, FileText } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type FieldRecordAssignmentData, type RecordSummaryData, RmsRecordState } from '@/models/v4/records';
import { type PendingRecordDraft } from '@/stores/records/store';

const stateAction = (state: number): 'muted' | 'info' | 'warning' | 'success' | 'error' => {
  switch (state) {
    case RmsRecordState.Draft:
      return 'muted';
    case RmsRecordState.ReadyForReview:
      return 'info';
    case RmsRecordState.Returned:
      return 'warning';
    case RmsRecordState.Finalized:
    case RmsRecordState.Amended:
      return 'success';
    default:
      return 'error';
  }
};

export const RecordListItem: React.FC<{ record: RecordSummaryData; onPress: () => void; testID?: string }> = ({ record, onPress, testID }) => {
  const { t } = useTranslation();
  const title = record.RecordNumber || record.DraftReference || record.DefinitionKey || t('records.untitled');

  return (
    <Pressable onPress={onPress} className="px-4 py-3" testID={testID}>
      <HStack className="items-center" space="md">
        <Box className="size-10 items-center justify-center rounded-full bg-primary-100">
          <FileText size={18} color="#2563eb" />
        </Box>
        <VStack className="flex-1">
          <Text className="font-medium text-typography-900" numberOfLines={1}>
            {title}
          </Text>
          <Text className="text-xs text-typography-500" numberOfLines={1}>
            {record.DisplaySummary || record.DefinitionKey || ''}
          </Text>
        </VStack>
        <Badge action={stateAction(record.State)} size="sm">
          <BadgeText>{record.StateName ?? RmsRecordState[record.State] ?? ''}</BadgeText>
        </Badge>
      </HStack>
    </Pressable>
  );
};

export const PendingDraftItem: React.FC<{ draft: PendingRecordDraft; onPress: () => void; testID?: string }> = ({ draft, onPress, testID }) => {
  const { t } = useTranslation();

  return (
    <Pressable onPress={onPress} className="px-4 py-3" testID={testID}>
      <HStack className="items-center" space="md">
        <Box className="size-10 items-center justify-center rounded-full bg-background-100">{draft.conflict ? <AlertTriangle size={18} color="#d97706" /> : <CloudOff size={18} color="#64748b" />}</Box>
        <VStack className="flex-1">
          <Text className="font-medium text-typography-900" numberOfLines={1}>
            {draft.name}
          </Text>
          <Text className="text-xs text-typography-500" numberOfLines={1}>
            {draft.conflict ? t(`records.conflict_${draft.conflict.replace('-', '_')}`) : t('records.not_sent_yet')}
          </Text>
        </VStack>
        <Badge action={draft.conflict ? 'warning' : 'muted'} size="sm">
          <BadgeText>{draft.conflict ? t('records.needs_attention') : t('records.pending')}</BadgeText>
        </Badge>
      </HStack>
    </Pressable>
  );
};

export const AssignmentItem: React.FC<{ assignment: FieldRecordAssignmentData; onPress: () => void; testID?: string }> = ({ assignment, onPress, testID }) => {
  const { t } = useTranslation();

  return (
    <Pressable onPress={onPress} className="px-4 py-3" testID={testID}>
      <HStack className="items-center" space="md">
        <VStack className="flex-1">
          <Text className="font-medium text-typography-900" numberOfLines={1}>
            {t(`records.purpose_${assignment.Purpose}`, { defaultValue: assignment.Purpose })}
          </Text>
          {assignment.Note ? (
            <Text className="text-xs text-typography-500" numberOfLines={2}>
              {assignment.Note}
            </Text>
          ) : null}
        </VStack>
        <Badge action={assignment.State === 'Acknowledged' ? 'info' : 'warning'} size="sm">
          <BadgeText>{assignment.State}</BadgeText>
        </Badge>
      </HStack>
    </Pressable>
  );
};
