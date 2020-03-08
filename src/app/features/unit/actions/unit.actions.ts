import { Action } from '@ngrx/store';
import { SetStatusPayload } from '../models/setStatusPayload';

// [UNIT] Unit module
export enum UnitActionTypes {
  SET_STATUS = '[UNIT] SET_STATUS',
  SET_STATUS_SUCCESS = '[UNIT] SET_STATUS_SUCCESS',
  SET_STATUS_FAIL = '[UNIT] SET_STATUS_FAIL'
}

export class SetStatus implements Action {
  readonly type = UnitActionTypes.SET_STATUS;
  constructor(public payload: SetStatusPayload) {}
}

export class SetStatusSuccess implements Action {
  readonly type = UnitActionTypes.SET_STATUS_SUCCESS;
  constructor() {}
}

export class SetStatusFail implements Action {
  readonly type = UnitActionTypes.SET_STATUS_FAIL;
  constructor() {}
}

export type UnitActionsUnion = SetStatus | SetStatusSuccess | SetStatusFail;
