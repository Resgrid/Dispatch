import * as fromAuth from '../features/auth/reducers/auth.reducer';
import * as homeReducers from '../features/home/reducers/home.reducer';
import * as voiceReducers from '../features/voice/reducers/voice.reducer';
import * as callsReducers from '../features/calls/reducers/calls.reducer';
import * as fromRoot from './reducers/index';
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AuthState } from '../features/auth/store/auth.store';
import { HomeState } from '../features/home/store/home.store';
import { VoiceState } from '../features/voice/store/voice.store';
import { CallsState } from '../features/calls/store/calls.store';
import { ProfileState } from '../features/profile/store/profile.store';
import { MappingState } from '../features/mapping/store/mapping.store';

export interface State extends fromRoot.State {
  auth: AuthState;
  home: HomeState;
  voice: VoiceState;
  calls: CallsState;
  profile: ProfileState;
}

export const selectAuthState = createFeatureSelector<AuthState>('authModule');

export const selectAuthStatusState = createSelector(
  selectAuthState,
  fromAuth.getLoginState
);

export const selectLoginState = createSelector(
  selectAuthState,
  fromAuth.getLoginStatus
);

export const selectIsLoginState = createSelector(
  selectAuthState,
  fromAuth.getIsLoginState
);




export const selectHomeState = createFeatureSelector<HomeState>('homeModule');

export const selectIsSavingUnitState = createSelector(
  selectHomeState,
  homeReducers.getIsSavingUnitStateStatus
);

export const selectIsSavingCloseCallState = createSelector(
  selectHomeState,
  homeReducers.getIsSavingCloseCallStatus
);

export const selectMapDataState = createSelector(
  selectHomeState,
  homeReducers.getMapData
);

export const selectActiveCallTemplateState = createSelector(
  selectHomeState,
  homeReducers.getCallTemplate
);

export const selectNewCallAddressState = createSelector(
  selectHomeState,
  homeReducers.getNewCallAddress
);

export const selectNewCallLocationState = createSelector(
  selectHomeState,
  homeReducers.getNewCallLocation
);

export const selectNewCallState = createSelector(
  selectHomeState,
  homeReducers.getNewCall
);

export const selectIsSavingCall = createSelector(
  selectHomeState,
  homeReducers.getIsSavingCall
);

export const selectConfigData = createSelector(
  selectHomeState,
  homeReducers.getConfigData
);


export const selectVoiceState = createFeatureSelector<VoiceState>('voiceModule');

export const selectAvailableChannelsState = createSelector(
  selectVoiceState,
  voiceReducers.getAvailableChannels
);


export const selectCallsState = createFeatureSelector<CallsState>('callsModule');

export const selectEditCallState = createSelector(
  selectCallsState,
  callsReducers.getEditCall
);

export const selectPendingCalls = createSelector(
  selectCallsState,
  callsReducers.getPendingScheduledCalls
);

export const selectEditCallData = createSelector(
  selectCallsState,
  callsReducers.getEditCallData
);



export const selectProfileState = createFeatureSelector<ProfileState>('profileModule');


export const selectMappingState = createFeatureSelector<MappingState>('mappingModule');