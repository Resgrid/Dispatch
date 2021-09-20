import { VoiceState, initialState } from "../store/voice.store";
import { VoiceActionTypes, VoiceActionsUnion } from "../actions/voice.actions";

import * as _ from "lodash";
import { DepartmentVoiceChannelResult } from "src/app/core/models/departmentVoiceChannelResult";

export function reducer(
  state: VoiceState = initialState,
  action: VoiceActionsUnion
): VoiceState {
  switch (action.type) {
    case VoiceActionTypes.GET_VOIPINFO_SUCCESS:
      let channels: DepartmentVoiceChannelResult[] = new Array();
      channels.push({
        Name: "No Channel Selected",
        ConferenceNumber: 0,
        IsDefault: false,
      });

      if (action && action.payload && action.payload.Channels) {
        channels.push(...action.payload.Channels);
      }

      return {
        ...state,
        isVoiceEnabled: action.payload.VoiceEnabled,
        voipSystemInfo: action.payload,
        channels: channels,
      };
    case VoiceActionTypes.START_TRANSMITTING:
      return {
        ...state,
        isTransmitting: true,
      };
    case VoiceActionTypes.STOP_TRANSMITTING:
      return {
        ...state,
        isTransmitting: false,
      };
    case VoiceActionTypes.SET_NOCHANNEL:
      return {
        ...state,
        currentActiveVoipChannel: null,
      };
      case VoiceActionTypes.SET_ACTIVECHANNEL:
      return {
        ...state,
        currentActiveVoipChannel: action.channel,
      };
    default:
      return state;
  }
}


export const getAvailableChannels = (state: VoiceState) => state.channels;