import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { EtaSource, type NearestUnitBoard, UnitPositionSource } from '@/models/v4/dispatch/nearestUnitBoard';

import { DispatchSelectionModal } from '../dispatch-selection-modal';

/*
 * The picker with a call location: personnel and units ranked by the nearest-unit board, with distance, ETA, a
 * "Nearest" badge, status, staffing, group, roles and crew on each row.
 */

const CALL = { latitude: 39.5, longitude: -119.8 };

const board: NearestUnitBoard = {
  Latitude: CALL.latitude,
  Longitude: CALL.longitude,
  GeneratedOn: '2026-10-22T16:00:00Z',
  IsDepartmentWide: true,
  Notes: [],
  Units: [
    {
      UnitId: 2,
      Name: 'MCT 2',
      UnitType: 'Mobile Crisis Team',
      GroupName: 'South',
      StatusText: 'Available',
      StatusColor: '#2f9e44',
      IsAvailable: true,
      Latitude: 39.51,
      Longitude: -119.79,
      PositionIsStale: false,
      PositionSource: UnitPositionSource.Live,
      LocationHidden: false,
      DistanceMeters: 1400,
      EtaSeconds: 240,
      EtaSource: EtaSource.Estimated,
      TurnoutSeconds: 0,
      ResponseSeconds: 240,
      Crew: ['Sam Okafor'],
      CrewCount: 1,
      CrewAvailableCount: 1,
      OnShiftCount: 1,
    },
    {
      UnitId: 1,
      Name: 'MCT 1',
      UnitType: 'Mobile Crisis Team',
      GroupName: 'Central',
      StatusText: 'On Scene',
      StatusColor: '#c92a2a',
      IsAvailable: false,
      Latitude: 39.6,
      Longitude: -119.7,
      PositionIsStale: true,
      PositionTimestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      PositionSource: UnitPositionSource.Live,
      LocationHidden: false,
      DistanceMeters: 9000,
      EtaSeconds: 900,
      EtaSource: EtaSource.Road,
      TurnoutSeconds: 0,
      ResponseSeconds: 900,
      Crew: [],
      CrewCount: 0,
      CrewAvailableCount: 0,
      OnShiftCount: 0,
    },
  ],
  Personnel: [
    {
      UserId: 'u-taylor',
      Name: 'Taylor Brooks',
      GroupName: 'South',
      UnitId: 2,
      UnitName: 'MCT 2',
      StatusText: 'Available',
      StatusColor: '#2f9e44',
      StaffingText: 'On Shift',
      StaffingColor: '#1971c2',
      IsAvailable: true,
      IsOnShift: true,
      Roles: ['Peer Support Specialist'],
      Latitude: 39.51,
      Longitude: -119.79,
      LocationIsStale: false,
      LocationHidden: false,
      DistanceMeters: 1400,
      EtaSeconds: 240,
      EtaSource: EtaSource.Estimated,
    },
    {
      UserId: 'u-alex',
      Name: 'Alex Rivera',
      GroupName: 'Crisis Call Center',
      StatusText: 'Unavailable',
      StatusColor: '#868e96',
      StaffingText: 'Off Duty',
      IsAvailable: false,
      IsOnShift: false,
      Roles: ['Dispatcher'],
      LocationIsStale: false,
      LocationHidden: true,
      DistanceMeters: 5000,
      EtaSeconds: 600,
      EtaSource: EtaSource.Estimated,
    },
  ],
};

const mockFetchNearestBoard = jest.fn();
const mockToggleUnit = jest.fn();

