import { MapState, initialState } from '../store/map.store';
import { NewCallActionTypes, NewCallActionsUnion } from '../actions/new-call.actions';

export function reducer(state: MapState = initialState, action: NewCallActionsUnion): MapState {
  switch (action.type) {
    case NewCallActionTypes.LOADING:
      return {
        ...state,
        // user: action.payload
      };
    case NewCallActionTypes.LOADING_SUCCESS:
      return {
        ...state,
        hasLoaded: true,
        mapData: action.payload
      };
    case NewCallActionTypes.LOADING_FAIL:
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
