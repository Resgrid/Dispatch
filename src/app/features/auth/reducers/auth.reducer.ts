import { LoginActionsUnion, LoginActionTypes } from "../actions/auth.actions";
import { AuthState, initialState } from "../store/auth.store";

export function reducer(state: AuthState = initialState, action: LoginActionsUnion): AuthState {
  switch (action.type) {
    case LoginActionTypes.LOGIN:
      return {
        ...state,
        // user: action.payload
      };
    case LoginActionTypes.LOGIN_SUCCESS:
      return {
        ...state,
        isLogging: false,
        loggedIn: true,
        user: action.user,
      };
    case LoginActionTypes.LOGIN_FAIL:
      return {
        ...state,
        errorMsg: "Invalid user credentials",
        isLogging: false,
      };
    case LoginActionTypes.IS_LOGIN:
      return {
        ...state,
        isLogging: true,
      };
    case LoginActionTypes.LOGIN_DONE:
      return {
        ...state,
        isLogging: false,
      };
    default:
      return state;
  }
}

export const getLoginState = (state: AuthState) => state.loggedIn;
export const getLoginStatus = (state: AuthState) => state.errorMsg;
export const getIsLoginState = (state: AuthState) => state.isLogging;
