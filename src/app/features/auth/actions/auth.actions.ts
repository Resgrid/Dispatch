import { Action } from "@ngrx/store";
import { LoginPayload } from "../models/loginPayload";
import { UserInfo } from "src/app/core/models/userInfo";

// [AUTH] Auth module
export enum LoginActionTypes {
  LOGIN = "[AUTH] LOGIN",
  LOGIN_SUCCESS = "[AUTH] LOGIN_SUCCESS",
  LOGIN_FAIL = "[AUTH] LOGIN_FAIL",
  IS_LOGIN = "[AUTH] IS_LOGIN",
  LOGIN_DONE = "[AUTH] LOGIN_DONE",
}

export class Login implements Action {
  readonly type = LoginActionTypes.LOGIN;
  constructor(public payload: LoginPayload) {}
}

export class LoginSuccess implements Action {
  readonly type = LoginActionTypes.LOGIN_SUCCESS;
  constructor(public user: UserInfo) {}
}

export class LoginFail implements Action {
  readonly type = LoginActionTypes.LOGIN_FAIL;
  constructor(public payload: string) {}
}

export class IsLogin implements Action {
  readonly type = LoginActionTypes.IS_LOGIN;
}

export class LoginDone implements Action {
  readonly type = LoginActionTypes.LOGIN_DONE;
}

export type LoginActionsUnion = Login | LoginSuccess | LoginFail | IsLogin | LoginDone;
