import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, type StyleProp, StyleSheet, TextInput, type TextStyle, View } from 'react-native';

import { getUdfDefinition, getUdfValues } from '@/api/userDefinedFields/userDefinedFields';
import { comboDisplayText, filterComboSuggestions, findComboOption, parseUdfOptions, selectedOptionKeys, UDF_FIELD_TYPE, type UdfOption } from '@/lib/udf/options';
import { type UdfFieldResultData } from '@/models/v4/userDefinedFields/udfFieldResultData';
import { type UdfFieldValueInput } from '@/models/v4/userDefinedFields/udfFieldValueInput';
import { type UdfFieldValueResultData } from '@/models/v4/userDefinedFields/udfFieldValueResultData';

import { Text } from '../ui/text';

const EMPTY_OPTIONS: UdfOption[] = [];

interface UdfFieldsRendererProps {
  entityType: number;
  entityId?: string;
  onValuesChange: (values: UdfFieldValueInput[]) => void;
  initialValues?: UdfFieldValueResultData[];
  isDark?: boolean;
  readOnly?: boolean;
}

export const UdfFieldsRenderer: React.FC<UdfFieldsRendererProps> = ({ entityType, entityId, onValuesChange, initialValues, isDark = false, readOnly = false }) => {
  const [fields, setFields] = useState<UdfFieldResultData[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasFields, setHasFields] = useState(false);

  const notifyChange = useCallback(
    (fieldList: UdfFieldResultData[], valueMap: Record<string, string>) => {
      const result: UdfFieldValueInput[] = fieldList.map((f) => ({
        UdfFieldId: f.UdfFieldId,
        Value: valueMap[f.UdfFieldId] ?? '',
      }));
      onValuesChange(result);
    },
    [onValuesChange]
  );

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setIsLoading(true);
        const defResult = await getUdfDefinition(entityType);
        if (!isMounted) return;

        const fieldList = defResult?.Data?.Fields ?? [];
        const enabledFields = fieldList.filter((f) => f.IsEnabled && f.IsVisibleOnMobile);
        setFields(enabledFields);
        setHasFields(enabledFields.length > 0);

        // Build initial values map
        const initialMap: Record<string, string> = {};
        enabledFields.forEach((f) => {
          initialMap[f.UdfFieldId] = f.DefaultValue ?? '';
        });

        // If we have an entityId, fetch existing values
        if (entityId && entityId.trim() !== '') {
          try {
            const valResult = await getUdfValues(entityType, entityId);
            (valResult?.Data ?? []).forEach((v) => {
              initialMap[v.UdfFieldId] = v.Value ?? '';
            });
          } catch {
            // Silently fall back to defaults/initialValues
          }
        }

        // Apply any externally provided initial values
        if (initialValues) {
          initialValues.forEach((v) => {
            initialMap[v.UdfFieldId] = v.Value ?? '';
          });
        }

        if (isMounted) {
          setValues(initialMap);
          notifyChange(enabledFields, initialMap);
        }
      } catch {
        if (isMounted) setHasFields(false);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId, initialValues, notifyChange]);

  const handleValueChange = useCallback(
    (fieldId: string, newValue: string) => {
      setValues((prev) => {
        const updated = { ...prev, [fieldId]: newValue };
        notifyChange(fields, updated);
        return updated;
      });
    },
    [fields, notifyChange]
  );

  // Parsed once per definition so option lists keep their identity across renders.
  const optionsByField = useMemo(() => {
    const map: Record<string, UdfOption[]> = {};
    fields.forEach((f) => {
      map[f.UdfFieldId] = parseUdfOptions(f.ValidationRules);
    });
    return map;
  }, [fields]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={isDark ? '#9ca3af' : '#6b7280'} />
      </View>
    );
  }

  if (!hasFields) return null;

  const renderField = (field: UdfFieldResultData) => {
    const val = values[field.UdfFieldId] ?? '';
    const label = field.Label || field.Name;
    const placeholder = field.Placeholder || label;
    const isFieldReadOnly = readOnly || field.IsReadOnly;

    const inputStyle = StyleSheet.flatten([styles.input, isDark ? styles.inputDark : styles.inputLight, isFieldReadOnly ? styles.inputReadOnly : {}]);
    const labelStyle = StyleSheet.flatten([styles.label, isDark ? styles.labelDark : styles.labelLight]);
    const descStyle = StyleSheet.flatten([styles.description, isDark ? styles.descriptionDark : styles.descriptionLight]);

    switch (field.FieldDataType) {
      case UDF_FIELD_TYPE.Boolean:
        return (
          <View key={field.UdfFieldId} style={styles.fieldRow}>
            <View style={styles.booleanRow}>
              <Text style={labelStyle}>
                {label}
                {field.IsRequired ? <Text style={styles.required}> *</Text> : null}
              </Text>
              <BooleanToggle value={val === 'true'} onChange={(v) => handleValueChange(field.UdfFieldId, v ? 'true' : 'false')} disabled={isFieldReadOnly} isDark={isDark} />
            </View>
            {field.Description ? <Text style={descStyle}>{field.Description}</Text> : null}
          </View>
        );

      case UDF_FIELD_TYPE.Dropdown:
      case UDF_FIELD_TYPE.MultiSelect: {
        const opts = optionsByField[field.UdfFieldId] ?? EMPTY_OPTIONS;
        return (
          <View key={field.UdfFieldId} style={styles.fieldRow}>
            <Text style={labelStyle}>
              {label}
              {field.IsRequired ? <Text style={styles.required}> *</Text> : null}
            </Text>
            {field.Description ? <Text style={descStyle}>{field.Description}</Text> : null}
            <OptionSelector
              options={opts}
              value={val}
              multiSelect={field.FieldDataType === UDF_FIELD_TYPE.MultiSelect}
              onChange={(v) => handleValueChange(field.UdfFieldId, v)}
              disabled={isFieldReadOnly}
              isDark={isDark}
              placeholder={placeholder}
            />
          </View>
        );
      }

      case UDF_FIELD_TYPE.ComboBox:
        return (
          <View key={field.UdfFieldId} style={styles.fieldRow}>
            <Text style={labelStyle}>
              {label}
              {field.IsRequired ? <Text style={styles.required}> *</Text> : null}
            </Text>
            {field.Description ? <Text style={descStyle}>{field.Description}</Text> : null}
            <ComboBoxInput
              fieldId={field.UdfFieldId}
              options={optionsByField[field.UdfFieldId] ?? EMPTY_OPTIONS}
              value={val}
              onChange={handleValueChange}
              disabled={isFieldReadOnly}
              isDark={isDark}
              label={label}
              placeholder={placeholder}
              inputStyle={inputStyle}
              captionStyle={descStyle}
            />
          </View>
        );

      case UDF_FIELD_TYPE.Number:
      case UDF_FIELD_TYPE.Decimal:
        return (
          <View key={field.UdfFieldId} style={styles.fieldRow}>
            <Text style={labelStyle}>
              {label}
              {field.IsRequired ? <Text style={styles.required}> *</Text> : null}
            </Text>
            {field.Description ? <Text style={descStyle}>{field.Description}</Text> : null}
            <TextInput
              style={inputStyle}
              value={val}
              onChangeText={(v) => handleValueChange(field.UdfFieldId, v)}
              placeholder={placeholder}
              placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
              keyboardType="numeric"
              editable={!isFieldReadOnly}
              accessibilityLabel={label}
            />
          </View>
        );

      case UDF_FIELD_TYPE.Email:
        return (
          <View key={field.UdfFieldId} style={styles.fieldRow}>
            <Text style={labelStyle}>
              {label}
              {field.IsRequired ? <Text style={styles.required}> *</Text> : null}
            </Text>
            {field.Description ? <Text style={descStyle}>{field.Description}</Text> : null}
            <TextInput
              style={inputStyle}
              value={val}
              onChangeText={(v) => handleValueChange(field.UdfFieldId, v)}
              placeholder={placeholder}
              placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isFieldReadOnly}
              accessibilityLabel={label}
            />
          </View>
        );

      case UDF_FIELD_TYPE.Phone:
        return (
          <View key={field.UdfFieldId} style={styles.fieldRow}>
            <Text style={labelStyle}>
              {label}
              {field.IsRequired ? <Text style={styles.required}> *</Text> : null}
            </Text>
            {field.Description ? <Text style={descStyle}>{field.Description}</Text> : null}
            <TextInput
              style={inputStyle}
              value={val}
              onChangeText={(v) => handleValueChange(field.UdfFieldId, v)}
              placeholder={placeholder}
              placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
              keyboardType="phone-pad"
              editable={!isFieldReadOnly}
              accessibilityLabel={label}
            />
          </View>
        );

      case UDF_FIELD_TYPE.Url:
        return (
          <View key={field.UdfFieldId} style={styles.fieldRow}>
            <Text style={labelStyle}>
              {label}
              {field.IsRequired ? <Text style={styles.required}> *</Text> : null}
            </Text>
            {field.Description ? <Text style={descStyle}>{field.Description}</Text> : null}
            <TextInput
              style={inputStyle}
              value={val}
              onChangeText={(v) => handleValueChange(field.UdfFieldId, v)}
              placeholder={placeholder}
              placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
              keyboardType="url"
              autoCapitalize="none"
              editable={!isFieldReadOnly}
              accessibilityLabel={label}
            />
          </View>
        );

      default:
        // Text, Date, DateTime — use plain text input
        return (
          <View key={field.UdfFieldId} style={styles.fieldRow}>
            <Text style={labelStyle}>
              {label}
              {field.IsRequired ? <Text style={styles.required}> *</Text> : null}
            </Text>
            {field.Description ? <Text style={descStyle}>{field.Description}</Text> : null}
            <TextInput
              style={inputStyle}
              value={val}
              onChangeText={(v) => handleValueChange(field.UdfFieldId, v)}
              placeholder={placeholder}
              placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
              editable={!isFieldReadOnly}
              accessibilityLabel={label}
            />
          </View>
        );
    }
  };

  // Group fields by GroupName
  const grouped = fields.reduce<Record<string, UdfFieldResultData[]>>((acc, f) => {
    const key = f.GroupName || '';
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      {Object.entries(grouped).map(([group, groupFields]) => (
        <View key={group || '__default__'}>
          {group ? <Text style={StyleSheet.flatten([styles.groupLabel, isDark ? styles.groupLabelDark : styles.groupLabelLight])}>{group}</Text> : null}
          {groupFields.sort((a, b) => a.SortOrder - b.SortOrder).map(renderField)}
        </View>
      ))}
    </View>
  );
};

