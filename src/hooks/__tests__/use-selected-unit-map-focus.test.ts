import { act, renderHook } from '@testing-library/react-native';

import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';
import { useDispatchConsoleStore } from '@/stores/dispatch/dispatch-console-store';
import { useUnitsStore } from '@/stores/units/store';

import { useSelectedUnitMapFocus } from '../use-selected-unit-map-focus';

jest.mock('@/api/units/units', () => ({ getUnitsInfos: jest.fn() }));
jest.mock('@/api/satuses', () => ({ getAllUnitStatuses: jest.fn() }));

const unit = (UnitId: string, Name: string, crew: string[]) =>
  ({
    UnitId,
    Name,
    Roles: [
      { RoleId: '1', RoleName: 'Officer', UserId: crew[0] ?? '', Name: '' },
      { RoleId: '2', RoleName: 'Driver', UserId: crew[1] ?? '', Name: '' },
    ],
  }) as unknown as UnitInfoResultData;

describe('useSelectedUnitMapFocus', () => {
  beforeEach(() => {
    act(() => {
      useDispatchConsoleStore.getState().setSelectedUnitId(null);
      useUnitsStore.setState({ units: [unit('12', 'Engine 12', ['ABC', 'def']), unit('13', 'Engine 13', [])] });
    });
  });

  it('is null until a unit is selected', () => {
    const { result } = renderHook(() => useSelectedUnitMapFocus());

    expect(result.current).toBeNull();
  });

  it('focuses the selected unit and its seated crew', () => {
    const { result } = renderHook(() => useSelectedUnitMapFocus());

    act(() => useDispatchConsoleStore.getState().setSelectedUnitId('12'));

    expect(result.current).toEqual({ key: 'unit:12', label: 'Engine 12', unitPinId: 'u12', crewPinIds: ['pabc', 'pdef'] });
  });

  it('keeps the same focus through a units refetch that changes nothing, and the selection with it', () => {
    const { result } = renderHook(() => useSelectedUnitMapFocus());
    act(() => useDispatchConsoleStore.getState().setSelectedUnitId('12'));
    const first = result.current;

    act(() => useUnitsStore.setState({ units: [unit('12', 'Engine 12', ['ABC', 'def']), unit('13', 'Engine 13', [])] }));

    expect(result.current).toBe(first);
    expect(useDispatchConsoleStore.getState().selectedUnitId).toBe('12');
  });

  it('follows a crew change from a refetch', () => {
    const { result } = renderHook(() => useSelectedUnitMapFocus());
    act(() => useDispatchConsoleStore.getState().setSelectedUnitId('12'));

    act(() => useUnitsStore.setState({ units: [unit('12', 'Engine 12', ['ghi']), unit('13', 'Engine 13', [])] }));

    expect(result.current?.crewPinIds).toEqual(['pghi']);
    expect(useDispatchConsoleStore.getState().selectedUnitId).toBe('12');
  });

  it('clears when the unit is deselected', () => {
    const { result } = renderHook(() => useSelectedUnitMapFocus());
    act(() => useDispatchConsoleStore.getState().setSelectedUnitId('12'));

    act(() => useDispatchConsoleStore.getState().setSelectedUnitId(null));

    expect(result.current).toBeNull();
  });
});
