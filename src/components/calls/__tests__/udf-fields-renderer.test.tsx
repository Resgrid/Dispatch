import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { getUdfDefinition, getUdfValues } from '@/api/userDefinedFields/userDefinedFields';
import { type UdfFieldResultData } from '@/models/v4/userDefinedFields/udfFieldResultData';
import { type UdfFieldValueInput } from '@/models/v4/userDefinedFields/udfFieldValueInput';

import { UdfFieldsRenderer } from '../udf-fields-renderer';

jest.mock('@/api/userDefinedFields/userDefinedFields', () => ({
  getUdfDefinition: jest.fn(),
  getUdfValues: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

// The platform picker (gluestack Select on native, <select> on web) stands in as one pressable row per choice.
jest.mock('../udf-select', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    UdfSelect: ({ options, value, onChange, placeholder, testID }: { options: { key: string; label: string }[]; value: string; onChange: (v: string) => void; placeholder: string; testID: string }) => (
      <View testID={testID} accessibilityValue={{ text: value }}>
        <Pressable testID={`${testID}-none`} onPress={() => onChange('')}>
          <Text>{placeholder}</Text>
        </Pressable>
        {options.map((o) => (
          <Pressable key={o.key} testID={`${testID}-${o.key}`} onPress={() => onChange(o.key)}>
            <Text>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});

const mockGetUdfDefinition = getUdfDefinition as jest.MockedFunction<typeof getUdfDefinition>;
const mockGetUdfValues = getUdfValues as jest.MockedFunction<typeof getUdfValues>;

const rules = (options: { Key: string; Label: string }[]) => JSON.stringify({ MinLength: null, Options: options });

const makeField = (overrides: Partial<UdfFieldResultData>): UdfFieldResultData => ({
  UdfFieldId: 'f1',
  UdfDefinitionId: 'def-1',
  Name: 'field',
  Label: 'Field',
  Description: '',
  Placeholder: '',
  FieldDataType: 0,
  IsRequired: false,
  IsReadOnly: false,
  DefaultValue: '',
  ValidationRules: '',
  SortOrder: 0,
  GroupName: '',
  IsVisibleOnMobile: true,
  IsVisibleOnReports: true,
  IsEnabled: true,
  Visibility: 0,
  ...overrides,
});

const outcome = makeField({
  UdfFieldId: 'outcome',
  Name: 'outcome',
  Label: 'Outcome',
  FieldDataType: 11,
  ValidationRules: rules([
    { Key: 'tx', Label: 'Transported' },
    { Key: 'refused', Label: 'Refused care' },
  ]),
});

const disposition = makeField({
  UdfFieldId: 'disposition',
  Name: 'disposition',
  Label: 'Disposition',
  FieldDataType: 6,
  SortOrder: 1,
  ValidationRules: rules([
    { Key: 'p1', Label: 'Priority 1' },
    { Key: 'p2', Label: 'Priority 2' },
  ]),
});

const setDefinition = (fields: UdfFieldResultData[]) => {
  mockGetUdfDefinition.mockResolvedValue({ Data: { UdfDefinitionId: 'def-1', DepartmentId: 1, EntityType: 0, Version: 1, IsActive: true, Fields: fields } } as unknown as Awaited<ReturnType<typeof getUdfDefinition>>);
};

const setValues = (values: { UdfFieldId: string; Value: string }[]) => {
  mockGetUdfValues.mockResolvedValue({ Data: values } as unknown as Awaited<ReturnType<typeof getUdfValues>>);
};

const lastSubmitted = (onValuesChange: jest.Mock): Record<string, string> => {
  const calls = onValuesChange.mock.calls;
  const values = calls[calls.length - 1][0] as UdfFieldValueInput[];
  return Object.fromEntries(values.map((v) => [v.UdfFieldId, v.Value]));
};

describe('UdfFieldsRenderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setValues([]);
  });

  it('renders a dropdown as a picker of option labels that stores the key', async () => {
    setDefinition([disposition]);
    const onValuesChange = jest.fn();
    const { unmount } = render(<UdfFieldsRenderer entityType={0} onValuesChange={onValuesChange} />);

    await waitFor(() => expect(screen.getByTestId('udf-select-disposition')).toBeTruthy());
    expect(screen.getByText('Priority 2')).toBeTruthy();
    expect(screen.queryByText(/MinLength/)).toBeNull();

    fireEvent.press(screen.getByTestId('udf-select-disposition-p2'));
    expect(lastSubmitted(onValuesChange).disposition).toBe('p2');
    expect(screen.getByTestId('udf-select-disposition').props.accessibilityValue).toEqual({ text: 'p2' });

    fireEvent.press(screen.getByTestId('udf-select-disposition-none'));
    expect(lastSubmitted(onValuesChange).disposition).toBe('');
    unmount();
  });

  it('toggles multi-select options and stores the picked keys comma-joined', async () => {
    setDefinition([makeField({ UdfFieldId: 'concerns', Label: 'Concerns', FieldDataType: 7, ValidationRules: rules([{ Key: 'weapons', Label: 'Weapons' }, { Key: 'substance', Label: 'Substance use' }]) })]);
    const onValuesChange = jest.fn();
    const { unmount } = render(<UdfFieldsRenderer entityType={0} onValuesChange={onValuesChange} />);

    await waitFor(() => expect(screen.getByTestId('udf-option-concerns-weapons')).toBeTruthy());
    fireEvent.press(screen.getByTestId('udf-option-concerns-weapons'));
    fireEvent.press(screen.getByTestId('udf-option-concerns-substance'));
    expect(lastSubmitted(onValuesChange).concerns).toBe('weapons,substance');
    expect(screen.getByTestId('udf-option-concerns-weapons').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));

    fireEvent.press(screen.getByTestId('udf-option-concerns-weapons'));
    expect(lastSubmitted(onValuesChange).concerns).toBe('substance');
    unmount();
  });

  it('shows a yes/no question unanswered until one is picked', async () => {
    setDefinition([makeField({ UdfFieldId: 'coresponse', Label: 'Co-response requested', FieldDataType: 3, IsRequired: true })]);
    const onValuesChange = jest.fn();
    const { unmount } = render(<UdfFieldsRenderer entityType={0} onValuesChange={onValuesChange} />);

    await waitFor(() => expect(screen.getByTestId('udf-boolean-coresponse-yes')).toBeTruthy());
    expect(screen.getByTestId('udf-boolean-coresponse-yes').props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));
    expect(screen.getByTestId('udf-boolean-coresponse-no').props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));
    expect(lastSubmitted(onValuesChange).coresponse).toBe('');

    fireEvent.press(screen.getByTestId('udf-boolean-coresponse-no'));
    expect(lastSubmitted(onValuesChange).coresponse).toBe('false');
    fireEvent.press(screen.getByTestId('udf-boolean-coresponse-yes'));
    expect(lastSubmitted(onValuesChange).coresponse).toBe('true');
    unmount();
  });

  it('reports the fields it shows, a required one hidden from the apps included', async () => {
    const requiredHidden = makeField({ UdfFieldId: 'mrn', Label: 'Client MRN', IsRequired: true, IsVisibleOnMobile: false });
    const optionalHidden = makeField({ UdfFieldId: 'notes', Label: 'Office notes', IsVisibleOnMobile: false });
    const disabled = makeField({ UdfFieldId: 'old', Label: 'Retired', IsRequired: true, IsEnabled: false });
    setDefinition([disposition, requiredHidden, optionalHidden, disabled]);
    const onFieldsLoaded = jest.fn();
    const { unmount } = render(<UdfFieldsRenderer entityType={0} onValuesChange={jest.fn()} onFieldsLoaded={onFieldsLoaded} />);

    await waitFor(() => expect(onFieldsLoaded).toHaveBeenCalledTimes(1));
    expect((onFieldsLoaded.mock.calls[0][0] as UdfFieldResultData[]).map((f) => f.UdfFieldId)).toEqual(['disposition', 'mrn']);
    expect(screen.getByText(/Client MRN/)).toBeTruthy();
    expect(screen.queryByText(/Office notes/)).toBeNull();
    unmount();
  });

  it('shows and sends nothing when the stored values cannot be read, so a save cannot overwrite them', async () => {
    setDefinition([disposition]);
    mockGetUdfValues.mockRejectedValue(new Error('offline'));
    const onValuesChange = jest.fn();
    const onFieldsLoaded = jest.fn();
    const { toJSON, unmount } = render(<UdfFieldsRenderer entityType={0} entityId="call-1" onValuesChange={onValuesChange} onFieldsLoaded={onFieldsLoaded} />);

    await waitFor(() => expect(mockGetUdfValues).toHaveBeenCalled());
    await waitFor(() => expect(toJSON()).toBeNull());
    expect(onValuesChange).not.toHaveBeenCalled();
    expect(onFieldsLoaded).not.toHaveBeenCalled();
    unmount();
  });

  it('does not report fields when the definition fails to load', async () => {
    mockGetUdfDefinition.mockRejectedValue(new Error('offline'));
    const onFieldsLoaded = jest.fn();
    const { toJSON, unmount } = render(<UdfFieldsRenderer entityType={0} onValuesChange={jest.fn()} onFieldsLoaded={onFieldsLoaded} />);

    await waitFor(() => expect(toJSON()).toBeNull());
    expect(onFieldsLoaded).not.toHaveBeenCalled();
    unmount();
  });

  it('renders a combo box as a text input with suggestions', async () => {
    setDefinition([outcome]);
    const { unmount } = render(<UdfFieldsRenderer entityType={0} onValuesChange={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('udf-combo-input-outcome')).toBeTruthy());
    expect(screen.getByText('calls.udf_suggestions')).toBeTruthy();
    expect(screen.getByText('Transported')).toBeTruthy();
    expect(screen.getByText('Refused care')).toBeTruthy();
    unmount();
  });

  it('stores a picked suggestion as its key and shows its label', async () => {
    setDefinition([outcome]);
    const onValuesChange = jest.fn();
    const { unmount } = render(<UdfFieldsRenderer entityType={0} onValuesChange={onValuesChange} />);

    await waitFor(() => expect(screen.getByText('Refused care')).toBeTruthy());
    fireEvent.press(screen.getByText('Refused care'));

    expect(lastSubmitted(onValuesChange).outcome).toBe('refused');
    expect(screen.getByTestId('udf-combo-input-outcome').props.value).toBe('Refused care');
    unmount();
  });

  it('sends free text as typed and narrows the suggestions', async () => {
    setDefinition([outcome]);
    const onValuesChange = jest.fn();
    const { unmount } = render(<UdfFieldsRenderer entityType={0} onValuesChange={onValuesChange} />);

    await waitFor(() => expect(screen.getByTestId('udf-combo-input-outcome')).toBeTruthy());
    fireEvent.changeText(screen.getByTestId('udf-combo-input-outcome'), 'Ref');
    expect(screen.queryByText('Transported')).toBeNull();
    expect(screen.getByText('Refused care')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('udf-combo-input-outcome'), 'Referred to crisis line');
    expect(lastSubmitted(onValuesChange).outcome).toBe('Referred to crisis line');
    expect(screen.queryByTestId('udf-combo-suggestions-outcome')).toBeNull();
    unmount();
  });

  it('shows a stored combo key as its label', async () => {
    setDefinition([outcome]);
    setValues([{ UdfFieldId: 'outcome', Value: 'tx' }]);
    const onValuesChange = jest.fn();
    const { unmount } = render(<UdfFieldsRenderer entityType={0} entityId="call-1" onValuesChange={onValuesChange} />);

    await waitFor(() => expect(screen.getByTestId('udf-combo-input-outcome').props.value).toBe('Transported'));
    expect(lastSubmitted(onValuesChange).outcome).toBe('tx');
    unmount();
  });

  it('leaves a protected combo value untouched so the server keeps it', async () => {
    setDefinition([outcome]);
    setValues([{ UdfFieldId: 'outcome', Value: 'REDACTED' }]);
    const onValuesChange = jest.fn();
    const { unmount } = render(<UdfFieldsRenderer entityType={0} entityId="call-1" onValuesChange={onValuesChange} />);

    await waitFor(() => expect(screen.getByTestId('udf-combo-input-outcome').props.value).toBe('REDACTED'));
    expect(lastSubmitted(onValuesChange).outcome).toBe('REDACTED');
    unmount();
  });

  it('shows no suggestions and blocks editing when read-only', async () => {
    setDefinition([outcome]);
    setValues([{ UdfFieldId: 'outcome', Value: 'refused' }]);
    const { unmount } = render(<UdfFieldsRenderer entityType={0} entityId="call-1" onValuesChange={jest.fn()} readOnly={true} />);

    await waitFor(() => expect(screen.getByTestId('udf-combo-input-outcome').props.value).toBe('Refused care'));
    expect(screen.getByTestId('udf-combo-input-outcome').props.editable).toBe(false);
    expect(screen.queryByTestId('udf-combo-suggestions-outcome')).toBeNull();
    unmount();
  });
});