// --- Sub-components ---

interface BooleanToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  isDark?: boolean;
}

const BooleanToggle: React.FC<BooleanToggleProps> = ({ value, onChange, disabled = false, isDark = false }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.toggleRow}>
      <Text
        style={StyleSheet.flatten([styles.toggleOption, value ? (isDark ? styles.toggleActiveDark : styles.toggleActiveLight) : isDark ? styles.toggleInactiveDark : styles.toggleInactiveLight])}
        onPress={() => !disabled && onChange(true)}
        accessibilityRole="button"
        accessibilityLabel={t('common.yes', 'Yes')}
      >
        {t('common.yes', 'Yes')}
      </Text>
      <Text
        style={StyleSheet.flatten([styles.toggleOption, !value ? (isDark ? styles.toggleActiveDark : styles.toggleActiveLight) : isDark ? styles.toggleInactiveDark : styles.toggleInactiveLight])}
        onPress={() => !disabled && onChange(false)}
        accessibilityRole="button"
        accessibilityLabel={t('common.no', 'No')}
      >
        {t('common.no', 'No')}
      </Text>
    </View>
  );
};

interface OptionSelectorProps {
  options: UdfOption[];
  value: string;
  multiSelect: boolean;
  onChange: (v: string) => void;
  disabled?: boolean;
  isDark?: boolean;
  placeholder?: string;
}

