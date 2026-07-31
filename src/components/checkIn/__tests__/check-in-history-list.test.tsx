import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { CheckInRecordResultData } from '@/models/v4/checkIn/checkInRecordResultData';

import { CheckInHistoryList } from '../check-in-history-list';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

function makeRecord(): CheckInRecordResultData {
  const record = new CheckInRecordResultData();
  record.CheckInRecordId = '1';
  record.CallId = 1;
  record.CheckInType = 1;
  record.CheckInTypeName = 'Personnel';
  record.UserId = 'user1';
  record.UnitId = 0;
  record.Timestamp = '2026-01-01T12:00:00Z';
  record.Note = 'Radio confirmed';
  return record;
}

describe('CheckInHistoryList', () => {
  it('renders nothing when history is empty', () => {
    const { toJSON } = render(<CheckInHistoryList history={[]} isLoading={false} />);
    expect(toJSON()).toBeNull();
  });

  it('shows loading state', () => {
    const { getByText } = render(<CheckInHistoryList history={[]} isLoading={true} />);
    expect(getByText('common.loading')).toBeTruthy();
  });

  it('renders collapsed header when history exists', () => {
    const { getByText, queryByText } = render(<CheckInHistoryList history={[makeRecord()]} isLoading={false} />);
    expect(getByText('check_in.history')).toBeTruthy();
    expect(queryByText('Personnel')).toBeNull();
  });

  it('expands to show records on header press', () => {
    const { getByText } = render(<CheckInHistoryList history={[makeRecord()]} isLoading={false} />);
    fireEvent.press(getByText('check_in.history'));
    expect(getByText('Personnel')).toBeTruthy();
    expect(getByText('Radio confirmed')).toBeTruthy();
  });
});
