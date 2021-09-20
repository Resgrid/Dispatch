import { DepartmentVoiceChannelResult } from "src/app/core/models/departmentVoiceChannelResult";
import { DepartmentVoiceResult } from "src/app/core/models/departmentVoiceResult";

export interface VoiceState {
    isVoiceEnabled: boolean;
    isTransmitting: boolean;
    voipSystemInfo: DepartmentVoiceResult;
    currentVoipStatus: string;
    currentActiveVoipChannel: DepartmentVoiceChannelResult;
    channels: DepartmentVoiceChannelResult[];
}

export const initialState: VoiceState = {
    isVoiceEnabled: false,
    isTransmitting: false,
    voipSystemInfo: null,
    currentVoipStatus: 'Disconnected',
    currentActiveVoipChannel: null,
    channels: null
};