// Chips show each option's label and store its key, the way the server stores a dropdown/multi-select value.
const OptionSelector: React.FC<OptionSelectorProps> = ({ options, value, multiSelect, onChange, disabled = false, isDark = false }) => {
  const selectedKeys = selectedOptionKeys(multiSelect ? UDF_FIELD_TYPE.MultiSelect : UDF_FIELD_TYPE.Dropdown, value);

  const toggle = (key: string) => {
    if (disabled) return;
    if (multiSelect) {
      const next = selectedKeys.includes(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key];
      onChange(next.join(','));
    } else {
      onChange(selectedKeys.includes(key) ? '' : key);
    }
  };

  return (
    <View style={styles.optionContainer}>
      {options.map((opt) => {
        const isSelected = selectedKeys.includes(opt.key);
        return (
          <Text
            key={opt.key}
            style={StyleSheet.flatten([
              styles.optionItem,
              isDark ? styles.optionItemDark : styles.optionItemLight,
              isSelected ? (isDark ? styles.optionSelectedDark : styles.optionSelectedLight) : {},
              disabled ? styles.optionDisabled : {},
            ])}
            onPress={() => toggle(opt.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected, disabled }}
          >
            {opt.label}
          </Text>
        );
      })}
    </View>
  );
};

interface ComboBoxInputProps {
  fieldId: string;
  options: UdfOption[];
  value: string;
  onChange: (fieldId: string, value: string) => void;
  disabled?: boolean;
  isDark?: boolean;
  label: string;
  placeholder?: string;
  inputStyle: StyleProp<TextStyle>;
  captionStyle: StyleProp<TextStyle>;
}

