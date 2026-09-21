import { Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { RecordField } from '@/components/records/record-field';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { cellKey, evaluateRules, isFieldHidden, isFieldRequired, rowKeysFor, type ValidationIssue, type ValueMap } from '@/lib/records/schema';
import { type RecordDefinitionSchema, type RecordValueInput } from '@/models/v4/records';

// Section-card rendering of one definition version. Rules are evaluated on every change, per row
// inside repeating sections, so what the person sees matches what the server will accept.

interface RecordFormProps {
  schema: RecordDefinitionSchema;
  values: ValueMap;
  issues?: ValidationIssue[];
  readOnly?: boolean;
  forFinalize?: boolean;
  onChange: (values: ValueMap) => void;
}

const newRowKey = () => `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const RecordForm: React.FC<RecordFormProps> = ({ schema, values, issues, readOnly, forFinalize, onChange }) => {
  const { t } = useTranslation();
  const rules = useMemo(() => evaluateRules(schema, values), [schema, values]);
  const invalidKeys = useMemo(() => new Set((issues ?? []).map((issue) => cellKey(issue.sectionKey, issue.fieldKey, issue.rowKey))), [issues]);

  const setValue = useCallback(
    (sectionKey: string, fieldKey: string, rowKey: string | null, patch: Partial<RecordValueInput>) => {
      const key = cellKey(sectionKey, fieldKey, rowKey);
      const existing = values[key] ?? { SectionKey: sectionKey, FieldKey: fieldKey, RowKey: rowKey };
      onChange({ ...values, [key]: { ...existing, ...patch } });
    },
    [values, onChange]
  );

  const addRow = useCallback(
    (sectionKey: string, fieldKeys: string[]) => {
      const rowKey = newRowKey();
      const ordinal = rowKeysFor(values, sectionKey).length;
      const next: ValueMap = { ...values };
      for (const fieldKey of fieldKeys) {
        next[cellKey(sectionKey, fieldKey, rowKey)] = { SectionKey: sectionKey, FieldKey: fieldKey, RowKey: rowKey, Ordinal: ordinal };
      }
      onChange(next);
    },
    [values, onChange]
  );

  const removeRow = useCallback(
    (sectionKey: string, rowKey: string) => {
      const next: ValueMap = {};
      for (const [key, value] of Object.entries(values)) {
        if (value.SectionKey === sectionKey && value.RowKey === rowKey) {
          continue;
        }
        next[key] = value;
      }
      onChange(next);
    },
    [values, onChange]
  );

  return (
    <VStack space="md">
      {(schema.Sections ?? []).map((section) => {
        if (rules.hiddenSectionKeys.has(section.Key)) {
          return null;
        }
        const fieldKeys = (section.Fields ?? []).map((field) => field.Key);
        const rowKeys = section.Repeating ? rowKeysFor(values, section.Key) : [];
        const canAddRow = !readOnly && (!section.MaxRows || rowKeys.length < section.MaxRows);

        return (
          <Card key={section.Key} className="p-4">
            <VStack space="sm">
              <Heading size="sm">{section.Label}</Heading>
              {section.Help ? <Text className="text-xs text-typography-500">{section.Help}</Text> : null}

              {section.Repeating ? (
                <VStack space="md">
                  {rowKeys.length === 0 ? <Text className="text-sm text-typography-500">{t('records.no_rows')}</Text> : null}
                  {rowKeys.map((rowKey, index) => (
                    <Box key={rowKey} className="rounded-md border border-outline-200 p-3">
                      <HStack className="mb-2 items-center justify-between">
                        <Text className="text-xs font-medium text-typography-500">{`${section.Label} ${index + 1}`}</Text>
                        {!readOnly ? (
                          <Pressable onPress={() => removeRow(section.Key, rowKey)} testID={`records-remove-row-${section.Key}-${index}`}>
                            <Trash2 size={16} color="#dc2626" />
                          </Pressable>
                        ) : null}
                      </HStack>
                      {(section.Fields ?? []).map((field) =>
                        isFieldHidden(rules, section.Key, field.Key, rowKey) ? null : (
                          <RecordField
                            key={`${rowKey}-${field.Key}`}
                            field={field}
                            value={values[cellKey(section.Key, field.Key, rowKey)]}
                            required={isFieldRequired(rules, field, section.Key, rowKey, forFinalize)}
                            invalid={invalidKeys.has(cellKey(section.Key, field.Key, rowKey))}
                            disabled={readOnly}
                            onChange={(patch) => setValue(section.Key, field.Key, rowKey, patch)}
                            testID={`records-field-${section.Key}-${index}-${field.Key}`}
                          />
                        )
                      )}
                    </Box>
                  ))}
                  {canAddRow ? (
                    <Button variant="outline" size="sm" onPress={() => addRow(section.Key, fieldKeys)} testID={`records-add-row-${section.Key}`}>
                      <ButtonIcon as={Plus} />
                      <ButtonText>{t('records.add_row')}</ButtonText>
                    </Button>
                  ) : null}
                </VStack>
              ) : (
                <VStack>
                  <Divider className="mb-3" />
                  {(section.Fields ?? []).map((field) =>
                    isFieldHidden(rules, section.Key, field.Key, null) ? null : (
                      <RecordField
                        key={field.Key}
                        field={field}
                        value={values[cellKey(section.Key, field.Key, null)]}
                        required={isFieldRequired(rules, field, section.Key, null, forFinalize)}
                        invalid={invalidKeys.has(cellKey(section.Key, field.Key, null))}
                        disabled={readOnly}
                        onChange={(patch) => setValue(section.Key, field.Key, null, patch)}
                        testID={`records-field-${section.Key}-${field.Key}`}
                      />
                    )
                  )}
                </VStack>
              )}
            </VStack>
          </Card>
        );
      })}
    </VStack>
  );
};
