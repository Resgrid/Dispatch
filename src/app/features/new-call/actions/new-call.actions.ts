import { Action } from '@ngrx/store';
import { MapResult } from 'src/app/models/mapResult';

export enum NewCallActionTypes {
  LOADING = '[NEW CALL] LOADING',
  LOADING_SUCCESS = '[NEW CALL] LOADING_SUCCESS',
  LOADING_FAIL = '[NEW CALL] LOADING_FAIL',
  CREATE = '[NEW CALL] CREATE',
  CREATE_SUCCESS = '[NEW CALL] CREATE_SUCCESS',
  CREATE_FAIL = '[NEW CALL] CREATE_FAIL',
  CREATE_DONE = '[NEW CALL] CREATE_DONE'
}

export class Loading implements Action {
  readonly type = NewCallActionTypes.LOADING;
  constructor() {}
}

export class LoadingSuccess implements Action {
  readonly type = NewCallActionTypes.LOADING_SUCCESS;
  constructor(public payload: MapResult) {}
}

export class LoadingFail implements Action {
  readonly type = NewCallActionTypes.LOADING_FAIL;
  constructor(public payload: string) {}
}

export type NewCallActionsUnion = Loading | LoadingSuccess | LoadingFail;
