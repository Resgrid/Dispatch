import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import React from 'react';

import { type ContactPreplanData } from '@/models/v4/contacts/contactPreplanResult';

import { PreplanSummary } from '../preplan-summary';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const emptyPreplan = (overrides: Partial<ContactPreplanData> = {}): ContactPreplanData =>
  ({
    ContactPreplanId: 'p1',
    ContactId: 'c1',
    ConstructionTypeName: 'Wood frame',
    RoofTypeName: 'Flat',
    OccupancyTypeName: 'Warehouse',
    OccupantLoad: null,
    HasOccupantsNeedingAssistance: false,
    HazmatOnSite: false,
    IsReviewOverdue: false,
    Hazards: [],
    RedactedFields: [],
    ...overrides,
  }) as unknown as ContactPreplanData;

describe('PreplanSummary sections', () => {
  it('renders no titled box for a section whose fields are all empty', () => {
    const { queryByText } = render(<PreplanSummary preplan={emptyPreplan()} />);

    // Sections decide emptiness from the data: a Field that returns null at render time is not
    // something the section can see, so the title must not be drawn for it.
    expect(queryByText('contacts.preplan.access')).toBeNull();
    expect(queryByText('contacts.preplan.utilities')).toBeNull();
    expect(queryByText('contacts.preplan.water_supply')).toBeNull();
    expect(queryByText('contacts.preplan.on_site_contacts')).toBeNull();
    expect(queryByText('contacts.preplan.general_hazards')).toBeNull();
    // Occupancy always carries the construction line.
    expect(queryByText('contacts.preplan.occupancy')).not.toBeNull();
  });

  it('renders a section as soon as one of its fields has a value', () => {
    const { queryByText } = render(<PreplanSummary preplan={emptyPreplan({ GateCode: '1234', GeneralHazardNotes: '  ' })} />);

    expect(queryByText('contacts.preplan.access')).not.toBeNull();
    expect(queryByText('contacts.preplan.gate_code')).not.toBeNull();
    // Whitespace is not a value.
    expect(queryByText('contacts.preplan.general_hazards')).toBeNull();
  });

  it('counts a numeric-only water-supply value as content', () => {
    const { queryByText } = render(<PreplanSummary preplan={emptyPreplan({ RequiredFireFlowGpm: 1500 })} />);

    expect(queryByText('contacts.preplan.water_supply')).not.toBeNull();
    expect(queryByText('contacts.preplan.required_fire_flow')).not.toBeNull();
  });

  it('shows the empty state when there is no plan and no hazards', () => {
    const { getByTestId } = render(<PreplanSummary preplan={null} />);

    expect(getByTestId('preplan-summary-empty')).toBeTruthy();
  });
});
