import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { AlarmLevelBadge } from '@/components/runcards/alarm-level-badge';
import { useIsRunCardsEnabled } from '@/stores/feature-flags/store';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (key === 'run_cards.alarm_level' ? `Alarm ${options?.level}` : key),
  }),
}));

jest.mock('@/stores/feature-flags/store', () => ({
  useIsRunCardsEnabled: jest.fn(() => true),
}));

const mockedIsEnabled = useIsRunCardsEnabled as jest.Mock;

describe('AlarmLevelBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsEnabled.mockReturnValue(true);
  });

  it('renders the level once a call has been escalated', () => {
    render(<AlarmLevelBadge alarmLevel={3} />);

    expect(screen.getByText('Alarm 3')).toBeTruthy();
  });

  it('stays hidden at the first alarm', () => {
    // Every call is a first alarm; badging them all would bury the ones that matter.
    render(<AlarmLevelBadge alarmLevel={1} />);

    expect(screen.queryByTestId('alarm-level-badge')).toBeNull();
  });

  it('stays hidden when run cards are disabled', () => {
    // Alarm levels only move through a run card, so the field means nothing without the feature.
    mockedIsEnabled.mockReturnValue(false);

    render(<AlarmLevelBadge alarmLevel={4} />);

    expect(screen.queryByTestId('alarm-level-badge')).toBeNull();
  });

  it('tolerates a missing level', () => {
    render(<AlarmLevelBadge alarmLevel={undefined} />);

    expect(screen.queryByTestId('alarm-level-badge')).toBeNull();
  });
});
