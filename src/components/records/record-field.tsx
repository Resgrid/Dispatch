import { Lock } from 'lucide-react-native';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Checkbox, CheckboxIcon, CheckboxIndicator, CheckboxLabel } from '@/components/ui/checkbox';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Input, InputField } from '@/components/ui/input';
import { Select, SelectBackdrop, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { isRestricted, isSupportedField } from '@/lib/records/schema';
import { type RecordFieldSchema, type RecordValueInput, RmsFieldType } from '@/models/v4/records';

// One control from the definition schema. A field type this build cannot draw renders read-only with
// a plain explanation instead of guessing at an editor — the Web app remains the escape path.

interface RecordFieldProps {
  field: RecordFieldSchema;
  value: RecordValueInput | undefined;
  required: boolean;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (next: Partial<RecordValueInput>) => void;
  testID?: string;
}

const keyboardFor = (type: RmsFieldType): 'default' | 'numeric' | 'decimal-pad' => {
  if (type === RmsFieldType.Integer) {
    return 'numeric';
  }
  if (type === RmsFieldType.Decimal || type === RmsFieldType.Currency || type === RmsFieldType.Quantity) {
    return 'decimal-pad';
  }
  return 'default';
};

export const RecordField: React.FC<RecordFieldProps> = ({ field, value, required, disabled, invalid, onChange, testID }) => {
  const { t } = useTranslation();
  const text = value?.Value ?? '';
  const selected = value?.Values ?? [];

  const setText = useCallback((next: string) => onChange({ Value: next }), [onChange]);

  const label = (
    <HStack className="items-center" space="xs">
      <Text className="text-sm font-medium text-typography-700">{field.Label}</Text>
      {required ? <Text className="text-sm text-error-600">*</Text> : null}
      {isRestricted(field) ? (
        <Badge action="warning" size="sm">
          <Icon as={Lock} size="xs" className="mr-1 text-warning-700" />
          <BadgeText>{t('records.restricted')}</BadgeText>
        </Badge>
      ) : null}
    </HStack>
  );

  const wrap = (control: React.ReactNode) => (
    <VStack space="xs" className="mb-4" testID={testID}>
      {label}
      {control}
      {field.Help ? <Text className="text-xs text-typography-500">{field.Help}</Text> : null}
      {invalid ? <Text className="text-xs text-error-600">{t('records.field_required')}</Text> : null}
    </VStack>
  );

  if (!isSupportedField(field)) {
    // Fail closed: this build cannot represent the field, so it never pretends to author it.
    return wrap(
      <Box className="rounded-md border border-outline-200 bg-background-50 p-3">
        <Text className="text-sm text-typography-600">{t('records.unsupported_field')}</Text>
      </Box>
    );
  }

  switch (field.Type) {
    case RmsFieldType.LongText:
      return wrap(
        <Textarea isDisabled={disabled} isInvalid={invalid}>
          <TextareaInput value={text} onChangeText={setText} maxLength={field.MaxLength ?? undefined} placeholder={field.Label} />
        </Textarea>
      );

    case RmsFieldType.Boolean:
      return wrap(
        <Checkbox value={field.Key} isChecked={text === 'true'} isDisabled={disabled} onChange={(checked) => onChange({ Value: checked ? 'true' : 'false' })}>
          <CheckboxIndicator>
            <CheckboxIcon />
          </CheckboxIndicator>
          <CheckboxLabel>{field.Label}</CheckboxLabel>
        </Checkbox>
      );

    case RmsFieldType.SingleSelect:
      return wrap(
        <Select selectedValue={text} isDisabled={disabled} onValueChange={setText}>
          <SelectTrigger variant="outline" size="md">
            <SelectInput placeholder={t('records.choose')} value={field.Options?.find((option) => option.Key === text)?.Label ?? ''} />
            <SelectIcon className="mr-3" />
          </SelectTrigger>
          <SelectPortal>
            <SelectBackdrop />
            <SelectContent>
              <SelectDragIndicatorWrapper>
                <SelectDragIndicator />
              </SelectDragIndicatorWrapper>
              {(field.Options ?? [])
                .filter((option) => !option.IsInactive)
                .map((option) => (
                  <SelectItem key={option.Key} label={option.Label} value={option.Key} />
                ))}
            </SelectContent>
          </SelectPortal>
        </Select>
      );

    case RmsFieldType.MultiSelect:
      return wrap(
        <VStack space="xs">
          {(field.Options ?? [])
            .filter((option) => !option.IsInactive)
            .map((option) => {
              const checked = selected.includes(option.Key);
              return (
                <Checkbox
                  key={option.Key}
                  value={option.Key}
                  isChecked={checked}
                  isDisabled={disabled}
                  onChange={(next) => onChange({ Values: next ? [...selected, option.Key] : selected.filter((entry) => entry !== option.Key) })}
                >
                  <CheckboxIndicator>
                    <CheckboxIcon />
                  </CheckboxIndicator>
                  <CheckboxLabel>{option.Label}</CheckboxLabel>
                </Checkbox>
              );
            })}
        </VStack>
      );

    case RmsFieldType.Attachment:
      // Attachments upload through the resumable session on the record screen, not inline here.
      return wrap(
        <Box className="rounded-md border border-outline-200 bg-background-50 p-3">
          <Text className="text-sm text-typography-600">{t('records.attachments_hint')}</Text>
        </Box>
      );

    case RmsFieldType.Signature:
      return wrap(
        <Checkbox value={field.Key} isChecked={text.length > 0} isDisabled={disabled} onChange={(checked) => onChange({ Value: checked ? new Date().toISOString() : '' })}>
          <CheckboxIndicator>
            <CheckboxIcon />
          </CheckboxIndicator>
          <CheckboxLabel>{t('records.sign_statement')}</CheckboxLabel>
        </Checkbox>
      );

    case RmsFieldType.Quantity:
      return wrap(
        <HStack space="sm">
          <Input className="flex-1" isDisabled={disabled} isInvalid={invalid}>
            <InputField value={text} onChangeText={setText} keyboardType="decimal-pad" placeholder={field.Label} />
          </Input>
          <Input className="w-24" isDisabled={disabled}>
            <InputField value={value?.UnitCode ?? field.DefaultUnitCode ?? ''} onChangeText={(next) => onChange({ UnitCode: next })} placeholder={t('records.unit_code')} />
          </Input>
        </HStack>
      );

    default:
      return wrap(
        <Input isDisabled={disabled} isInvalid={invalid}>
          <InputField
            value={text}
            onChangeText={setText}
            keyboardType={keyboardFor(field.Type)}
            maxLength={field.MaxLength ?? undefined}
            placeholder={field.Type === RmsFieldType.Currency ? (field.DefaultCurrency ?? field.Label) : field.Label}
          />
        </Input>
      );
  }
};