// A text input with the field's options offered as suggestions. Picking a suggestion shows its label and stores its
// key; anything typed is sent as typed and the server stores a typed label as that option's key.
const ComboBoxInput: React.FC<ComboBoxInputProps> = ({ fieldId, options, value, onChange, disabled = false, isDark = false, label, placeholder, inputStyle, captionStyle }) => {
  const { t } = useTranslation();
  // Held locally so typing a string that happens to equal an option key does not flip the input to that label mid-word.
  const [text, setText] = useState(() => comboDisplayText(options, value));
  const suggestions = useMemo(() => filterComboSuggestions(options, text), [options, text]);
  const selectedKey = findComboOption(options, text)?.key;

  const handleChangeText = useCallback(
    (next: string) => {
      setText(next);
      onChange(fieldId, next);
    },
    [fieldId, onChange]
  );

  const handleSelect = useCallback(
    (option: UdfOption) => {
      if (disabled) return;
      setText(option.label);
      onChange(fieldId, option.key);
    },
    [disabled, fieldId, onChange]
  );

  return (
    <View>
      <TextInput
        style={inputStyle}
        value={text}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
        editable={!disabled}
        autoCorrect={false}
        accessibilityLabel={label}
        testID={`udf-combo-input-${fieldId}`}
      />
      {!disabled && suggestions.length > 0 ? (
        <View style={styles.suggestionsBlock} testID={`udf-combo-suggestions-${fieldId}`}>
          <Text style={captionStyle}>{t('calls.udf_suggestions')}</Text>
          <View style={styles.optionContainer}>
            {suggestions.map((option) => (
              <ComboSuggestion key={option.key} option={option} isSelected={option.key === selectedKey} onSelect={handleSelect} isDark={isDark} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
};

interface ComboSuggestionProps {
  option: UdfOption;
  isSelected: boolean;
  onSelect: (option: UdfOption) => void;
  isDark: boolean;
}

const ComboSuggestion: React.FC<ComboSuggestionProps> = React.memo(({ option, isSelected, onSelect, isDark }) => {
  const handlePress = useCallback(() => onSelect(option), [onSelect, option]);
  return (
    <Text
      style={StyleSheet.flatten([styles.optionItem, isDark ? styles.optionItemDark : styles.optionItemLight, isSelected ? (isDark ? styles.optionSelectedDark : styles.optionSelectedLight) : {}])}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      {option.label}
    </Text>
  );
});

ComboSuggestion.displayName = 'ComboSuggestion';

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  loadingContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupLabelDark: {
    color: '#9ca3af',
  },
  groupLabelLight: {
    color: '#6b7280',
  },
  fieldRow: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  labelDark: {
    color: '#d1d5db',
  },
  labelLight: {
    color: '#374151',
  },
  description: {
    fontSize: 12,
    marginBottom: 6,
  },
  descriptionDark: {
    color: '#6b7280',
  },
  descriptionLight: {
    color: '#9ca3af',
  },
  required: {
    color: '#ef4444',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputDark: {
    backgroundColor: '#262626',
    borderColor: '#404040',
    color: '#ffffff',
  },
  inputLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
    color: '#111827',
  },
  inputReadOnly: {
    opacity: 0.6,
  },
  booleanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleRow: {
    flexDirection: 'row',
  },
  toggleOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  toggleActiveDark: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
    color: '#ffffff',
    borderRadius: 6,
  },
  toggleActiveLight: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
    color: '#ffffff',
    borderRadius: 6,
  },
  toggleInactiveDark: {
    backgroundColor: '#262626',
    borderColor: '#404040',
    color: '#9ca3af',
    borderRadius: 6,
  },
  toggleInactiveLight: {
    backgroundColor: '#f9fafb',
    borderColor: '#d1d5db',
    color: '#6b7280',
    borderRadius: 6,
  },
  optionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  optionItem: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 8,
    fontSize: 14,
  },
  optionItemDark: {
    backgroundColor: '#262626',
    borderColor: '#404040',
    color: '#d1d5db',
  },
  optionItemLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
    color: '#374151',
  },
  optionSelectedDark: {
    backgroundColor: '#1d4ed8',
    borderColor: '#2563eb',
    color: '#ffffff',
  },
  optionSelectedLight: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
    color: '#1d4ed8',
  },
  optionDisabled: {
    opacity: 0.5,
  },
  suggestionsBlock: {
    marginTop: 8,
  },
});
