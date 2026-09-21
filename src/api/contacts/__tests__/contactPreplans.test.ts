import { createApiEndpoint } from '../../common/client';
import { deleteContactHazard, deleteContactPreplan, getContactHazards, getContactPreplan, saveContactHazard, saveContactPreplan } from '../contactPreplans';

jest.mock('../../common/client', () => {
  const get = jest.fn();
  const post = jest.fn();
  const del = jest.fn();
  return {
    createApiEndpoint: jest.fn(() => ({ get, post, delete: del })),
    __mockGet: get,
    __mockPost: post,
    __mockDelete: del,
  };
});

const {
  __mockGet: mockGet,
  __mockPost: mockPost,
  __mockDelete: mockDelete,
} = jest.requireMock('../../common/client') as { __mockGet: jest.Mock; __mockPost: jest.Mock; __mockDelete: jest.Mock };

// Endpoints are created at module load; capture them before beforeEach clears the mock.
const registeredPaths = (createApiEndpoint as jest.Mock).mock.calls.map((c) => c[0]);

describe('contactPreplans api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers the six v4 Contacts pre-plan endpoints', () => {
    expect(registeredPaths).toEqual(
      expect.arrayContaining([
        '/Contacts/GetContactPreplan',
        '/Contacts/SaveContactPreplan',
        '/Contacts/DeleteContactPreplan',
        '/Contacts/GetContactHazards',
        '/Contacts/SaveContactHazard',
        '/Contacts/DeleteContactHazard',
      ])
    );
  });

  it('getContactPreplan passes contactId and returns the body', async () => {
    const payload = { Data: { ContactPreplanId: 'p1', ContactId: 'c1', RedactedFields: ['contactpreplans.gatecode'] } };
    mockGet.mockResolvedValueOnce({ data: payload });

    await expect(getContactPreplan('c1')).resolves.toBe(payload);
    expect(mockGet).toHaveBeenCalledWith({ contactId: 'c1' }, undefined);
  });

  it('getContactPreplan forwards the abort signal', async () => {
    const controller = new AbortController();
    mockGet.mockResolvedValueOnce({ data: { Data: null } });

    await getContactPreplan('c1', controller.signal);

    expect(mockGet).toHaveBeenCalledWith({ contactId: 'c1' }, controller.signal);
  });

  it('saveContactPreplan posts the input as the body', async () => {
    const input = { ContactId: 'c1', ConstructionType: 2, RoofType: 1, OccupancyType: 3, HasOccupantsNeedingAssistance: false, TacticalSummary: 'Sprinklered', GateCode: '1234', HazmatOnSite: true };
    mockPost.mockResolvedValueOnce({ data: { Id: 'p1' } });

    await expect(saveContactPreplan(input)).resolves.toEqual({ Id: 'p1' });
    expect(mockPost).toHaveBeenCalledWith(input);
    expect(mockPost.mock.calls[0][0]).not.toBe(input); // spread copy, caller's object untouched
  });

  it('deleteContactPreplan sends contactId as a query parameter', async () => {
    mockDelete.mockResolvedValueOnce({ data: {} });

    await deleteContactPreplan('c1');

    expect(mockDelete).toHaveBeenCalledWith({ contactId: 'c1' });
  });

  it('getContactHazards passes contactId and returns the list body', async () => {
    const payload = { Data: [{ ContactPreplanHazardId: 'h1', Severity: 3, ShouldAlert: true }] };
    mockGet.mockResolvedValueOnce({ data: payload });

    await expect(getContactHazards('c1')).resolves.toBe(payload);
    expect(mockGet).toHaveBeenCalledWith({ contactId: 'c1' }, undefined);
  });

  it('saveContactHazard posts the hazard and deleteContactHazard sends the hazard id', async () => {
    const hazard = { ContactId: 'c1', ContactPreplanHazardId: 'h1', HazardType: 2, Severity: 4, Title: 'Propane tank', Description: '500 gal, NE corner', ShouldAlert: true };
    mockPost.mockResolvedValueOnce({ data: { Id: 'h1' } });
    mockDelete.mockResolvedValueOnce({ data: {} });

    await expect(saveContactHazard(hazard)).resolves.toEqual({ Id: 'h1' });
    expect(mockPost).toHaveBeenCalledWith(hazard);

    await deleteContactHazard('h1');
    expect(mockDelete).toHaveBeenCalledWith({ contactPreplanHazardId: 'h1' });
  });

  it('propagates transport errors', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network Error'));

    await expect(getContactPreplan('c1')).rejects.toThrow('Network Error');
  });
});
