import { getCallAttachmentFile } from '@/api/calls/callFiles';
import { type ContactFileResultData, type ContactFilesResult, type DeleteContactFileResult, type UploadContactFileInput, type UploadContactFileResult } from '@/models/v4/contactFiles/contactFilesResult';

import { createApiEndpoint } from '../common/client';

// v4 ContactFiles (Contacts plan Phase A, A5): site documents, pre-plans, floor plans, photos and
// drawings attached to a contact. Metadata lists carry a signed anonymous Url; a protected department's
// enveloped file has no Url and is fetched with includeData under the caller's grant instead.

const getContactFilesApi = createApiEndpoint('/ContactFiles/GetFilesForContact');
const uploadContactFileApi = createApiEndpoint('/ContactFiles/UploadContactFile');
const deleteContactFileApi = createApiEndpoint('/ContactFiles/DeleteContactFile');

export const getContactFiles = async (contactId: string, includeData = false, type?: number | null, signal?: AbortSignal) => {
  const params: Record<string, unknown> = { contactId, includeData };
  if (type !== undefined && type !== null) {
    params.type = type;
  }
  const response = await getContactFilesApi.get<ContactFilesResult>(params, signal);
  return response.data;
};

export const uploadContactFile = async (input: UploadContactFileInput) => {
  const response = await uploadContactFileApi.post<UploadContactFileResult>({ ...input });
  return response.data;
};

export const deleteContactFile = async (contactFileId: number) => {
  const response = await deleteContactFileApi.delete<DeleteContactFileResult>({ contactFileId });
  return response.data;
};

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

/**
 * Downloads a contact file's bytes as base64 (ready for expo-file-system). The signed Url is the fast
 * path; when the file is protected (no Url), the bytes come from GetFilesForContact with includeData,
 * which the server decrypts under the caller's grant — or refuses, in which case this throws rather than
 * returning ciphertext. Base64 rather than Blob because React Native cannot build a Blob from bytes.
 */
export const getContactFileBase64 = async (file: ContactFileResultData): Promise<string> => {
  if (file.Url) {
    return blobToBase64(await getCallAttachmentFile(file.Url));
  }

  const result = await getContactFiles(file.ContactId, true, file.Type);
  const match = result.Data?.find((f) => f.Id === file.Id);
  if (!match?.Data) {
    throw new Error(match?.ProtectedReason || 'protected_access_denied');
  }

  return match.Data;
};
