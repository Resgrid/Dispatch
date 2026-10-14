import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { RecordListItem } from '@/components/records/record-list-item';
import { type RecordSummaryData, RmsRecordState } from '@/models/v4/records';
import { terminologyStore } from '@/stores/terminology/store';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

jest.mock('@/stores/records/store', () => {
  const mockState = {
    entryFor: (definitionKey: string) => (definitionKey === 'shift-log' ? { DefinitionKey: 'shift-log', Name: 'Shift Log' } : null),
  };
  return { useRecordsStore: (selector: (state: typeof mockState) => unknown) => selector(mockState) };
});

const summary = (overrides: Partial<RecordSummaryData>): RecordSummaryData => ({
  RecordId: 'r1',
  DefinitionVersion: 1,
  State: RmsRecordState.Draft,
  CreatedOn: '2026-10-13T00:00:00Z',
  ModifiedOn: '2026-10-13T00:00:00Z',
  RowVersion: 1,
  ...overrides,
});

describe('RecordListItem', () => {
  beforeEach(() => {
    terminologyStore.setState({ names: {} });
  });

  it('shows the department name for a renamed built-in type instead of its definition key', () => {
    terminologyStore.setState({ names: { 'record-type.run': 'Incident Report' } });

    render(<RecordListItem record={summary({ DefinitionKey: 'system.run' })} onPress={jest.fn()} />);

    expect(screen.getAllByText('Incident Report').length).toBeGreaterThan(0);
    expect(screen.queryByText('system.run')).toBeNull();
  });

  it('shows the renamed type under a numbered record', () => {
    terminologyStore.setState({ names: { 'record-type.run': 'Incident Report' } });

    render(<RecordListItem record={summary({ DefinitionKey: 'system.run', RecordNumber: 'RUN-7' })} onPress={jest.fn()} />);

    expect(screen.getByText('RUN-7')).toBeTruthy();
    expect(screen.getByText('Incident Report')).toBeTruthy();
  });

  it('names a legacy record by its type number when it has no definition key', () => {
    terminologyStore.setState({ names: { 'record-type.training': 'Drill' } });

    render(<RecordListItem record={summary({ RecordType: 2, RecordNumber: 'TR-1' })} onPress={jest.fn()} />);

    expect(screen.getByText('Drill')).toBeTruthy();
  });

  it("falls back to the catalog's name for a department definition", () => {
    render(<RecordListItem record={summary({ DefinitionKey: 'shift-log', RecordNumber: 'SL-1' })} onPress={jest.fn()} />);

    expect(screen.getByText('Shift Log')).toBeTruthy();
  });
});
