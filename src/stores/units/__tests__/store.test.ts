import { getAllUnitStatuses } from '@/api/satuses';
import { getUnitsInfos } from '@/api/units/units';

import { useUnitsStore } from '../store';

jest.mock('@/api/units/units', () => ({
  getUnitsInfos: jest.fn(),
}));

jest.mock('@/api/satuses', () => ({
  getAllUnitStatuses: jest.fn(),
}));

const mockGetUnitsInfos = getUnitsInfos as jest.MockedFunction<typeof getUnitsInfos>;
const mockGetAllUnitStatuses = getAllUnitStatuses as jest.MockedFunction<typeof getAllUnitStatuses>;

const unit = (status: string) => ({ UnitId: 'u1', Name: 'Engine 1', CurrentStatus: status }) as never;
const unitsResult = (status: string) => ({ Data: [unit(status)] }) as never;

describe('useUnitsStore.fetchUnits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useUnitsStore.setState({ units: [], unitStatuses: [], isLoading: false, error: null });
    mockGetAllUnitStatuses.mockResolvedValue({ Data: [{ UnitType: 'Engine' }] } as never);
  });

  it('reads units from the server, bypassing the cached copy', async () => {
    mockGetUnitsInfos.mockResolvedValue(unitsResult('Available'));

    await useUnitsStore.getState().fetchUnits();

    expect(mockGetUnitsInfos).toHaveBeenCalledWith('', true);
    expect(mockGetAllUnitStatuses).toHaveBeenCalledTimes(1);
    expect(useUnitsStore.getState().units).toEqual([unit('Available')]);
    expect(useUnitsStore.getState().unitStatuses).toEqual([{ UnitType: 'Engine' }]);
    expect(useUnitsStore.getState().isLoading).toBe(false);
  });

  it('refetches once more when asked again mid-request, so a status saved meanwhile lands', async () => {
    let releaseFirst!: () => void;
    mockGetUnitsInfos
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst = () => resolve(unitsResult('Dispatched'));
          })
      )
      .mockResolvedValueOnce(unitsResult('Enroute'));

    const mount = useUnitsStore.getState().fetchUnits();
    // The unitStatusUpdated push for a status saved after the first request left, plus a panel
    // refreshing at the same time: both share one trailing refetch.
    const push = useUnitsStore.getState().fetchUnits();
    const panel = useUnitsStore.getState().fetchUnits();

    releaseFirst();
    await Promise.all([mount, push, panel]);

    expect(mockGetUnitsInfos).toHaveBeenCalledTimes(2);
    expect(useUnitsStore.getState().units).toEqual([unit('Enroute')]);
  });

  it('reports a failure and still refetches on the next call', async () => {
    mockGetUnitsInfos.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(unitsResult('Available'));

    await useUnitsStore.getState().fetchUnits();
    expect(useUnitsStore.getState().error).toBe('Failed to fetch units');
    expect(useUnitsStore.getState().isLoading).toBe(false);

    await useUnitsStore.getState().fetchUnits();
    expect(mockGetUnitsInfos).toHaveBeenCalledTimes(2);
    expect(useUnitsStore.getState().error).toBeNull();
    expect(useUnitsStore.getState().units).toEqual([unit('Available')]);
  });
});
