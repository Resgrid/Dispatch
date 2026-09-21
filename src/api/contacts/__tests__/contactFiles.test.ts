import { getCallAttachmentFile } from '@/api/calls/callFiles';
import { type ContactFileResultData } from '@/models/v4/contactFiles/contactFilesResult';

import { createApiEndpoint } from '../../common/client';
import { deleteContactFile, getContactFileBase64, getContactFiles, uploadContactFile } from '../contactFiles';

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

jest.mock('@/api/calls/callFiles', () => ({
  getCallAttachmentFile: jest.fn(),
}));

const {
  __mockGet: mockGet,
  __mockPost: mockPost,
  __mockDelete: mockDelete,
} = jest.requireMock('../../common/client') as { __mockGet: jest.Mock; __mockPost: jest.Mock; __mockDelete: jest.Mock };

const mockGetCallAttachmentFile = getCallAttachmentFile as jest.MockedFunction<typeof getCallAttachmentFile>;

// Endpoints are created at module load; capture them before beforeEach clears the mock.
const registeredPaths = (createApiEndpoint as jest.Mock).mock.calls.map((c) => c[0]);

// Minimal FileReader: hands back a data URL for whatever blob it is given.
Object.defineProperty(global, 'FileReader', {
  writable: true,
  value: class MockFileReader {
    result: string | ArrayBuffer | null = null;
    onload: ((event: unknown) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    readAsDataURL(_blob: Blob) {
      this.result = 'data:application/pdf;base64,U0lHTkVE';
      this.onload?.({});
    }
  },
});

const makeFile = (overrides: Partial<ContactFileResultData> = {}): ContactFileResultData => ({
  IsProtected: false,
  RedactedFields: [],
  Id: '10',
  ContactId: 'c1',
  Type: 1,
  TypeName: 'PrePlan',
  Name: 'Pre-plan',
  FileName: 'preplan.pdf',
  Mime: 'application/pdf',
  Size: 1024,
  Url: 'https://api.example/api/v4/ContactFiles/GetFile?q=signed',
  Timestamp: '2026-09-07T00:00:00Z',
  ...overrides,
});

describe('contactFiles api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers the three v4 ContactFiles endpoints', () => {
    expect(registeredPaths).toEqual(expect.arrayContaining(['/ContactFiles/GetFilesForContact', '/ContactFiles/UploadContactFile', '/ContactFiles/DeleteContactFile']));
  });

  it('getContactFiles defaults to metadata only and omits type when not given', async () => {
    const payload = { Data: [makeFile()] };
    mockGet.mockResolvedValueOnce({ data: payload });

    await expect(getContactFiles('c1')).resolves.toBe(payload);
    expect(mockGet).toHaveBeenCalledWith({ contactId: 'c1', includeData: false }, undefined);
  });

  it('getContactFiles passes includeData, type and the abort signal', async () => {
    const controller = new AbortController();
    mockGet.mockResolvedValueOnce({ data: { Data: [] } });

    await getContactFiles('c1', true, 2, controller.signal);

    expect(mockGet).toHaveBeenCalledWith({ contactId: 'c1', includeData: true, type: 2 }, controller.signal);
  });

  it('uploadContactFile posts the input and deleteContactFile sends the id', async () => {
    const input = { ContactId: 'c1', Type: 3, Name: 'Front', FileName: 'front.jpg', Data: 'AAAA' };
    mockPost.mockResolvedValueOnce({ data: { Id: '11' } });
    mockDelete.mockResolvedValueOnce({ data: {} });

    await expect(uploadContactFile(input)).resolves.toEqual({ Id: '11' });
    expect(mockPost).toHaveBeenCalledWith(input);

    await deleteContactFile(11);
    expect(mockDelete).toHaveBeenCalledWith({ contactFileId: 11 });
  });

  describe('getContactFileBase64', () => {
    it('uses the signed Url when present and returns the bytes as base64', async () => {
      mockGetCallAttachmentFile.mockResolvedValueOnce(new Blob(['SIGNED']));
      const file = makeFile();

      await expect(getContactFileBase64(file)).resolves.toBe('U0lHTkVE');
      expect(mockGetCallAttachmentFile).toHaveBeenCalledWith(file.Url);
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('falls back to the includeData path for a protected file without a Url', async () => {
      const file = makeFile({ IsProtected: true, Url: null });
      mockGet.mockResolvedValueOnce({ data: { Data: [makeFile({ Id: '9', Data: 'zzzz' }), { ...file, Data: 'aGVsbG8=' }] } });

      await expect(getContactFileBase64(file)).resolves.toBe('aGVsbG8=');

      expect(mockGetCallAttachmentFile).not.toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalledWith({ contactId: 'c1', includeData: true, type: 1 }, undefined);
    });

    it('throws the server reason when the protected bytes are withheld', async () => {
      const file = makeFile({ IsProtected: true, Url: null });
      mockGet.mockResolvedValueOnce({ data: { Data: [{ ...file, Data: null, ProtectedReason: 'grant_required' }] } });

      await expect(getContactFileBase64(file)).rejects.toThrow('grant_required');
    });

    it('throws a generic reason when the file is missing from the response', async () => {
      const file = makeFile({ IsProtected: true, Url: null });
      mockGet.mockResolvedValueOnce({ data: { Data: [] } });

      await expect(getContactFileBase64(file)).rejects.toThrow('protected_access_denied');
    });
  });
});
