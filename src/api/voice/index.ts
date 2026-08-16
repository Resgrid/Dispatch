import { type CanConnectToVoiceSessionResult } from '@/models/v4/voice/canConnectToVoiceSessionResult';
import { type DepartmentAudioResult } from '@/models/v4/voice/departmentAudioResult';
import { type DepartmentVoiceResult } from '@/models/v4/voice/departmentVoiceResult';
import { type VoiceSessionConnectionResult } from '@/models/v4/voice/voiceSessionConnectionResult';

import { createCachedApiEndpoint } from '../common/cached-client';
import { createApiEndpoint } from '../common/client';

const getConnectToSessionApi = createApiEndpoint('/Voice/ConnectToSession');

const getCanConnectToVoiceSessionApi = createApiEndpoint('/Voice/CanConnectToVoiceSession');

//const getDepartmentVoiceSettingsApi = createCachedApiEndpoint('/Voice/GetDepartmentVoiceSettings', {
//  ttl: 15 * 60 * 1000, // Cache for 15 minutes -- operational data, must not go stale
//  enabled: true,
//});

const getDepartmentVoiceSettingsApi = createApiEndpoint('/Voice/GetDepartmentVoiceSettings');

const getDepartmentAudioStreamsApi = createCachedApiEndpoint('/Voice/GetDepartmentAudioStreams', {
  ttl: 15 * 60 * 1000, // Cache for 15 minutes -- operational data, must not go stale
  enabled: false,
});

export const getDepartmentVoiceSettings = async () => {
  const response = await getDepartmentVoiceSettingsApi.get<DepartmentVoiceResult>();
  return response.data;
};

export const getConnectToSession = async (sessionId: string) => {
  const response = await getConnectToSessionApi.get<VoiceSessionConnectionResult>({
    sessionId: sessionId,
  });
  return response.data;
};

export const getDepartmentAudioStreams = async () => {
  const response = await getDepartmentAudioStreamsApi.get<DepartmentAudioResult>();
  return response.data;
};

export const getCanConnectToVoiceSession = async (token: string) => {
  const response = await getCanConnectToVoiceSessionApi.get<CanConnectToVoiceSessionResult>({
    token: token,
  });
  return response.data;
};
