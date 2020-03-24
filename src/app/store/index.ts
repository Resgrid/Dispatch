import * as fromAuth from '../features/auth/reducers/auth.reducer';
import * as fromRoot from './reducers/index';
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AuthState } from '../features/auth/store/auth.store';
import { HomeState } from '../features/home/store/home.store';
import { MapState } from '../features/map/store/map.store';

export interface State extends fromRoot.State {
  auth: AuthState;
  home: HomeState;
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

export const selectMapState = createFeatureSelector<MapState>('mapModule');
