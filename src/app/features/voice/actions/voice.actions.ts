import { Action } from '@ngrx/store';
import { DepartmentVoiceChannelResultData, DepartmentVoiceResultData } from '@resgrid-shared/ngx-resgridlib';
import { StreamManager } from 'openvidu-browser';

export enum VoiceActionTypes {
  GET_VOIPINFO = '[VOICE] GET_VOIPINFO',
  GET_VOIPINFO_SUCCESS = '[VOICE] GET_VOIPINFO_SUCCESS',
  GET_VOIPINFO_FAIL = '[VOICE] GET_VOIPINFO_FAIL',
  START_VOIP_SERVICES = '[VOICE] START_VOIP_SERVICES',
  VOIP_CALL_PROGRESS = '[VOICE] VOIP_CALL_PROGRESS',
  VOIP_CALL_FAILED = '[VOICE] VOIP_CALL_FAILED',
  VOIP_CALL_ENDED = '[VOICE] VOIP_CALL_ENDED',
  VOIP_CALL_CONNECTED = '[VOICE] VOIP_CALL_CONNECTED',
  VOIP_PHONE_CONNECTED = '[VOICE] VOIP_PHONE_CONNECTED',
  VOIP_PHONE_DISCONNECTED = '[VOICE] VOIP_PHONE_DISCONNECTED',
  VOIP_PHONE_NEWSESSION = '[VOICE] VOIP_PHONE_NEWSESSION',
  VOIP_PHONE_SIPREGISTERED = '[VOICE] VOIP_PHONE_SIPREGISTERED',
  VOIP_PHONE_SIPUNREGISTERED = '[VOICE] VOIP_PHONE_SIPUNREGISTERED',
  VOIP_PHONE_SIPREGISTERFAILED = '[VOICE] VOIP_PHONE_SIPREGISTERFAILED',
  START_TRANSMITTING = '[VOICE] START_TRANSMITTING',
  STOP_TRANSMITTING = '[VOICE] STOP_TRANSMITTING',
  SET_NOCHANNEL = '[VOICE] SET_NOCHANNEL',
  SET_ACTIVECHANNEL = '[VOICE] SET_ACTIVECHANNEL',
  VOIP_PHONE_DISCONNECT = '[VOICE] VOIP_PHONE_DISCONNECT',
  ADD_OPENVIDU_STREAM = '[VOICE] ADD_OPENVIDU_STREAM',
  REMOVE_OPENVIDU_STREAM = '[VOICE] REMOVE_OPENVIDU_STREAM',
  DONE = '[VOICE] DONE',
  SET_CURRENT_VOICE_STATE = '[VOICE] SET_CURRENT_VOICE_STATE',
}

export class GetVoipInfo implements Action {
  readonly type = VoiceActionTypes.GET_VOIPINFO;
  constructor() {}
}

export class GetVoipInfoSuccess implements Action {
  readonly type = VoiceActionTypes.GET_VOIPINFO_SUCCESS;
  constructor(public payload: DepartmentVoiceResultData) {}
}

export class GetVoipInfoFail implements Action {
  readonly type = VoiceActionTypes.GET_VOIPINFO_FAIL;
  constructor() {}
}

export class StartVoipServices implements Action {
  readonly type = VoiceActionTypes.START_VOIP_SERVICES;
  constructor(public payload: DepartmentVoiceResultData) {}
}

export class VoipCallProgress implements Action {
  readonly type = VoiceActionTypes.VOIP_CALL_PROGRESS;
  constructor() {}
}

export class VoipCallFailed implements Action {
  readonly type = VoiceActionTypes.VOIP_CALL_FAILED;
  constructor(public cause: string) {}
}

export class VoipCallEnded implements Action {
  readonly type = VoiceActionTypes.VOIP_CALL_ENDED;
  constructor(public cause: string) {}
}

export class VoipCallConnected implements Action {
  readonly type = VoiceActionTypes.VOIP_CALL_CONNECTED;
  constructor() {}
}

export class VoipPhoneConnected implements Action {
  readonly type = VoiceActionTypes.VOIP_PHONE_CONNECTED;
  constructor() {}
}

export class VoipPhoneDisconnected implements Action {
  readonly type = VoiceActionTypes.VOIP_PHONE_DISCONNECTED;
  constructor() {}
}

export class VoipPhoneSipRegistered implements Action {
  readonly type = VoiceActionTypes.VOIP_PHONE_SIPREGISTERED;
  constructor() {}
}

export class VoipPhoneSipUnregistered implements Action {
  readonly type = VoiceActionTypes.VOIP_PHONE_SIPUNREGISTERED;
  constructor() {}
}

export class VoipPhoneSipRegisterFailed implements Action {
  readonly type = VoiceActionTypes.VOIP_PHONE_SIPREGISTERFAILED;
  constructor() {}
}

export class VoipPhoneNewSession implements Action {
  readonly type = VoiceActionTypes.VOIP_PHONE_NEWSESSION;
  constructor() {}
}

export class StartTransmitting implements Action {
  readonly type = VoiceActionTypes.START_TRANSMITTING;
  constructor() {}
}

export class StopTransmitting implements Action {
  readonly type = VoiceActionTypes.STOP_TRANSMITTING;
  constructor() {}
}

export class SetNoChannel implements Action {
  readonly type = VoiceActionTypes.SET_NOCHANNEL;
  constructor() {}
}

export class SetActiveChannel implements Action {
  readonly type = VoiceActionTypes.SET_ACTIVECHANNEL;
  constructor(public channel: DepartmentVoiceChannelResultData) {}
}

export class DisconnectActiveCall implements Action {
  readonly type = VoiceActionTypes.VOIP_PHONE_DISCONNECT;
  constructor() {}
}

export class AddOpenViduStream implements Action {
  readonly type = VoiceActionTypes.ADD_OPENVIDU_STREAM;
  constructor(public stream: StreamManager) {}
}

export class RemoveOpenViduStream implements Action {
  readonly type = VoiceActionTypes.REMOVE_OPENVIDU_STREAM;
  constructor(public stream: StreamManager) {}
}

export class SetCurrentVoiceState implements Action {
  readonly type = VoiceActionTypes.SET_CURRENT_VOICE_STATE;
  constructor(public state: string) {}
}

export class Done implements Action {
  readonly type = VoiceActionTypes.DONE;
  constructor() {}
}

export type VoiceActionsUnion =
  | GetVoipInfo
  | GetVoipInfoSuccess
  | GetVoipInfoFail
  | VoipCallProgress
  | VoipCallFailed
  | VoipCallEnded
  | VoipCallConnected
  | VoipPhoneConnected
  | VoipPhoneDisconnected
  | VoipPhoneSipRegistered
  | VoipPhoneSipUnregistered
  | VoipPhoneSipRegisterFailed
  | VoipPhoneNewSession
  | StartTransmitting
  | StopTransmitting
  | SetNoChannel
  | SetActiveChannel
  | DisconnectActiveCall
  | StartVoipServices
  | AddOpenViduStream
  | RemoveOpenViduStream
  | SetCurrentVoiceState
  | Done;