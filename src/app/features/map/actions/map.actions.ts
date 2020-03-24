import { Action } from '@ngrx/store';
import { MapResult } from 'src/app/models/mapResult';

export enum MapActionTypes {
  LOADING = '[MAP] LOADING',
  LOADING_SUCCESS = '[MAP] LOADING_SUCCESS',
  LOADING_FAIL = '[MAP] LOADING_FAIL'
}

export class Loading implements Action {
  readonly type = MapActionTypes.LOADING;
  constructor() {}
}

export class LoadingSuccess implements Action {
  readonly type = MapActionTypes.LOADING_SUCCESS;
  constructor(public payload: MapResult) {}
}

export class LoadingFail implements Action {
  readonly type = MapActionTypes.LOADING_FAIL;
  constructor(public payload: string) {}
}

export type MapActionsUnion = Loading | LoadingSuccess | LoadingFail;
