import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { type DispatchedEventResultData } from '@/models/v4/calls/dispatchedEventResultData';

import { ActivityLinkLegend, ActivityLinkMarker } from '../activity-link-marker';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('ActivityLinkMarker', () => {
  it.each([2, 3, 4])('renders the auto-linked marker with its explanation for source %p', (source) => {
    render(<ActivityLinkMarker source={source} />);

    const marker = screen.getByTestId('activity-link-marker-auto');
    expect(screen.getByText('call_detail.activity_link.auto_linked')).toBeTruthy();
    expect(marker.props.accessibilityLabel).toBe('call_detail.activity_link.auto_linked');
    expect(marker.props.accessibilityHint).toBe('call_detail.activity_link.auto_linked_hint');
    expect(screen.queryByTestId('activity-link-marker-inferred')).toBeNull();
  });

  it('renders the inferred marker with its explanation for source 5', () => {
    render(<ActivityLinkMarker source={5} />);

    const marker = screen.getByTestId('activity-link-marker-inferred');
    expect(screen.getByText('call_detail.activity_link.inferred')).toBeTruthy();
    expect(marker.props.accessibilityHint).toBe('call_detail.activity_link.inferred_hint');
    expect(screen.queryByTestId('activity-link-marker-auto')).toBeNull();
  });

  it.each([[1], [null], [undefined]])('renders nothing for source %p', (source) => {
    const { toJSON } = render(<ActivityLinkMarker source={source} />);
    expect(toJSON()).toBeNull();
  });
});

describe('ActivityLinkLegend', () => {
  const entry = (DestinationSource?: number | null) => ({ DestinationSource }) as DispatchedEventResultData;

  it('renders nothing when no entry is marked', () => {
    const { toJSON } = render(<ActivityLinkLegend activity={[entry(1), entry(null), entry(undefined)]} />);
    expect(toJSON()).toBeNull();
  });

  it('explains only the marker kinds present', () => {
    render(<ActivityLinkLegend activity={[entry(1), entry(3)]} />);

    expect(screen.getByTestId('activity-link-legend')).toBeTruthy();
    expect(screen.getByText('call_detail.activity_link.auto_linked_hint')).toBeTruthy();
    expect(screen.queryByText('call_detail.activity_link.inferred_hint')).toBeNull();
  });

  it('explains both kinds when both are present', () => {
    render(<ActivityLinkLegend activity={[entry(5), entry(2)]} />);

    expect(screen.getByText('call_detail.activity_link.auto_linked_hint')).toBeTruthy();
    expect(screen.getByText('call_detail.activity_link.inferred_hint')).toBeTruthy();
  });
});
