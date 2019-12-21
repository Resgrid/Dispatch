import { HomeState, initialState } from '../store/home.store';
import { HomeActionTypes, HomeActionsUnion } from '../actions/home.actions';

export function reducer(state: HomeState = initialState, action: HomeActionsUnion): HomeState {
  switch (action.type) {
    case HomeActionTypes.LOADING:
      return {
        ...state,
        // user: action.payload
      };
    case HomeActionTypes.LOADING_SUCCESS:
      return {
        ...state,
        hasLoaded: true,
        data: action.payload
      };
    case HomeActionTypes.LOADING_FAIL:
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

export const getHasLoadedState = (state: HomeState) => state.hasLoaded;
