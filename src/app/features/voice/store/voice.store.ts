import { DepartmentVoiceChannelResultData, DepartmentVoiceResultData } from '@resgrid/ngx-resgridlib';
import { StreamManager } from "openvidu-browser";

export interface VoiceState {
    isVoiceEnabled: boolean;
    isTransmitting: boolean;
    voipSystemInfo: DepartmentVoiceResultData;
    currentVoipStatus: string;
    currentActiveVoipChannel: DepartmentVoiceChannelResultData;
    channels: DepartmentVoiceChannelResultData[];
    subscribers: StreamManager[];
}

export const initialState: VoiceState = {
    isVoiceEnabled: false,
    isTransmitting: false,
    voipSystemInfo: null,
    currentVoipStatus: 'Disconnected',
    currentActiveVoipChannel: null,
    channels: null,
    subscribers: []
};