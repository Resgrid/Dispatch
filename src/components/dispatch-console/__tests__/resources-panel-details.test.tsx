import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';

import { ResourcesPanel } from '../resources-panel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/components/ui/icon', () => ({
  Icon: () => null,
}));

jest.mock('../animated-refresh-icon', () => ({
  AnimatedRefreshIcon: () => null,
}));

// Multi-unit selection is not part of this test; a closed selection keeps the rows on their normal press path.
jest.mock('../unit-multi-select', () => ({
  useUnitMultiSelect: () => ({
    isSelectionMode: false,
    selectedUnitIds: [],
    selectedUnitIdSet: new Set<string>(),
    toggleSelectionMode: jest.fn(),
    handleUnitPress: () => false,
    handleUnitLongPress: jest.fn(),
    addUnits: jest.fn(),
    clearSelection: jest.fn(),
    endSelection: jest.fn(),
  }),
  UnitMultiSelectToggle: () => null,
  UnitSelectionBar: () => null,
  UnitSelectionCheckbox: () => null,
}));

let mockUnits: UnitInfoResultData[] = [];
let mockPersonnel: PersonnelInfoResultData[] = [];

jest.mock('@/stores/units/store', () => ({
  useUnitsStore: (selector: (state: unknown) => unknown) => selector({ units: mockUnits, isLoading: false, fetchUnits: jest.fn() }),
}));

jest.mock('@/stores/personnel/store', () => ({
  usePersonnelStore: (selector: (state: unknown) => unknown) => selector({ personnel: mockPersonnel, isLoading: false, fetchPersonnel: jest.fn() }),
}));

jest.mock('@/stores/dispatch/dashboard-view-store', () => ({
  useDashboardViewStore: (selector: (state: unknown) => unknown) => selector({ availableOnly: false, collapsedCards: {}, setCardCollapsed: jest.fn() }),
  selectCardCollapsed: () => () => false,
}));

const person = (patch: Partial<PersonnelInfoResultData> = {}): PersonnelInfoResultData =>
  ({
    UserId: 'u-jane',
    FirstName: 'Jane',
    LastName: 'Doe',
    GroupName: 'Crisis Call Center',
    Status: 'Available',
    StatusColor: '#16a34a',
    Staffing: 'On Duty',
    StaffingColor: '#2563eb',
    Roles: ['Paramedic', 'Supervisor'],
    ...patch,
  }) as PersonnelInfoResultData;

const unit = (patch: Partial<UnitInfoResultData> = {}): UnitInfoResultData =>
  ({
    UnitId: 'mct1',
    Name: 'MCT 1',
    Type: 'Mobile Crisis Team',
    GroupName: 'Central Region',
    CurrentStatus: 'Available',
    CurrentStatusColor: '#16a34a',
    Roles: [
      { RoleId: 'r1', RoleName: 'Clinician', UserId: 'u1', Name: 'Jordan Kim' },
      { RoleId: 'r2', RoleName: 'Peer', UserId: 'u2', Name: 'Maria Gonzalez' },
      { RoleId: 'r3', RoleName: 'Driver', UserId: 'u3', Name: 'Sam Okafor' },
      { RoleId: 'r4', RoleName: 'Trainee', UserId: '', Name: '' },
    ],
    ...patch,
  }) as UnitInfoResultData;

describe('ResourcesPanel row details', () => {
  afterEach(() => {
    mockUnits = [];
    mockPersonnel = [];
  });

  it("shows a person's group, roles, status and staffing", () => {
    mockPersonnel = [person()];

    render(<ResourcesPanel />);

    expect(screen.getByText('Crisis Call Center')).toBeTruthy();
    expect(screen.getByTestId('resource-roles-u-jane')).toHaveTextContent('Paramedic, Supervisor');
    expect(screen.getByText('Available')).toBeTruthy();
    expect(screen.getByTestId('resource-staffing-u-jane')).toHaveTextContent('On Duty');
  });

  it('leaves out the roles line for a person who holds none', () => {
    mockPersonnel = [person({ Roles: [] })];

    render(<ResourcesPanel />);

    expect(screen.queryByTestId('resource-roles-u-jane')).toBeNull();
    expect(screen.getByTestId('resource-staffing-u-jane')).toHaveTextContent('On Duty');
  });

  it("shows a unit's type with its group, and how many of its role seats are filled followed by who fills them", () => {
    mockUnits = [unit()];

    render(<ResourcesPanel />);

    expect(screen.getByText('Mobile Crisis Team · Central Region')).toBeTruthy();
    expect(screen.getByTestId('unit-crew-count-mct1')).toHaveTextContent('3/4');
    expect(screen.getByTestId('unit-crew-names-mct1')).toHaveTextContent('Jordan Kim, Maria Gonzalez, Sam Okafor');
    // Staffing is a personnel field; units show their status only
    expect(screen.queryByTestId('resource-staffing-mct1')).toBeNull();
  });

  it('shows the count alone when none of the seats is filled, and nothing for a unit with no roles', () => {
    mockUnits = [unit({ UnitId: 'empty', Name: 'FU 1', Roles: [{ RoleId: 'r1', RoleName: 'Clinician', UserId: '', Name: '' }] }), unit({ UnitId: 'none', Name: 'MCT 2', Roles: [] })];

    render(<ResourcesPanel />);

    expect(screen.getByTestId('unit-crew-count-empty')).toHaveTextContent('0/1');
    expect(screen.queryByTestId('unit-crew-names-empty')).toBeNull();
    expect(screen.queryByTestId('unit-crew-none')).toBeNull();
  });

  it('finds resources by staffing, role and the people on a unit', () => {
    mockUnits = [unit()];
    mockPersonnel = [person(), person({ UserId: 'u-alex', FirstName: 'Alex', LastName: 'Rivera', Staffing: 'Off Duty', Roles: ['Dispatcher'] })];

    render(<ResourcesPanel />);
    const search = screen.getByPlaceholderText('dispatch.search_resources_placeholder');

    fireEvent.changeText(search, 'off duty');
    expect(screen.getByText('Alex Rivera')).toBeTruthy();
    expect(screen.queryByText('Jane Doe')).toBeNull();
    expect(screen.queryByText('MCT 1')).toBeNull();

    fireEvent.changeText(search, 'supervisor');
    expect(screen.getByText('Jane Doe')).toBeTruthy();
    expect(screen.queryByText('Alex Rivera')).toBeNull();

    fireEvent.changeText(search, 'maria');
    expect(screen.getByText('MCT 1')).toBeTruthy();
    expect(screen.queryByText('Jane Doe')).toBeNull();
  });
});
