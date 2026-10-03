import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { TextInput } from 'react-native';

import { RecordField } from '@/components/records/record-field';
import { RmsFieldClassification, RmsFieldType } from '@/models/v4/records';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));

it.each([RmsFieldType.Date, RmsFieldType.DateTime])('renders record field type %i as a picker and preserves its value', (type) => {
  const onChange = jest.fn();
  const value = type === RmsFieldType.Date ? '2024-02-29' : '2024-02-29T21:30:00.000Z';
  const screen = render(
    <RecordField field={{ Key: 'date', Label: 'Date', Type: type, Classification: RmsFieldClassification.Standard }} value={{ Value: value } as never} required onChange={onChange} testID="record-date" />
  );
  expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
  fireEvent.press(screen.getByTestId('record-date-picker'));
  fireEvent.press(screen.getByTestId('record-date-picker-done'));
  expect(onChange).toHaveBeenCalledWith({ Value: value });
  screen.unmount();
});