const mockStore = {
  data: {
    users: [
      { Id: 'u-alex', Name: 'Alex Rivera', Status: 'Unavailable', StatusBaseType: 10, Staffing: 'Off Duty', GroupName: 'Crisis Call Center', Roles: ['Dispatcher'] },
      { Id: 'u-taylor', Name: 'Taylor Brooks', Status: 'Available', StatusBaseType: 0, Staffing: 'On Shift', GroupName: 'South', Roles: ['Peer Support Specialist'] },
      { Id: 'u-zed', Name: 'Zed Outsider', Status: 'Available', StatusBaseType: 0, Staffing: 'Available', GroupName: 'North', Roles: [] },
    ],
    groups: [],
    roles: [],
    units: [
      { Id: '1', Name: 'MCT 1', Status: 'On Scene', TypeName: 'Mobile Crisis Team', GroupName: 'Central', Crew: [] },
      { Id: '2', Name: 'MCT 2', Status: 'Available', TypeName: 'Mobile Crisis Team', GroupName: 'South', Crew: ['Taylor Brooks (Peer)'] },
    ],
  },
  selection: { everyone: false, users: [], groups: [], roles: [], units: [] },
  isLoading: false,
  error: null,
  loadFailures: { users: false, groups: false, roles: false, units: false },
  searchQuery: '',
  board,
  boardKey: '39.50000,-119.80000',
  isBoardLoading: false,
  boardError: false,
  fetchNearestBoard: mockFetchNearestBoard,
  fetchDispatchData: jest.fn(),
  setSelection: jest.fn(),
  toggleEveryone: jest.fn(),
  toggleUser: jest.fn(),
  toggleGroup: jest.fn(),
  toggleRole: jest.fn(),
  toggleUnit: mockToggleUnit,
  setSearchQuery: jest.fn(),
  clearSelection: jest.fn(),
};

jest.mock('@/stores/dispatch/store', () => ({
  useDispatchStore: () => mockStore,
  filterDispatchData: (data: any) => data,
  boardKeyFor: (latitude: number, longitude: number) => `${latitude.toFixed(5)},${longitude.toFixed(5)}`,
}));

jest.mock('@/components/runcards/use-add-resources-recommendation', () => ({
  useAddResourcesRecommendation: () => ({ isRunCardsEnabled: false, recommendation: null, isLoading: false, error: null, hasFetched: false, isApplied: false, refresh: jest.fn(), applyToSelection: (s: any) => s }),
}));

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'dark' }),
  cssInterop: jest.fn(),
}));

jest.mock('@/components/ui/actionsheet', () => {
  const { View } = require('react-native');
  return {
    Actionsheet: ({ isOpen, children }: any) => (isOpen ? <View testID="actionsheet">{children}</View> : null),
    ActionsheetBackdrop: () => null,
    ActionsheetContent: ({ children }: any) => <View>{children}</View>,
    ActionsheetDragIndicator: () => null,
    ActionsheetDragIndicatorWrapper: ({ children }: any) => <View>{children}</View>,
  };
});

(global as any).cssInterop = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
  }),
}));

const rowOrder = (prefix: string) =>
  screen
    .queryAllByTestId(new RegExp(`^${prefix}-row-`))
    .map((row) => row.props.testID.replace(`${prefix}-row-`, ''));

