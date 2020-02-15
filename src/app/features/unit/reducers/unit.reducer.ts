import { UnitState, initialState } from '../store/unit.store';
import { UnitActionTypes, UnitActionsUnion } from '../actions/unit.actions';

export function reducer(state: UnitState = initialState, action: UnitActionsUnion): UnitState {
  switch (action.type) {
    case UnitActionTypes.SET_STATUS:
      return {
        ...state,
        // user: action.payload
      };
    case UnitActionTypes.SET_STATUS_SUCCESS:
      return {
        ...state,
        hasLoaded: true//,
        //data: action.payload
      };
    case UnitActionTypes.SET_STATUS_FAIL:
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

// export const getHasLoadedState = (state: UnitState) => state.hasLoaded;
