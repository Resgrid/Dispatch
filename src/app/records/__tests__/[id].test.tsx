import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { getRecord } from '@/api/records/records';
import { RmsRecordState } from '@/models/v4/records';
import { useRecordsStore } from '@/stores/records/store';

import RecordScreen from '../[id]';

interface MockChildrenProps {
  children?: React.ReactNode;
  testID?: string;
}

interface MockButtonProps extends MockChildrenProps {
  onPress?: () => void;
  isDisabled?: boolean;
}

interface MockCheckboxProps extends MockChildrenProps {
  onChange?: (checked: boolean) => void;
}

interface MockRecordFormProps {
  onChange: (values: Record<string, unknown>) => void;
}

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'r1' }),
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock('react-i18next', () => {
  // Stable like the real one: the screen's loaders depend on it.
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

jest.mock('@/api/records/records', () => ({
  getRecord: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/lib/records/schema', () => ({
  toValueList: jest.fn((values: Record<string, unknown>) => Object.values(values)),
  toValueMap: jest.fn(() => ({})),
  unsupportedFieldKeys: jest.fn(() => []),
  validate: jest.fn(() => []),
}));

jest.mock('@/stores/records/store', () => ({
  useRecordsStore: jest.fn(),
}));

jest.mock('@/components/records/record-attachments', () => ({
  RecordAttachments: () => null,
}));

jest.mock('@/components/records/record-form', () => {
  const { TouchableOpacity } = require('react-native');
  return {
    RecordForm: ({ onChange }: MockRecordFormProps) => (
      <TouchableOpacity testID="record-form-edit" onPress={() => onChange({ 'main:notes': { SectionKey: 'main', FieldKey: 'notes', Value: 'Edited' } })} />
    ),
  };
});

jest.mock('@/components/ui/button', () => {
  const { Text, TouchableOpacity } = require('react-native');
  return {
    Button: ({ children, onPress, isDisabled, testID }: MockButtonProps) => (
      <TouchableOpacity onPress={onPress} disabled={isDisabled} testID={testID}>
        {children}
      </TouchableOpacity>
    ),
    ButtonText: ({ children }: MockChildrenProps) => <Text>{children}</Text>,
  };
});

jest.mock('@/components/ui/checkbox', () => {
  const { TouchableOpacity, View } = require('react-native');
  return {
    Checkbox: ({ children, onChange, testID }: MockCheckboxProps) => (
      <TouchableOpacity onPress={() => onChange?.(true)} testID={testID}>
        {children}
      </TouchableOpacity>
    ),
    CheckboxIcon: () => null,
    CheckboxIndicator: ({ children }: MockChildrenProps) => <View>{children}</View>,
    CheckboxLabel: () => null,
  };
});

jest.mock('@/components/ui/badge', () => {
  const { Text, View } = require('react-native');
  return {
    Badge: ({ children }: MockChildrenProps) => <View>{children}</View>,
    BadgeText: ({ children }: MockChildrenProps) => <Text>{children}</Text>,
  };
});

jest.mock('@/components/ui/box', () => {
  const { View } = require('react-native');
  return { Box: ({ children }: MockChildrenProps) => <View>{children}</View> };
});

jest.mock('@/components/ui/vstack', () => {
  const { View } = require('react-native');
  return { VStack: ({ children }: MockChildrenProps) => <View>{children}</View> };
});

jest.mock('@/components/ui/heading', () => {
  const { Text } = require('react-native');
  return { Heading: ({ children }: MockChildrenProps) => <Text>{children}</Text> };
});

jest.mock('@/components/ui/spinner', () => {
  const { View } = require('react-native');
  return { Spinner: () => <View testID="spinner" /> };
});

jest.mock('@/components/ui/text', () => {
  const { Text } = require('react-native');
  return { Text };
});

const mockGetRecord = getRecord as jest.MockedFunction<typeof getRecord>;
const mockUseRecordsStore = useRecordsStore as unknown as jest.Mock;

const record = (rowVersion: number) => ({
  RecordId: 'r1',
  DefinitionKey: 'shift-log',
  DefinitionVersion: 3,
  RecordNumber: 'SL-1',
  State: RmsRecordState.Draft,
  RowVersion: rowVersion,
  Values: { Cells: [] },
});

const store = {
  fetchSchema: jest.fn(),
  stageDraft: jest.fn(),
  pushDraft: jest.fn(),
  discardDraft: jest.fn(),
  submitForReview: jest.fn(),
  finalize: jest.fn(),
  entryFor: jest.fn(() => null),
};

describe('RecordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRecordsStore.mockImplementation((selector: (state: typeof store) => unknown) => selector(store));
    store.fetchSchema.mockResolvedValue({ Sections: [] });
    store.pushDraft.mockResolvedValue({ ok: true, recordId: 'r1' });
    store.submitForReview.mockResolvedValue({ ok: true });
    store.finalize.mockResolvedValue({ ok: true });
    mockGetRecord.mockResolvedValueOnce({ Data: record(4) } as never).mockResolvedValue({ Data: record(5) } as never);
  });

  it('submits the stored record as it is when nothing was edited', async () => {
    const { unmount } = render(<RecordScreen />);
    fireEvent.press(await screen.findByTestId('record-submit'));

    await waitFor(() => expect(store.submitForReview).toHaveBeenCalledWith('r1', 4));
    expect(store.pushDraft).not.toHaveBeenCalled();
    unmount();
  });

  it('saves unsaved edits before submitting, and submits the version that save produced', async () => {
    const { unmount } = render(<RecordScreen />);
    fireEvent.press(await screen.findByTestId('record-form-edit'));
    fireEvent.press(screen.getByTestId('record-submit'));

    await waitFor(() => expect(store.submitForReview).toHaveBeenCalledWith('r1', 5));
    expect(store.pushDraft).toHaveBeenCalledWith('edit-r1-4', expect.objectContaining({ recordId: 'r1', rowVersion: 4, values: [expect.objectContaining({ Value: 'Edited' })] }));
    expect(store.pushDraft.mock.invocationCallOrder[0]).toBeLessThan(store.submitForReview.mock.invocationCallOrder[0]);
    unmount();
  });

  it('does not finalize when the unsaved edits could not be saved', async () => {
    store.pushDraft.mockResolvedValue({ ok: false, conflict: 'etag' });

    const { unmount } = render(<RecordScreen />);
    fireEvent.press(await screen.findByTestId('record-form-edit'));
    fireEvent.press(screen.getByTestId('record-attest'));
    fireEvent.press(screen.getByTestId('record-finalize'));

    expect(await screen.findByText('records.conflict_etag')).toBeTruthy();
    expect(store.finalize).not.toHaveBeenCalled();
    unmount();
  });
});
