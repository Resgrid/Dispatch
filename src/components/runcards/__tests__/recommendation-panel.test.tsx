import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { RecommendationPanel } from '@/components/runcards/recommendation-panel';
import {
  DispatchRecommendationMode,
  type DispatchRecommendationResultData,
  RecommendationSelectionReason,
  type UnitRecommendationData,
} from '@/models/v4/runcards/dispatchRecommendationResultData';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const unit = (overrides: Partial<UnitRecommendationData> = {}): UnitRecommendationData => ({
  UnitId: 1,
  UnitName: 'MUG Gent 1',
  UnitTypeId: 2,
  UnitTypeName: 'MUG',
  StationGroupId: 3,
  StationGroupName: 'UZ Gent',
  SelectionReason: RecommendationSelectionReason.ClosestByEta,
  CascadeDepth: 0,
  DistanceMeters: 2600,
  EtaSeconds: 300,
  LocationTimestamp: null,
  LocationIsStale: false,
  CurrentStatusText: null,
  StaffingLevel: null,
  SatisfiesRequirementId: 11,
  ...overrides,
});

const recommendation = (units: UnitRecommendationData[]): DispatchRecommendationResultData => ({
  MatchedRunCardId: 7,
  MatchedRunCardName: 'Reanimatie',
  AlarmLevel: 1,
  ModeUsed: DispatchRecommendationMode.ClosestUnit,
  AutoDispatch: false,
  Units: units,
  Personnel: [],
  Shortfalls: [],
  MoveUps: [],
  Notes: [],
});

const renderPanel = (units: UnitRecommendationData[]) =>
  render(<RecommendationPanel recommendation={recommendation(units)} isLoading={false} error={null} hasFetched isApplied={false} onApply={jest.fn()} onRefresh={jest.fn()} />);

describe('RecommendationPanel unit status', () => {
  it('shows a recommended unit status in the colours the department set up', () => {
    renderPanel([unit({ CurrentStatusText: 'Standplaats', CurrentStatusColor: '#FF0000', CurrentStatusTextColor: '#000000' })]);

    const badge = screen.getByTestId('run-card-recommendation-panel-unit-1-status');
    expect(StyleSheet.flatten(badge.props.style)).toEqual(expect.objectContaining({ backgroundColor: '#FF0000' }));
    expect(StyleSheet.flatten(screen.getByText('Standplaats').props.style)).toEqual(expect.objectContaining({ color: '#000000' }));
  });

  it('shows the status once, as the badge, not again in the detail line', () => {
    renderPanel([unit({ CurrentStatusText: 'Radiofonisch', CurrentStatusColor: '#0000FF', CurrentStatusTextColor: '#000000' })]);

    expect(screen.getAllByText(/Radiofonisch/)).toHaveLength(1);
    expect(screen.getByText('UZ Gent · 2.6 km · 5 min')).toBeTruthy();
  });

  it('keeps a status with no colour as a plain badge', () => {
    renderPanel([unit({ CurrentStatusText: 'Delayed', CurrentStatusColor: null })]);

    const badge = screen.getByTestId('run-card-recommendation-panel-unit-1-status');
    expect(StyleSheet.flatten(badge.props.style) ?? {}).not.toHaveProperty('backgroundColor');
    expect(screen.getByText('Delayed')).toBeTruthy();
  });

  it('shows no badge when the engine had no status', () => {
    renderPanel([unit({ CurrentStatusText: null })]);

    expect(screen.queryByTestId('run-card-recommendation-panel-unit-1-status')).toBeNull();
  });
});
