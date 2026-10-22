import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { type RecommendationConditionsProps, RecommendationPanel } from '@/components/runcards/recommendation-panel';
import { type DispatchResponseCodeData } from '@/models/v4/awaitingResources/awaitingResourcesResultData';
import {
  DispatchRecommendationMode,
  type DispatchRecommendationResultData,
  RecommendationOutcome,
  RecommendationSelectionReason,
  RequirementFallbackStep,
  RequirementScope,
  RequirementShortfallReason,
  ResponseTimeSource,
  RunCardConditionResult,
  RunCardConditionType,
  type RunCardDecisionData,
  RunCardDecisionSource,
  RunCardStatusFilter,
  type UnitRecommendationData,
} from '@/models/v4/runcards/dispatchRecommendationResultData';

// Keys come back with their interpolation values, so a test can see what a line was built from.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));

const operand = (targets: string, resource: string | null, seconds: number | null) => ({
  TargetsLabel: targets,
  StatusFilter: RunCardStatusFilter.AnyAvailable,
  IsPerson: false,
  ResourceId: resource ? '1' : null,
  ResourceName: resource,
  ResponseSeconds: seconds,
  TimeSource: ResponseTimeSource.Routed,
  PositionSource: 1,
  Stale: false,
  CandidateCount: resource ? 1 : 0,
});

const decision = (overrides: Partial<RunCardDecisionData> = {}): RunCardDecisionData => ({
  LevelHasGraph: true,
  Pinned: false,
  FromPreview: false,
  PinnedOn: null,
  PinSource: null,
  Uncertain: false,
  IdealConfigurationUnavailable: true,
  Outcome: RecommendationOutcome.Dispatch,
  OutcomeNodeKey: 'leaf-a',
  OutcomeLabel: 'PIT first',
  PackageId: 3,
  PackageName: 'PIT + MUG',
  AdviceText: null,
  Path: [
    {
      NodeKey: 'cond-1',
      Label: 'PIT arrives at least 2 min before MUG',
      ConditionType: RunCardConditionType.ArrivesBefore,
      Result: RunCardConditionResult.Yes,
      Uncertain: true,
      Subject: operand('PIT', 'P-21', 250),
      Reference: operand('MUG', 'M-1', 480),
      ThresholdSeconds: 120,
      RequiredCount: 1,
      MarginSeconds: 230,
      TimeSource: ResponseTimeSource.Routed,
      Note: null,
    },
  ],
  Fallbacks: [
    {
      RowLabel: 'MUG',
      RequirementScope: RequirementScope.Package,
      RequirementId: 12,
      SentInstead: 'PIT P-21',
      Step: RequirementFallbackStep.Substitute,
      SubstitutePackageName: 'PIT only',
      Outstanding: true,
      RequiredCount: 1,
      FilledCount: 0,
    },
  ],
  FirstArriving: [{ RowLabel: 'First due', ResourceName: 'P-21', IsPerson: false, ResponseSeconds: 250, AlreadyIncluded: true }],
  ...overrides,
});

const unit = (overrides: Partial<UnitRecommendationData> = {}): UnitRecommendationData => ({
  UnitId: 21,
  UnitName: 'P-21',
  UnitTypeId: 2,
  UnitTypeName: 'PIT',
  StationGroupId: null,
  StationGroupName: null,
  SelectionReason: RecommendationSelectionReason.SubstitutePackage,
  CascadeDepth: 0,
  DistanceMeters: null,
  EtaSeconds: null,
  LocationTimestamp: null,
  LocationIsStale: false,
  CurrentStatusText: null,
  StaffingLevel: null,
  SatisfiesRequirementId: 12,
  RequirementScope: RequirementScope.Package,
  RowLabel: 'MUG',
  ResponseCodeId: 3,
  ResponseCode: 'C3',
  ResponseCodeName: 'Lights and siren',
  ResponseCodeColor: '#dc2626',
  ...overrides,
});

const recommendation = (overrides: Partial<DispatchRecommendationResultData> = {}): DispatchRecommendationResultData => ({
  MatchedRunCardId: 7,
  MatchedRunCardName: 'Cardiac arrest',
  AlarmLevel: 1,
  ModeUsed: DispatchRecommendationMode.ClosestUnit,
  AutoDispatch: false,
  Units: [unit()],
  Personnel: [],
  Shortfalls: [
    {
      IsUnitRequirement: true,
      RequirementId: 12,
      TypeOrRoleId: 4,
      TypeOrRoleName: 'MUG',
      AlarmLevel: 1,
      RequiredCount: 1,
      FilledCount: 0,
      Reason: RequirementShortfallReason.NoCandidatesAvailable,
      RequirementScope: RequirementScope.Package,
      Outstanding: true,
    },
  ],
  MoveUps: [],
  Notes: [],
  Decision: decision(),
  ...overrides,
});

const codes: DispatchResponseCodeData[] = [
  { Id: 2, Code: 'C2', Name: 'Urgent', Description: null, Color: '#f59e0b', SortOrder: 1, Retired: false },
  { Id: 3, Code: 'C3', Name: 'Lights and siren', Description: null, Color: '#dc2626', SortOrder: 2, Retired: false },
];

const renderPanel = (rec: DispatchRecommendationResultData, conditions?: RecommendationConditionsProps) =>
  render(<RecommendationPanel recommendation={rec} isLoading={false} error={null} hasFetched isApplied={false} onApply={jest.fn()} onRefresh={jest.fn()} conditions={conditions} />);

const testID = 'run-card-recommendation-panel';

