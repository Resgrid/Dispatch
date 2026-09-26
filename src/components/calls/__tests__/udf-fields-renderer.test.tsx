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
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

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

  it('renders dropdown options by label and stores the key', async () => {
    setDefinition([disposition]);
    const onValuesChange = jest.fn();
    const { unmount } = render(<UdfFieldsRenderer entityType={0} onValuesChange={onValuesChange} />);

    await waitFor(() => expect(screen.getByText('Priority 2')).toBeTruthy());
    expect(screen.queryByText(/MinLength/)).toBeNull();

    fireEvent.press(screen.getByText('Priority 2'));
    expect(lastSubmitted(onValuesChange).disposition).toBe('p2');
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
