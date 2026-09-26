import axios from 'axios';

import { getBaseApiUrl } from '@/lib/storage/app';
import { type GetConfigResult } from '@/models/v4/configs/getConfigResult';
import { type GetSystemConfigResult } from '@/models/v4/configs/getSystemConfigResult';

import { createApiEndpoint } from '../common';

// A custom server URL that doesn't answer shouldn't leave the server picker spinning.
const SYSTEM_CONFIG_TIMEOUT_MS = 10000;

const getConfigApi = createApiEndpoint('/Config/GetConfig');

export const getConfig = async (key: string) => {
  const response = await getConfigApi.get<GetConfigResult>({
    key: key,
  });
  return response.data;
};

// GetSystemConfig is anonymous and is needed on the login screen (to list the Resgrid hosted
// sites) before there is a session, so it bypasses the authenticated api client - that client
// refuses to send any request without an access token.
export const getSystemConfig = async (baseApiUrl: string = getBaseApiUrl()) => {
  const response = await axios.get<GetSystemConfigResult>(`${baseApiUrl}/Config/GetSystemConfig`, { timeout: SYSTEM_CONFIG_TIMEOUT_MS });
  return response.data;
};
