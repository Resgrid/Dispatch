import { VoiceState, initialState } from "../store/voice.store";
import { VoiceActionTypes, VoiceActionsUnion } from "../actions/voice.actions";

import * as _ from "lodash";
import { DepartmentVoiceChannelResultData } from "@resgrid/ngx-resgridlib";

export function reducer(
  state: VoiceState = initialState,
  action: VoiceActionsUnion
): VoiceState {
  switch (action.type) {
    case VoiceActionTypes.GET_VOIPINFO_SUCCESS:
      let channels: DepartmentVoiceChannelResultData[] = new Array();
      channels.push({
        Id: "",
        Name: "No Channel Selected",
        ConferenceNumber: 0,
        IsDefault: false,
        Token: "",
      });

      if (action && action.payload && action.payload.Channels) {
        channels.push(...action.payload.Channels);

        //channels.push({
        //  Name: 'Disconnect',
        //  ConferenceNumber: -1,
        //  IsDefault: false,
        //});
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
    case VoiceActionTypes.ADD_OPENVIDU_STREAM:
      var subs = _.cloneDeep(state.subscribers);
      subs.push(action.stream);

      return {
        ...state,
        subscribers: subs,
      };
    case VoiceActionTypes.REMOVE_OPENVIDU_STREAM:
      var subs = _.cloneDeep(state.subscribers);

      const index = subs.indexOf(action.stream, 0);
      if (index > -1) {
        subs.splice(index, 1);
      }

      return {
        ...state,
        subscribers: subs,
      };
    case VoiceActionTypes.SET_CURRENT_VOICE_STATE:
      return {
        ...state,
        currentVoipStatus: action.state,
      };
    case VoiceActionTypes.INCREMENT_PARTICIPANTS:
      return {
        ...state,
        participants: state.participants + 1,
      };
    case VoiceActionTypes.DECREMENT_PARTICIPANTS:
      return {
        ...state,
        participants: state.participants - 1,
      };
    default:
      return state;
  }
}

export const getAvailableChannels = (state: VoiceState) => state.channels;
