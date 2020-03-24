import { MapState, initialState } from '../store/map.store';
import { MapActionTypes, MapActionsUnion } from '../actions/map.actions';

export function reducer(state: MapState = initialState, action: MapActionsUnion): MapState {
  switch (action.type) {
    case MapActionTypes.LOADING:
      return {
        ...state,
        // user: action.payload
      };
    case MapActionTypes.LOADING_SUCCESS:
      return {
        ...state,
        hasLoaded: true,
        mapData: action.payload
      };
    case MapActionTypes.LOADING_FAIL:
      return {
        ...state,
        hasLoaded: false
      };
    default:
      return state;
  }
}

// export const getLoginState = (state: AuthState) => state.loggedIn;
// export const getLoginStatus = (state: AuthState) => state.errorMsg;
// export const getIsLoginState = (state: AuthState) => state.isLogging;

export const getHasLoadedState = (state: MapState) => state.hasLoaded;
