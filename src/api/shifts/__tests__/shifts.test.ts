interface MockEndpoint {
  get: jest.Mock;
  post: jest.Mock;
}

// The module under test creates its endpoints at import time, so the registry lives inside the mock factory.
jest.mock('../../common/client', () => {
  const endpoints: Record<string, { get: jest.Mock; post: jest.Mock }> = {};
  return {
    __endpoints: endpoints,
    createApiEndpoint: (path: string) => {
      const api = { get: jest.fn(), post: jest.fn() };
      endpoints[path] = api;
      return api;
    },
  };
});

import { getAllShifts, getShift, getShiftDay, getTodaysShifts, signupForShiftDay } from '../shifts';

const mockEndpoints: Record<string, MockEndpoint> = jest.requireMock('../../common/client').__endpoints;

const endpoint = (path: string) => {
  const api = mockEndpoints[path];
  if (!api) throw new Error(`endpoint ${path} was not created`);
  return api;
};

describe('shifts api', () => {
  beforeEach(() => {
    Object.values(mockEndpoints).forEach((api) => {
      api.get.mockReset().mockResolvedValue({ data: { Data: [] } });
      api.post.mockReset().mockResolvedValue({ data: { Id: '' } });
    });
  });

  it('only creates routes that exist on the v4 Shifts controller', () => {
    expect(Object.keys(mockEndpoints).sort()).toEqual(['/Shifts/GetShift', '/Shifts/GetShiftDay', '/Shifts/GetShifts', '/Shifts/GetTodaysShifts', '/Shifts/SignupForShiftDay']);
  });

  it('reads all shifts from GetShifts', async () => {
    await getAllShifts();

    expect(endpoint('/Shifts/GetShifts').get).toHaveBeenCalledWith();
  });

  it('sends the shift id as id', async () => {
    await getShift('7');

    expect(endpoint('/Shifts/GetShift').get).toHaveBeenCalledWith({ id: '7' });
  });

  it('sends the shift day id as id', async () => {
    await getShiftDay('12');

    expect(endpoint('/Shifts/GetShiftDay').get).toHaveBeenCalledWith({ id: '12' });
  });

  it("reads today's shift days", async () => {
    await getTodaysShifts();

    expect(endpoint('/Shifts/GetTodaysShifts').get).toHaveBeenCalledWith();
  });

  it('posts ShiftDaySignupInput with numeric ids', async () => {
    endpoint('/Shifts/SignupForShiftDay').post.mockResolvedValue({ data: { Id: '99' } });

    await expect(signupForShiftDay('12', '3')).resolves.toEqual({ Id: '99' });
    expect(endpoint('/Shifts/SignupForShiftDay').post).toHaveBeenCalledWith({ ShiftDayId: 12, GroupId: 3 });
  });
});
