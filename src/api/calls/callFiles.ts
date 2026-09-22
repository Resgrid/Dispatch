import axios, { type AxiosProgressEvent, type AxiosRequestConfig, type AxiosResponse } from 'axios';

import { createApiEndpoint } from '@/api/common/client';
import { getBaseApiUrl } from '@/lib/storage/app';
import { type CallFilesResult } from '@/models/v4/callFiles/callFilesResult';
import { type SaveCallFileResult } from '@/models/v4/callFiles/saveCallFileResult';
import useAuthStore from '@/stores/auth/store';

// Event types for the download process
export type DownloadEventType = 'start' | 'progress' | 'complete' | 'error';

// Interface for download progress events
export interface DownloadProgressEvent {
  type: DownloadEventType;
  progress?: number; // 0-100
  loaded?: number;
  total?: number;
  error?: Error;
  response?: AxiosResponse<Blob>;
}

// Interface for download options
export interface DownloadOptions {
  onEvent?: (event: DownloadProgressEvent) => void;
  headers?: Record<string, string>;
  timeout?: number;
  fileName?: string;
}

const getCallFilesApi = createApiEndpoint('/CallFiles/GetFilesForCall');
const saveCallFileApi = createApiEndpoint('/CallFiles/SaveCallFile');

// Function to download a file with progress reporting
/**
 * Whether `url` points at the department's own Resgrid API.
 *
 * Attachment URLs arrive inside the server payload, and not all of them are ours: a department on
 * external blob storage gets a pre-signed CDN link back. Those links carry their own credential in
 * the query string and need no bearer, so sending one would hand this member's access token to a
 * third-party host for nothing.
 */
const isApiOrigin = (url: string): boolean => {
  try {
    const target = new URL(url, getBaseApiUrl());
    const api = new URL(getBaseApiUrl());
    return target.origin === api.origin;
  } catch {
    // An unparseable URL is not a host we can vouch for.
    return false;
  }
};

export const getCallAttachmentFile = async (url: string, options: DownloadOptions = {}): Promise<Blob> => {
  const { onEvent, headers = {}, timeout = 30000 } = options;

  try {
    // Notify start event
    onEvent?.({
      type: 'start',
    });

    // Attach the signed-in bearer, but only for our own API origin: authenticated file routes
    // require it, the anonymous signed-link route simply ignores it, and an external storage or
    // CDN host must never see it. Caller-supplied headers win on conflict.
    const token = isApiOrigin(url) ? useAuthStore.getState().accessToken : null;
    const config: AxiosRequestConfig = {
      responseType: 'blob',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      timeout,
      onDownloadProgress: (progressEvent: AxiosProgressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);

          // Notify progress event
          onEvent?.({
            type: 'progress',
            progress: percentCompleted,
            loaded: progressEvent.loaded,
            total: progressEvent.total,
          });
        }
      },
    };

    const response = await axios.get<Blob>(url, config);

    // Notify complete event
    onEvent?.({
      type: 'complete',
      response,
    });

    return response.data;
  } catch (error) {
    // Notify error event
    onEvent?.({
      type: 'error',
      error: error instanceof Error ? error : new Error('Unknown error occurred'),
    });

    throw error;
  }
};

// Utility function to save a blob as a file
export const saveBlobAsFile = (blob: Blob, fileName: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();

  // Clean up
  window.URL.revokeObjectURL(url);
};

export const getFiles = async (callId: string, includeData: boolean, type: number) => {
  const response = await getCallFilesApi.get<CallFilesResult>({
    callId: callId,
    includeData: includeData,
    type: type,
  });
  return response.data;
};

export const getCallImages = async (callId: string, includeData: boolean) => {
  const response = await getCallFilesApi.get<CallFilesResult>({
    callId: callId,
    includeData: includeData,
    type: 2,
  });
  return response.data;
};

export const getCallFiles = async (callId: string, includeData: boolean) => {
  const response = await getCallFilesApi.get<CallFilesResult>({
    callId: callId,
    includeData: includeData,
    type: 3,
  });
  return response.data;
};

export const getCallAudio = async (callId: string, includeData: boolean) => {
  const response = await getCallFilesApi.get<CallFilesResult>({
    callId: callId,
    includeData: includeData,
    type: 1,
  });
  return response.data;
};

export const saveCallFile = async (callId: string, userId: string, note: string, name: string, latitude: number | null, longitude: number | null, file: string, type: number) => {
  let data = {
    CallId: callId,
    UserId: userId,
    Type: type,
    Name: name,
    Latitude: '',
    Longitude: '',
    Note: note,
    Data: file,
  };

  if (latitude && longitude) {
    data.Latitude = latitude?.toString();
    data.Longitude = longitude?.toString();
  }

  const response = await saveCallFileApi.post<SaveCallFileResult>({
    ...data,
  });
  return response.data;
};

export const saveCallImage = async (callId: string, userId: string, note: string, name: string, latitude: number | null, longitude: number | null, file: string) => {
  return saveCallFile(callId, userId, note, name, latitude, longitude, file, 2);
};

export const saveCallFileAttachment = async (callId: string, userId: string, note: string, name: string, latitude: number | null, longitude: number | null, file: string) => {
  return saveCallFile(callId, userId, note, name, latitude, longitude, file, 3);
};
