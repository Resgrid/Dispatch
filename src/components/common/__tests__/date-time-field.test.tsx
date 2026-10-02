import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { TextInput } from 'react-native';

import { DateTimeField } from '@/components/common/date-time-field';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));

it('selects a leap day using the calendar and commits only on Done', () => {
  const onChange = jest.fn();
  const screen = render(<DateTimeField value="2024-02-01" label="Issued on" onChange={onChange} testID="date" />);
  expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
  fireEvent.press(screen.getByTestId('date'));
  expect(screen.queryByTestId('date-day-30')).toBeNull();
  fireEvent.press(screen.getByTestId('date-day-29'));
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('date-done'));
  expect(onChange).toHaveBeenCalledWith('2024-02-29');
  screen.unmount();
});

it('changes month and year without rolling an end-of-month value into another month', () => {
  const onChange = jest.fn();
  const screen = render(<DateTimeField value="2024-01-31" label="Expires on" onChange={onChange} testID="date" />);
  fireEvent.press(screen.getByTestId('date'));
  fireEvent.press(screen.getByTestId('date-year'));
  fireEvent.press(screen.getByTestId('date-year-2025'));
  fireEvent.press(screen.getByTestId('date-month'));
  fireEvent.press(screen.getByTestId('date-month-1'));
  expect(screen.queryByTestId('date-day-29')).toBeNull();
  fireEvent.press(screen.getByTestId('date-day-28'));
  fireEvent.press(screen.getByTestId('date-done'));
  expect(onChange).toHaveBeenCalledWith('2025-02-28');
  screen.unmount();
});

it('waits for a day after month or year navigation instead of committing the original date', () => {
  const onChange = jest.fn();
  const screen = render(<DateTimeField value="2026-03-05" label="Issued on" onChange={onChange} testID="date" />);
  fireEvent.press(screen.getByTestId('date'));
  fireEvent.press(screen.getByTestId('date-next'));
  expect(screen.getByTestId('date-done').props.accessibilityState).toMatchObject({ disabled: true });
  fireEvent.press(screen.getByTestId('date-done'));
  expect(onChange).not.toHaveBeenCalled();

  fireEvent.press(screen.getByTestId('date-year'));
  fireEvent.press(screen.getByTestId('date-year-2027'));
  fireEvent.press(screen.getByTestId('date-done'));
  expect(onChange).not.toHaveBeenCalled();

  fireEvent.press(screen.getByTestId('date-day-9'));
  fireEvent.press(screen.getByTestId('date-done'));
  expect(onChange).toHaveBeenCalledWith('2027-04-09');
  screen.unmount();
});

it('keeps Done available when navigation returns to the drafted month', () => {
  const onChange = jest.fn();
  const screen = render(<DateTimeField mode="datetime" value="2026-09-26T21:15:00.000Z" label="Date and time" onChange={onChange} testID="date" />);
  fireEvent.press(screen.getByTestId('date'));
  fireEvent.press(screen.getByTestId('date-previous'));
  fireEvent.press(screen.getByTestId('date-next'));
  fireEvent.press(screen.getByTestId('date-done'));
  expect(onChange).toHaveBeenCalledWith('2026-09-26T21:15:00.000Z');
  screen.unmount();
});

it('cancels without changing the value, supports clearing, and prevents disabled edits', () => {
  const onChange = jest.fn();
  const screen = render(<DateTimeField value="2026-09-26" label="Date" onChange={onChange} testID="date" />);
  fireEvent.press(screen.getByTestId('date'));
  fireEvent.press(screen.getByTestId('date-day-15'));
  fireEvent.press(screen.getByTestId('date-cancel'));
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('date'));
  fireEvent.press(screen.getByTestId('date-clear'));
  expect(onChange).toHaveBeenCalledWith('');
  screen.rerender(<DateTimeField value="2026-09-26" label="Date" onChange={onChange} testID="date" disabled />);
  fireEvent.press(screen.getByTestId('date'));
  expect(screen.queryByTestId('date-done')).toBeNull();
  screen.unmount();
});

it('picks clock hours and minutes without a keyboard or clearing a required time', () => {
  const onChange = jest.fn();
  const screen = render(<DateTimeField mode="time" value="08:00" label="End" onChange={onChange} testID="time" clearable={false} />);
  fireEvent.press(screen.getByTestId('time'));
  expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
  expect(screen.queryByTestId('time-clear')).toBeNull();
  fireEvent.press(screen.getByTestId('time-hour-23'));
  fireEvent.press(screen.getByTestId('time-minute-59'));
  fireEvent.press(screen.getByTestId('time-done'));
  expect(onChange).toHaveBeenCalledWith('23:59');
  screen.unmount();
});

it('preserves a record timestamp when confirming its date and time without changes', () => {
  const onChange = jest.fn();
  const screen = render(<DateTimeField mode="datetime" value="2026-09-26T21:15:00.000Z" label="Date and time" onChange={onChange} testID="date" />);
  fireEvent.press(screen.getByTestId('date'));
  fireEvent.press(screen.getByTestId('date-done'));
  expect(onChange).toHaveBeenCalledWith('2026-09-26T21:15:00.000Z');
  screen.unmount();
});