describe('DispatchSelectionModal with a call location', () => {
  beforeEach(() => {
    mockFetchNearestBoard.mockClear();
    mockToggleUnit.mockClear();
  });

  it('loads the nearest-unit board for the call location', () => {
    render(<DispatchSelectionModal isVisible onClose={jest.fn()} onConfirm={jest.fn()} callLocation={CALL} />);

    expect(mockFetchNearestBoard).toHaveBeenCalledWith(CALL.latitude, CALL.longitude);
    expect(screen.getByText('calls.dispatch_board.ranked_from_location')).toBeTruthy();
  });

  it('ranks personnel and units closest first, with the ones the board does not list after, by name', () => {
    render(<DispatchSelectionModal isVisible onClose={jest.fn()} onConfirm={jest.fn()} callLocation={CALL} />);

    expect(rowOrder('dispatch-user')).toEqual(['u-taylor', 'u-alex', 'u-zed']);
    expect(rowOrder('dispatch-unit')).toEqual(['2', '1']);
  });

  it('shows distance, ETA and a nearest badge on the closest available resources', () => {
    render(<DispatchSelectionModal isVisible onClose={jest.fn()} onConfirm={jest.fn()} callLocation={CALL} />);

    expect(screen.getByTestId('dispatch-unit-distance-2').props.children).toBe('1.4 km · ~4 min');
    expect(screen.getByTestId('dispatch-unit-distance-1').props.children).toBe('9.0 km · 15 min');
    expect(screen.getByTestId('dispatch-unit-nearest-2')).toBeTruthy();
    expect(screen.queryByTestId('dispatch-unit-nearest-1')).toBeNull();
    expect(screen.getByTestId('dispatch-user-nearest-u-taylor')).toBeTruthy();
    expect(screen.queryByTestId('dispatch-user-nearest-u-alex')).toBeNull();
  });

  it('shows status, staffing, group, roles, unit and crew', () => {
    render(<DispatchSelectionModal isVisible onClose={jest.fn()} onConfirm={jest.fn()} callLocation={CALL} />);

    expect(screen.getByTestId('dispatch-user-status-u-taylor')).toBeTruthy();
    expect(screen.getByText('On Shift')).toBeTruthy();
    expect(screen.getByTestId('dispatch-user-details-u-taylor').props.children).toContain('South');
    expect(screen.getByTestId('dispatch-user-details-u-taylor').props.children).toContain('Peer Support Specialist');
    expect(screen.getByTestId('dispatch-user-details-u-taylor').props.children).toContain('calls.dispatch_board.on_unit');
    expect(screen.getByTestId('dispatch-unit-crew-2').props.children).toContain('Taylor Brooks (Peer)');
    expect(screen.getByTestId('dispatch-unit-crew-1').props.children).toBe('calls.dispatch_board.no_crew');
  });

  it('says where a position is old or hidden', () => {
    render(<DispatchSelectionModal isVisible onClose={jest.fn()} onConfirm={jest.fn()} callLocation={CALL} />);

    expect(screen.getByTestId('dispatch-unit-position-1').props.children).toContain('calls.dispatch_board.location_stale');
    expect(screen.getByTestId('dispatch-user-position-u-alex').props.children).toBe('calls.dispatch_board.location_hidden');
  });

  it('hides what cannot go with "available only"', () => {
    render(<DispatchSelectionModal isVisible onClose={jest.fn()} onConfirm={jest.fn()} callLocation={CALL} />);

    fireEvent.press(screen.getByTestId('dispatch-available-only'));

    expect(rowOrder('dispatch-user')).toEqual(['u-taylor', 'u-zed']);
    expect(rowOrder('dispatch-unit')).toEqual(['2']);
  });

  it('sorts by name on request', () => {
    render(<DispatchSelectionModal isVisible onClose={jest.fn()} onConfirm={jest.fn()} callLocation={CALL} />);

    fireEvent.press(screen.getByTestId('dispatch-sort-name'));

    expect(rowOrder('dispatch-user')).toEqual(['u-alex', 'u-taylor', 'u-zed']);
  });

  it('marks the resources the run card recommends, alongside the nearest ranking', () => {
    const recommendation = { MatchedRunCardId: 'rc-1', Units: [{ UnitId: 1 }], Personnel: [{ UserId: 'u-alex' }], Shortfalls: [], MoveUps: [], Notes: [] } as any;
    render(<DispatchSelectionModal isVisible onClose={jest.fn()} onConfirm={jest.fn()} callLocation={CALL} recommendation={recommendation} />);

    expect(screen.getByTestId('dispatch-unit-runcard-1')).toBeTruthy();
    expect(screen.queryByTestId('dispatch-unit-runcard-2')).toBeNull();
    expect(screen.getByTestId('dispatch-user-runcard-u-alex')).toBeTruthy();
    // The ranking is still the board's: the recommended unit is not the closest.
    expect(rowOrder('dispatch-unit')).toEqual(['2', '1']);
  });

  it('without a location lists by name and asks for one', () => {
    render(<DispatchSelectionModal isVisible onClose={jest.fn()} onConfirm={jest.fn()} />);

    expect(mockFetchNearestBoard).not.toHaveBeenCalled();
    expect(screen.getByText('calls.dispatch_board.set_location_to_rank')).toBeTruthy();
    expect(rowOrder('dispatch-user')).toEqual(['u-alex', 'u-taylor', 'u-zed']);
    expect(screen.queryByTestId('dispatch-sort-closest')).toBeNull();
  });
});
