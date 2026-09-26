import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, CloudOff } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { RecordForm } from '@/components/records/record-form';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useRecordsContext } from '@/hooks/use-records-context';
import { canAuthorOffline, cellKey, toValueList, unsupportedFieldKeys, validate, type ValidationIssue, type ValueMap } from '@/lib/records/schema';
import { type FieldRecordCatalogEntry, type RecordDefinitionSchema } from '@/models/v4/records';
import { useRecordsStore } from '@/stores/records/store';

// Contextual create: pick a definition the server offered for this context, then author it. The
// catalog is the only source of what may be started here — nothing is inferred locally.

const clientId = () => `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export default function NewRecordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ draft?: string; definitionKey?: string }>();
  const context = useRecordsContext();

  const catalog = useRecordsStore((state) => state.catalog);
  const pendingDrafts = useRecordsStore((state) => state.pendingDrafts);
  const fetchCatalog = useRecordsStore((state) => state.fetchCatalog);
  const fetchSchema = useRecordsStore((state) => state.fetchSchema);
  const prefill = useRecordsStore((state) => state.prefill);
  const stageDraft = useRecordsStore((state) => state.stageDraft);
  const discardDraft = useRecordsStore((state) => state.discardDraft);
  const pushDraft = useRecordsStore((state) => state.pushDraft);
  const report = useRecordsStore((state) => state.report);

  const resumed = params.draft ? pendingDrafts[params.draft] : undefined;
  const [entry, setEntry] = useState<FieldRecordCatalogEntry | null>(null);
  const [schema, setSchema] = useState<RecordDefinitionSchema | null>(null);
  const [values, setValues] = useState<ValueMap>({});
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!catalog) {
      void fetchCatalog();
    }
  }, [catalog, fetchCatalog]);

  const choose = useCallback(
    async (chosen: FieldRecordCatalogEntry, existing?: ValueMap) => {
      setIsBusy(true);
      try {
        const loaded = await fetchSchema(chosen.DefinitionKey, chosen.Version);
        setEntry(chosen);
        setSchema(loaded);
        if (existing) {
          setValues(existing);
          return;
        }
        if (!chosen.SupportsPrefill) {
          setValues({});
          return;
        }
        report({ EventType: 'draft_started', Outcome: 'ok', DefinitionKey: chosen.DefinitionKey, DefinitionVersion: chosen.Version });
        const prefilled = await prefill(chosen.DefinitionKey, chosen.Version);
        const map: ValueMap = {};
        for (const value of prefilled?.Values ?? []) {
          if (!value.SectionKey) {
            continue;
          }
          map[cellKey(value.SectionKey, value.FieldKey, null)] = {
            SectionKey: value.SectionKey,
            FieldKey: value.FieldKey,
            RowKey: null,
            Value: value.Value ?? null,
            ReferenceType: value.ReferenceType ?? null,
            ReferenceId: value.ReferenceId ?? null,
          };
        }
        setValues(map);
      } finally {
        setIsBusy(false);
      }
    },
    [fetchSchema, prefill, report]
  );

  useEffect(() => {
    if (!resumed || entry) {
      return;
    }
    const match = (catalog?.Definitions ?? []).find((definition) => definition.DefinitionKey === resumed.definitionKey && definition.Version === resumed.definitionVersion);
    if (!match) {
      return;
    }
    const map: ValueMap = {};
    for (const value of resumed.values) {
      map[cellKey(value.SectionKey, value.FieldKey, value.RowKey ?? null)] = value;
    }
    void choose(match, map);
  }, [resumed, entry, catalog, choose]);

  const unsupported = useMemo(() => unsupportedFieldKeys(schema), [schema]);
  const offlineCapable = canAuthorOffline(entry);

  const save = useCallback(
    async (send: boolean) => {
      if (!entry || !schema) {
        return;
      }
      const found = validate(schema, values, false);
      setIssues(found);
      if (found.length > 0) {
        setMessage(t('records.fix_fields'));
        return;
      }

      const draftId = resumed?.clientRecordId ?? clientId();
      const draft = {
        clientRecordId: draftId,
        recordId: resumed?.recordId ?? null,
        definitionKey: entry.DefinitionKey,
        definitionVersion: entry.Version,
        name: entry.Name,
        values: toValueList(values),
        callId: context.CallId ?? null,
        stationGroupId: context.GroupId ?? null,
        rowVersion: resumed?.rowVersion ?? null,
        updatedOn: new Date().toISOString(),
      };

      if (!send) {
        // Explicit local save. A definition that seals values is never written to the device, so the
        // store refuses to stage it and the person is told to stay online for it.
        stageDraft(draft);
        setMessage(offlineCapable ? t('records.saved_locally') : t('records.online_only'));
        return;
      }

      setIsBusy(true);
      try {
        // Staged first so an interrupted send leaves the work on the device rather than losing it. A
        // definition that seals values is not staged, so the draft is handed to the send directly.
        stageDraft(draft);
        const result = await pushDraft(draftId, draft);
        if (result.ok && result.recordId) {
          discardDraft(draftId);
          router.replace(`/records/${result.recordId}`);
          return;
        }
        setMessage(result.conflict ? t(`records.conflict_${result.conflict.replace('-', '_')}`) : (result.error ?? t('records.save_failed')));
      } finally {
        setIsBusy(false);
      }
    },
    [entry, schema, values, resumed, context, stageDraft, offlineCapable, pushDraft, discardDraft, router, t]
  );

  if (!entry) {
    const definitions = catalog?.Definitions ?? [];
    return (
      <Box className="flex-1 bg-background-0">
        <Stack.Screen options={{ title: t('records.new_record') }} />
        <ScrollView>
          {definitions.length === 0 ? (
            <Text className="p-4 text-sm text-typography-500">{t('records.nothing_to_create')}</Text>
          ) : (
            definitions.map((definition) => (
              <React.Fragment key={`${definition.DefinitionKey}:${definition.Version}`}>
                <Pressable className="px-4 py-4" onPress={() => void choose(definition)} testID={`records-choose-${definition.DefinitionKey}`}>
                  <HStack className="items-center" space="md">
                    <VStack className="flex-1">
                      <Text className="font-medium text-typography-900">{definition.Name}</Text>
                      <HStack space="xs" className="mt-1 flex-wrap items-center">
                        {definition.Category ? <Text className="text-xs text-typography-500">{definition.Category}</Text> : null}
                        {definition.RequiresProtectedGrant ? (
                          <Badge action="warning" size="sm">
                            <BadgeText>{t('records.online_only_badge')}</BadgeText>
                          </Badge>
                        ) : null}
                        {definition.AllowOffline ? (
                          <Badge action="muted" size="sm">
                            <BadgeText>{t('records.offline_capable')}</BadgeText>
                          </Badge>
                        ) : null}
                      </HStack>
                    </VStack>
                    <ChevronRight size={18} color="#94a3b8" />
                  </HStack>
                </Pressable>
                <Divider />
              </React.Fragment>
            ))
          )}
        </ScrollView>
      </Box>
    );
  }

  return (
    <Box className="flex-1 bg-background-0">
      <Stack.Screen options={{ title: entry.Name }} />
      <ScrollView contentContainerClassName="p-4">
        {unsupported.length > 0 ? (
          <Box className="mb-4 rounded-md border border-warning-300 bg-background-warning p-3">
            <Heading size="xs">{t('records.update_required')}</Heading>
            <Text className="mt-1 text-sm text-typography-700">{t('records.unsupported_definition')}</Text>
          </Box>
        ) : null}

        {!offlineCapable ? (
          <HStack className="mb-4 items-center" space="xs">
            <CloudOff size={14} color="#64748b" />
            <Text className="text-xs text-typography-500">{t('records.online_only')}</Text>
          </HStack>
        ) : null}

        {message ? <Text className="mb-3 text-sm text-typography-700">{message}</Text> : null}

        {schema ? <RecordForm schema={schema} values={values} issues={issues} onChange={setValues} readOnly={unsupported.length > 0} /> : <Spinner />}

        <VStack space="sm" className="mt-4">
          <Button isDisabled={isBusy || unsupported.length > 0} onPress={() => void save(true)} testID="records-save-send">
            <ButtonText>{t('records.save_and_send')}</ButtonText>
          </Button>
          <Button variant="outline" isDisabled={isBusy || unsupported.length > 0 || !offlineCapable} onPress={() => void save(false)} testID="records-save-local">
            <ButtonText>{t('records.save_locally')}</ButtonText>
          </Button>
          <Button variant="link" onPress={() => router.back()}>
            <ButtonText>{t('records.cancel')}</ButtonText>
          </Button>
        </VStack>
        <Box className="h-16" />
      </ScrollView>
    </Box>
  );
}
