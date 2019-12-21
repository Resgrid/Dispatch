import { Action } from '@ngrx/store';
import { DashboardPayload } from '../models/dashboardPayload';

// [AUTH] Auth module
export enum HomeActionTypes {
  LOADING = '[HOME] LOADING',
  LOADING_SUCCESS = '[HOME] LOADING_SUCCESS',
  LOADING_FAIL = '[HOME] LOADING_FAIL'
}

export class Loading implements Action {
  readonly type = HomeActionTypes.LOADING;
  constructor(public payload: DashboardPayload) {}
}

export class LoadingSuccess implements Action {
  readonly type = HomeActionTypes.LOADING_SUCCESS;
  constructor(public payload: DashboardPayload) {}
}

export class LoadingFail implements Action {
  readonly type = HomeActionTypes.LOADING_FAIL;
  constructor(public payload: string) {}
}

export type HomeActionsUnion = Loading | LoadingSuccess | LoadingFail;
