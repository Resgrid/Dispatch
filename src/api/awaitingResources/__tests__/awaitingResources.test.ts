import { dismissRequirement, dispatchUnitToAwaitingCall, getAwaitingCalls, getCallRequirements, getResponseCodes } from '../awaitingResources';

jest.mock('../../common/client', () => {
  const get = jest.fn();
  const post = jest.fn();
  // Records the endpoint path of every request, so a test can tell which API a call went to.
  const endpoint = jest.fn();
  return {
    createApiEndpoint: jest.fn((path: string) => ({
      get: (...args: unknown[]) => {
        endpoint(path);
        return get(...args);
      },
      post: (...args: unknown[]) => {
        endpoint(path);
        return post(...args);
      },
      put: jest.fn(),
      delete: jest.fn(),
    })),
    __mockGet: get,
    __mockPost: post,
    __mockEndpoint: endpoint,
  };
});

const { __mockGet: mockGet, __mockPost: mockPost, __mockEndpoint: mockEndpoint } = jest.requireMock('../../common/client') as { __mockGet: jest.Mock; __mockPost: jest.Mock; __mockEndpoint: jest.Mock };

describe('awaiting resources API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads the calls awaiting resources', async () => {
    const result = { Enabled: true, Data: [{ CallId: 7, Requirements: [] }] };
    mockGet.mockResolvedValue({ data: result });

    await expect(getAwaitingCalls()).resolves.toEqual(result);
    expect(mockEndpoint).toHaveBeenCalledWith('/AwaitingResources/GetAwaitingCalls');
    expect(mockGet).toHaveBeenCalledWith(expect.objectContaining({ _t: expect.any(Number) }), undefined);
  });

  it("reads a call's open requirements by call id", async () => {
    mockGet.mockResolvedValue({ data: { Data: [{ CallOutstandingRequirementId: 3 }] } });

    await expect(getCallRequirements('7')).resolves.toEqual([{ CallOutstandingRequirementId: 3 }]);
    expect(mockEndpoint).toHaveBeenCalledWith('/AwaitingResources/GetCallRequirements');
    expect(mockGet).toHaveBeenCalledWith(expect.objectContaining({ callId: '7' }), undefined);
  });

  it('answers an empty list when the server sends no data', async () => {
    mockGet.mockResolvedValue({ data: {} });

    await expect(getCallRequirements(7)).resolves.toEqual([]);
  });

  it('dismisses a requirement, sending the note only when there is one', async () => {
    mockPost.mockResolvedValue({ data: { Success: true, Resolved: 0 } });

    await dismissRequirement(7, 3, '  MUG cancelled by caller  ');
    await dismissRequirement(7, 4, '   ');

    expect(mockEndpoint).toHaveBeenCalledWith('/AwaitingResources/DismissRequirement');
    expect(mockPost).toHaveBeenNthCalledWith(1, { CallId: 7, RequirementId: 3, Note: 'MUG cancelled by caller' });
    expect(mockPost).toHaveBeenNthCalledWith(2, { CallId: 7, RequirementId: 4 });
  });

  it('dispatches a unit to a waiting call in one step', async () => {
    mockPost.mockResolvedValue({ data: { Success: true, Message: 'M-1 added', Resolved: 1 } });

    await expect(dispatchUnitToAwaitingCall(7, 41)).resolves.toEqual({ Success: true, Message: 'M-1 added', Resolved: 1 });
    expect(mockEndpoint).toHaveBeenCalledWith('/AwaitingResources/DispatchUnit');
    expect(mockPost).toHaveBeenCalledWith({ CallId: 7, UnitId: 41 });
  });

  it('reads the response code catalog, empty when the department has none', async () => {
    mockGet.mockResolvedValueOnce({ data: { Data: { Codes: [{ Id: 1, Code: 'C3' }], ShowToCrews: true } } });
    mockGet.mockResolvedValueOnce({ data: {} });

    await expect(getResponseCodes()).resolves.toEqual({ Codes: [{ Id: 1, Code: 'C3' }], ShowToCrews: true });
    await expect(getResponseCodes()).resolves.toEqual({ Codes: [], ShowToCrews: false });
    expect(mockEndpoint).toHaveBeenCalledWith('/AwaitingResources/GetResponseCodes');
  });
});
