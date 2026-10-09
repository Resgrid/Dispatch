import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { useDispatchStore } from '@/stores/dispatch/store';

import { DispatchSelectionModal } from '../dispatch-selection-modal';

// The real dispatch store, fed by mocked endpoints: the picker must show what loads after it opened.
const mockGetUnits = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('@/api/units/units', () => ({ getUnits: (...args: any[]) => mockGetUnits(...args) }));
jest.mock('@/api/personnel/personnel', () => ({ getAllPersonnelInfos: jest.fn(async () => ({ Data: [] })) }));
jest.mock('@/api/groups/groups', () => ({ getAllGroups: jest.fn(async () => ({ Data: [] })) }));
jest.mock('@/api/messaging/messages', () => ({ getRecipients: jest.fn(async () => ({ Data: [] })) }));

const mockGetCallRecommendation = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('@/api/runcards/runcards', () => ({ getCallRecommendation: (...args: any[]) => mockGetCallRecommendation(...args) }));

let mockRunCardsEnabled = true;
jest.mock('@/stores/feature-flags/store', () => ({ useIsRunCardsEnabled: () => mockRunCardsEnabled }));

jest.mock('@/lib/logging', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() } }));

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const props = { isVisible: true, onClose: jest.fn(), onConfirm: jest.fn() };

const recommendation = (overrides: Record<string, unknown> = {}) => ({
  MatchedRunCardId: 5,
  MatchedRunCardName: 'Cardiac arrest',
  AlarmLevel: 1,
  ModeUsed: 2,
  AutoDispatch: false,
  Units: [{ UnitId: 22, UnitName: 'Ambulance Zottegem', SelectionReason: 3, LocationIsStale: false, SatisfiesRequirementId: 1 }],
  Personnel: [],
  Shortfalls: [],
  MoveUps: [],
  Notes: ["1 of 2 required 'Ambulance' unit(s) already on the call."],
  ...overrides,
});

describe('DispatchSelectionModal with live data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunCardsEnabled = true;
    useDispatchStore.setState({
      data: { users: [], groups: [], roles: [], units: [] },
      selection: { everyone: false, users: [], groups: [], roles: [], units: [] },
      searchQuery: '',
      isLoading: false,
      error: null,
    });
    mockGetUnits.mockResolvedValue({
      Data: [
        { UnitId: '22', Name: 'Ambulance Zottegem' },
        { UnitId: '23', Name: 'Ambulance Ninove' },
      ],
    });
    mockGetCallRecommendation.mockResolvedValue(null);
  });

  it('shows the units that load after the picker opened, not just Everyone', async () => {
    const { findByText, getByText } = render(<DispatchSelectionModal {...props} />);

    expect(await findByText('Ambulance Zottegem')).toBeTruthy();
    expect(getByText('Ambulance Ninove')).toBeTruthy();
    expect(getByText('calls.units (2)')).toBeTruthy();
  });

  it('filters the loaded units as the dispatcher types', async () => {
    const { findByText, queryByText, getByPlaceholderText } = render(<DispatchSelectionModal {...props} />);
    await findByText('Ambulance Ninove');

    fireEvent.changeText(getByPlaceholderText('common.search'), 'zotte');

    await waitFor(() => expect(queryByText('Ambulance Ninove')).toBeNull());
    expect(queryByText('Ambulance Zottegem')).toBeTruthy();
  });

  it('offers the run card recommendation for what the call still needs, and applying it selects those units and people', async () => {
    mockGetCallRecommendation.mockResolvedValue(recommendation({ Personnel: [{ UserId: '7', Name: 'A. Smith', SelectionReason: 3, LocationIsStale: false, SatisfiesRequirementId: 2 }] }));

    const { findByTestId, getByTestId } = render(<DispatchSelectionModal {...props} callId="40" />);

    expect(await findByTestId('add-resources-recommendation')).toBeTruthy();
    expect(mockGetCallRecommendation).toHaveBeenCalledWith('40', expect.anything());

    await act(async () => {
      fireEvent.press(getByTestId('add-resources-recommendation-apply'));
    });

    expect(useDispatchStore.getState().selection.units).toEqual(['22']);
    expect(useDispatchStore.getState().selection.users).toEqual(['7']);
    expect(useDispatchStore.getState().selection.everyone).toBe(false);
  });

  it('does not claim the recommended resources were auto-dispatched on a call already out', async () => {
    mockGetCallRecommendation.mockResolvedValue(recommendation({ AutoDispatch: true }));

    const { findByTestId, getByTestId, queryByTestId, queryByText } = render(<DispatchSelectionModal {...props} callId="40" />);

    expect(await findByTestId('add-resources-recommendation')).toBeTruthy();
    expect(getByTestId('add-resources-recommendation-apply')).toBeTruthy();
    expect(queryByTestId('add-resources-recommendation-auto')).toBeNull();
    expect(queryByText('run_cards.auto_dispatch_explainer')).toBeNull();
  });

  it('says so when the call already covers its run card', async () => {
    mockGetCallRecommendation.mockResolvedValue(recommendation({ Units: [], Notes: [] }));

    const { findByTestId, getByText } = render(<DispatchSelectionModal {...props} callId="40" />);

    expect(await findByTestId('add-resources-recommendation-covered')).toBeTruthy();
    expect(getByText('run_cards.covered_on_call')).toBeTruthy();
  });

  it('does not look up a recommendation for a new call or when run cards are off', async () => {
    const first = render(<DispatchSelectionModal {...props} />);
    await first.findByText('Ambulance Zottegem');
    first.unmount();

    mockRunCardsEnabled = false;
    const second = render(<DispatchSelectionModal {...props} callId="40" />);
    await second.findByText('Ambulance Zottegem');

    expect(mockGetCallRecommendation).not.toHaveBeenCalled();
    expect(second.queryByTestId('add-resources-recommendation')).toBeNull();
  });
});
