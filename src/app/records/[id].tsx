import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { getRecord } from '@/api/records/records';
import { RecordAttachments } from '@/components/records/record-attachments';
import { RecordForm } from '@/components/records/record-form';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Checkbox, CheckboxIcon, CheckboxIndicator, CheckboxLabel } from '@/components/ui/checkbox';
import { Heading } from '@/components/ui/heading';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { logger } from '@/lib/logging';
import { toValueList, toValueMap, unsupportedFieldKeys, validate, type ValidationIssue, type ValueMap } from '@/lib/records/schema';
import { type RecordData, type RecordDefinitionSchema, RmsRecordState } from '@/models/v4/records';
import { useRecordsStore } from '@/stores/records/store';

// One Record: edit while it is a draft or returned, then submit or finalize online. Amendment, void
// and approval stay Web-first (RMS plan RMS-1D), so they are not offered here.

export default function RecordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const fetchSchema = useRecordsStore((state) => state.fetchSchema);
  const stageDraft = useRecordsStore((state) => state.stageDraft);
  const pushDraft = useRecordsStore((state) => state.pushDraft);
  const discardDraft = useRecordsStore((state) => state.discardDraft);
  const submitForReview = useRecordsStore((state) => state.submitForReview);
  const finalize = useRecordsStore((state) => state.finalize);
  const entryFor = useRecordsStore((state) => state.entryFor);

  const [record, setRecord] = useState<RecordData | null>(null);
  const [schema, setSchema] = useState<RecordDefinitionSchema | null>(null);
  const [values, setValues] = useState<ValueMap>({});
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [attested, setAttested] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Edits made since the record was last loaded; they exist only here until they are saved.
  const [dirty, setDirty] = useState(false);

  /** Loads the record as the server holds it now, replacing any local edits. */
  const fetchRecord = useCallback(async (): Promise<RecordData | null> => {
    if (!id) {
      return null;
    }
    try {
      const response = await getRecord(id);
      const loaded = response?.Data ?? null;
      setRecord(loaded);
      setValues(toValueMap(loaded?.Values?.Cells));
      setDirty(false);
      if (loaded?.DefinitionKey) {
        setSchema(await fetchSchema(loaded.DefinitionKey, loaded.DefinitionVersion));
      }
      return loaded;
    } catch (error) {
      logger.error({ message: 'Record load failed', context: { error, id } });
      setMessage(t('records.load_failed'));
      return null;
    }
  }, [id, fetchSchema, t]);

  const load = useCallback(async () => {
    setIsBusy(true);
    try {
      await fetchRecord();
    } finally {
      setIsBusy(false);
    }
  }, [fetchRecord]);

  useEffect(() => {
    void load();
  }, [load]);

  const unsupported = useMemo(() => unsupportedFieldKeys(schema), [schema]);
  const editable = record ? record.State === RmsRecordState.Draft || record.State === RmsRecordState.Returned : false;
  const entry = record?.DefinitionKey ? entryFor(record.DefinitionKey, record.DefinitionVersion) : null;

  const handleChange = useCallback((next: ValueMap) => {
    setValues(next);
    setDirty(true);
  }, []);

  /** Sends the edited values and returns the record as the server now holds it, or null when it was not saved. */
  const persist = useCallback(
    async (current: RecordData): Promise<RecordData | null> => {
      const clientRecordId = `edit-${current.RecordId}-${current.RowVersion}`;
      const draft = {
        clientRecordId,
        recordId: current.RecordId,
        definitionKey: current.DefinitionKey ?? '',
        definitionVersion: current.DefinitionVersion,
        name: current.RecordNumber ?? current.DraftReference ?? entry?.Name ?? t('records.untitled'),
        values: toValueList(values),
        rowVersion: current.RowVersion,
        updatedOn: new Date().toISOString(),
      };
      stageDraft(draft);
      // Passed directly as well: a definition that seals values is never staged on the device.
      const result = await pushDraft(clientRecordId, draft);
      if (!result.ok) {
        // A conflict is shown, never resolved by overwriting: the person reloads and decides.
        setMessage(result.conflict ? t(`records.conflict_${result.conflict.replace('-', '_')}`) : (result.error ?? t('records.save_failed')));
        return null;
      }
      discardDraft(clientRecordId);
      return fetchRecord();
    },
    [values, entry, stageDraft, pushDraft, discardDraft, fetchRecord, t]
  );

  const save = useCallback(async () => {
    if (!record || !schema) {
      return;
    }
    const found = validate(schema, values, false);
    setIssues(found);
    if (found.length > 0) {
      setMessage(t('records.fix_fields'));
      return;
    }
    setIsBusy(true);
    try {
      if (await persist(record)) {
        setMessage(t('records.saved'));
      }
    } finally {
      setIsBusy(false);
    }
  }, [record, schema, values, persist, t]);

  const submit = useCallback(async () => {
    if (!record) {
      return;
    }
    if (dirty && schema) {
      const found = validate(schema, values, false);
      setIssues(found);
      if (found.length > 0) {
        setMessage(t('records.fix_fields'));
        return;
      }
    }
    setIsBusy(true);
    try {
      // Unsaved edits go first; otherwise the server's older copy is what would be put up for review.
      const current = dirty ? await persist(record) : record;
      if (!current) {
        return;
      }
      const result = await submitForReview(current.RecordId, current.RowVersion);
      setMessage(result.ok ? t('records.submitted') : (result.error ?? t('records.save_failed')));
      if (result.ok) {
        await fetchRecord();
      }
    } finally {
      setIsBusy(false);
    }
  }, [record, schema, values, dirty, persist, submitForReview, fetchRecord, t]);

  const complete = useCallback(async () => {
    if (!record || !schema) {
      return;
    }
    const found = validate(schema, values, true);
    setIssues(found);
    if (found.length > 0) {
      setMessage(t('records.fix_fields'));
      return;
    }
    setIsBusy(true);
    try {
      // The values just validated are the ones finalized, so unsaved edits are sent first.
      const current = dirty ? await persist(record) : record;
      if (!current) {
        return;
      }
      const result = await finalize(current.RecordId, current.RowVersion, attested);
      setMessage(result.ok ? t('records.finalized') : (result.error ?? t('records.save_failed')));
      if (result.ok) {
        await fetchRecord();
      }
    } finally {
      setIsBusy(false);
    }
  }, [record, schema, values, dirty, attested, persist, finalize, fetchRecord, t]);

  if (!record) {
    return (
      <Box className="flex-1 items-center justify-center bg-background-0">
        <Stack.Screen options={{ title: t('records.title') }} />
        {isBusy ? <Spinner /> : <Text className="text-typography-500">{message ?? t('records.not_found')}</Text>}
      </Box>
    );
  }

  return (
    <Box className="flex-1 bg-background-0">
      <Stack.Screen options={{ title: record.RecordNumber ?? record.DraftReference ?? t('records.title') }} />
      <ScrollView contentContainerClassName="p-4">
        <VStack space="sm" className="mb-4">
          <Heading size="sm">{entry?.Name ?? record.DefinitionKey ?? t('records.title')}</Heading>
          <Badge action="muted" size="sm" className="self-start">
            <BadgeText>{record.StateName ?? RmsRecordState[record.State] ?? ''}</BadgeText>
          </Badge>
        </VStack>

        {unsupported.length > 0 ? (
          <Box className="mb-4 rounded-md border border-warning-300 bg-background-warning p-3">
            <Heading size="xs">{t('records.update_required')}</Heading>
            <Text className="mt-1 text-sm text-typography-700">{t('records.unsupported_definition')}</Text>
          </Box>
        ) : null}

        {message ? <Text className="mb-3 text-sm text-typography-700">{message}</Text> : null}

        {schema ? <RecordForm schema={schema} values={values} issues={issues} readOnly={!editable || unsupported.length > 0} forFinalize={false} onChange={handleChange} /> : <Spinner />}

        {/* Attachments upload against a server-owned session, so an interruption resumes. */}
        <RecordAttachments recordId={record.RecordId} allowAttachments={entry?.AllowAttachments !== false} readOnly={!editable} />

        {editable && unsupported.length === 0 ? (
          <VStack space="sm" className="mt-4">
            <Button isDisabled={isBusy} onPress={() => void save()} testID="record-save">
              <ButtonText>{t('records.save')}</ButtonText>
            </Button>
            <Button variant="outline" isDisabled={isBusy} onPress={() => void submit()} testID="record-submit">
              <ButtonText>{t('records.submit_for_review')}</ButtonText>
            </Button>
            <Checkbox value="attested" isChecked={attested} onChange={setAttested} testID="record-attest">
              <CheckboxIndicator>
                <CheckboxIcon />
              </CheckboxIndicator>
              <CheckboxLabel>{t('records.attestation')}</CheckboxLabel>
            </Checkbox>
            <Button variant="outline" isDisabled={isBusy || !attested} onPress={() => void complete()} testID="record-finalize">
              <ButtonText>{t('records.finalize')}</ButtonText>
            </Button>
          </VStack>
        ) : null}

        <Button variant="link" className="mt-2" onPress={() => router.back()}>
          <ButtonText>{t('records.back')}</ButtonText>
        </Button>
        <Box className="h-16" />
      </ScrollView>
    </Box>
  );
}