describe('RecommendationPanel conditional run cards', () => {
  it('shows nothing of the decision without Dispatch.RunCardConditions', () => {
    renderPanel(recommendation());

    expect(screen.queryByTestId(`${testID}-decision`)).toBeNull();
    expect(screen.queryByTestId(`${testID}-unit-21-code`)).toBeNull();
    expect(screen.queryByTestId(`${testID}-unit-21-row`)).toBeNull();
    expect(screen.queryByTestId(`${testID}-shortfall-12-awaiting`)).toBeNull();
  });

  it('explains the decision: outcome, package, the condition tested and its times', () => {
    renderPanel(recommendation(), { enabled: true });

    expect(screen.getByTestId(`${testID}-decision`)).toBeTruthy();
    expect(screen.getByText(/run_cards\.conditions\.outcome .*PIT first/)).toBeTruthy();
    expect(screen.getByText(/run_cards\.conditions\.package .*PIT \+ MUG/)).toBeTruthy();
    expect(screen.getByText('PIT arrives at least 2 min before MUG')).toBeTruthy();
    expect(screen.getByText(/arrives_before_detail .*"subject":"PIT \(P-21\)","subjectTime":"4:10","reference":"MUG \(M-1\)","referenceTime":"8:00"/)).toBeTruthy();
    expect(screen.getByTestId(`${testID}-decision-condition-0-result`)).toBeTruthy();
    expect(screen.getByText('run_cards.conditions.result_yes')).toBeTruthy();
    expect(screen.getByTestId(`${testID}-decision-condition-0-uncertain`)).toBeTruthy();
    expect(screen.getByText(/run_cards\.conditions\.time_routed/)).toBeTruthy();
  });

  it('flags the ideal configuration as unavailable, says what went instead and that the call keeps awaiting it', () => {
    renderPanel(recommendation(), { enabled: true });

    expect(screen.getByText('run_cards.conditions.ideal_unavailable')).toBeTruthy();
    expect(screen.getByText(/fallback_substitute .*"row":"MUG","sent":"PIT P-21"/)).toBeTruthy();
    expect(screen.getByTestId(`${testID}-decision-fallback-0-outstanding`)).toBeTruthy();
    expect(screen.getByTestId(`${testID}-shortfall-12-awaiting`)).toBeTruthy();
  });

  it('lists first-arriving rows', () => {
    renderPanel(recommendation(), { enabled: true });

    expect(screen.getByTestId(`${testID}-decision-first-arriving`)).toBeTruthy();
    expect(screen.getByText(/first_arriving_line .*"row":"First due","resource":"P-21","time":"4:10"/)).toBeTruthy();
  });

  it('puts advice up front, even when nothing is selected', () => {
    renderPanel(
      recommendation({ Units: [], Shortfalls: [], Decision: decision({ Outcome: RecommendationOutcome.Advice, AdviceText: 'Send the nearest MUG by radio.', Fallbacks: [], IdealConfigurationUnavailable: false }) }),
      {
        enabled: true,
      }
    );

    expect(screen.getByTestId(`${testID}-decision-advice`)).toBeTruthy();
    expect(screen.getByText('Send the nearest MUG by radio.')).toBeTruthy();
  });

  it('shows the row each unit fills and its proposed code in the code colour', () => {
    renderPanel(recommendation(), { enabled: true });

    expect(screen.getByText(/fills_row .*"row":"MUG"/)).toBeTruthy();
    expect(screen.getByTestId(`${testID}-unit-21-code`)).toBeTruthy();
    expect(screen.getByText('C3')).toBeTruthy();
  });

  it('lets the dispatcher change a unit code when the department has codes', () => {
    const onUnitResponseCodeChange = jest.fn();
    renderPanel(recommendation(), { enabled: true, responseCodes: codes, unitResponseCodes: {}, onUnitResponseCodeChange });

    fireEvent.press(screen.getByTestId(`${testID}-unit-21-code-button`));
    fireEvent.press(screen.getByTestId(`${testID}-unit-21-code-option-2-button`));

    expect(onUnitResponseCodeChange).toHaveBeenCalledWith(21, 2);
  });

  it('can clear a unit code', () => {
    const onUnitResponseCodeChange = jest.fn();
    renderPanel(recommendation(), { enabled: true, responseCodes: codes, unitResponseCodes: {}, onUnitResponseCodeChange });

    fireEvent.press(screen.getByTestId(`${testID}-unit-21-code-button`));
    fireEvent.press(screen.getByTestId(`${testID}-unit-21-code-option-none`));

    expect(onUnitResponseCodeChange).toHaveBeenCalledWith(21, null);
  });

  it("shows the dispatcher's choice over the proposal", () => {
    renderPanel(recommendation(), { enabled: true, responseCodes: codes, unitResponseCodes: { 21: 2 }, onUnitResponseCodeChange: jest.fn() });

    expect(screen.getByText('C2')).toBeTruthy();
    expect(screen.queryByText('C3')).toBeNull();
  });

  it('offers Re-evaluate for a pinned decision on a call already out', () => {
    const onReevaluate = jest.fn();
    renderPanel(recommendation({ Decision: decision({ Pinned: true, PinSource: RunCardDecisionSource.SaveTime, PinnedOn: '2026-10-22T10:00:00' }) }), { enabled: true, onReevaluate });

    expect(screen.getByText(/run_cards\.conditions\.pinned_save_time/)).toBeTruthy();
    fireEvent.press(screen.getByTestId(`${testID}-decision-reevaluate`));

    expect(onReevaluate).toHaveBeenCalledTimes(1);
  });

  it('offers no Re-evaluate for a fresh preview', () => {
    renderPanel(recommendation(), { enabled: true, onReevaluate: jest.fn() });

    expect(screen.queryByTestId(`${testID}-decision-reevaluate`)).toBeNull();
  });
});
