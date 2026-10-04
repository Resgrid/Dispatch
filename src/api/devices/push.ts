import { type PushRegistrationInput } from '@/models/v4/device/pushRegistrationInput';
import { type PushRegistrationResult } from '@/models/v4/device/pushRegistrationResult';
import { type WebPushUnRegistrationInput } from '@/models/v4/device/webPushUnRegistrationInput';

import { createApiEndpoint } from '../common/client';

const registerDeviceApi = createApiEndpoint('/Devices/RegisterDevice');
const unRegisterWebPushApi = createApiEndpoint('/Devices/UnRegisterWebPush');

/** Dispatch registers the dispatcher's own devices, on the same user subscriber its notification inbox reads. */
export const registerDevice = async (data: PushRegistrationInput) => {
  const response = await registerDeviceApi.post<PushRegistrationResult>({
    ...data,
  });
  return response.data;
};

export const unRegisterWebPush = async (data: WebPushUnRegistrationInput) => {
  const response = await unRegisterWebPushApi.post<PushRegistrationResult>({
    ...data,
  });
  return response.data;
};
