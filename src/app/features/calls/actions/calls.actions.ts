import { Action } from "@ngrx/store";
import { Call } from "src/app/core/models/call";
import { CallDataResult } from "src/app/core/models/callDataResult";
import { CallResult } from "src/app/core/models/callResult";
import { GpsLocation } from "src/app/core/models/gpsLocation";
import { GroupsForCallResult } from "src/app/core/models/groupsForCallResult";
import { PersonnelForCallResult } from "src/app/core/models/personnelForCallResult";
import { RolesForCallResult } from "src/app/core/models/rolesForCallResult";
import { UnitStatusFullResult } from "src/app/core/models/unitStatusFullResult";

export enum CallsActionTypes {
  GET_SCHEDULED_CALLS = "[CALLS] GET_SCHEDULED_CALLS",
  GET_SCHEDULED_CALLS_SUCCESS = "[CALLS] GET_SCHEDULED_CALLS_SUCCESS",
  GET_SCHEDULED_CALLS_FAIL = "[CALLS] GET_SCHEDULED_CALLS_FAIL",
  UPDATE_SELECTEDDISPATCHPERSON = "[CALLS] UPDATE_SELECTEDDISPATCHPERSON",
  UPDATE_SELECTEDDISPATCHGROUP = "[CALLS] UPDATE_SELECTEDDISPATCHGROUP",
  UPDATE_SELECTEDDISPATCHROLE = "[CALLS] UPDATE_SELECTEDDISPATCHROLE",
  UPDATE_SELECTEDDISPATCHUNIT = "[CALLS] UPDATE_SELECTEDDISPATCHUNIT",
  UPDATE_EDITCALLDATA_FROMHOME = "[CALLS] UPDATE_EDITCALLDATA_FROMHOME",
  GET_UPDATEDPERSONANDUNITS_DISTANCE = '[CALLS] GET_UPDATEDPERSONANDUNITS_DISTANCE',
  UPDATE_PERSONANDUNITS_DISTANCE = '[CALLS] UPDATE_PERSONANDUNITS_DISTANCE',
  GET_CALL_BYID = '[CALLS] GET_CALL_BYID',
  GET_CALL_BYID_SUCCESS = "[CALLS] GET_CALL_BYID_SUCCESS",
  GET_CALL_BYID_FAIL = "[CALLS] GET_CALL_BYID_FAIL",
  UPDATE_CALL = '[CALLS] UPDATE_CALL',
  UPDATE_CALL_SUCCESS = "[CALLS] UPDATE_CALL_SUCCESS",
  UPDATE_CALL_FAIL = "[CALLS] UPDATE_CALL_FAIL",
  SHOW_CALLDISPATCHTIMEMODAL = '[CALLS] SHOW_CALLDISPATCHTIMEMODAL',
  UPDATE_CALL_DISPATCHTIME = '[CALLS] UPDATE_CALL_DISPATCHTIME',
  UPDATE_CALL_DISPATCHTIME_SUCCESS = "[CALLS] UPDATE_CALL_DISPATCHTIME_SUCCESS",
  UPDATE_CALL_DISPATCHTIME_FAIL = "[CALLS] UPDATE_CALL_DISPATCHTIME_FAIL",
  UPDATE_CALL_DISPATCHTIME_START = '[CALLS] UPDATE_CALL_DISPATCHTIME_START',
}

export class GetScheduledCalls implements Action {
  readonly type = CallsActionTypes.GET_SCHEDULED_CALLS;
  constructor() {}
}

export class GetScheduledCallsSuccess implements Action {
  readonly type = CallsActionTypes.GET_SCHEDULED_CALLS_SUCCESS;
  constructor(public payload: CallResult[]) {}
}

export class GetScheduledCallsFail implements Action {
  readonly type = CallsActionTypes.GET_SCHEDULED_CALLS_FAIL;
  constructor() {}
}

export class UpdateSelectedDispatchPerson implements Action {
  readonly type = CallsActionTypes.UPDATE_SELECTEDDISPATCHPERSON;
  constructor(public userId: string, public checked: boolean) {}
}

export class UpdateSelectedDispatchGroup implements Action {
  readonly type = CallsActionTypes.UPDATE_SELECTEDDISPATCHGROUP;
  constructor(public groupId: number, public checked: boolean) {}
}

export class UpdateSelectedDispatchRole implements Action {
  readonly type = CallsActionTypes.UPDATE_SELECTEDDISPATCHROLE;
  constructor(public roleId: number, public checked: boolean) {}
}

export class UpdateSelectedDispatchRoleUnit implements Action {
  readonly type = CallsActionTypes.UPDATE_SELECTEDDISPATCHUNIT;
  constructor(public unitId: number, public checked: boolean) {}
}

export class UpdateEditCallDataFromHomeState implements Action {
  readonly type = CallsActionTypes.UPDATE_EDITCALLDATA_FROMHOME;
  constructor(public unitStatuses: UnitStatusFullResult[], public rolesForGrid: RolesForCallResult[], 
              public groupsForGrid: GroupsForCallResult[], public personnelForGrid: PersonnelForCallResult[]) {}
}

export class GetUpdatedPersonnelandUnitsDistancesToCall implements Action {
  readonly type = CallsActionTypes.GET_UPDATEDPERSONANDUNITS_DISTANCE;
  constructor(public callLocation: GpsLocation, public personnel: PersonnelForCallResult[], public units: UnitStatusFullResult[]) {}
}

export class UpdatePersonnelandUnitsDistancesToCall implements Action {
  readonly type = CallsActionTypes.UPDATE_PERSONANDUNITS_DISTANCE;
  constructor(public personnel: PersonnelForCallResult[], public units: UnitStatusFullResult[]) {}
}

export class GetCallById implements Action {
  readonly type = CallsActionTypes.GET_CALL_BYID;
  constructor(public callId: string) {}
}

export class GetCallByIdSuccess implements Action {
  readonly type = CallsActionTypes.GET_CALL_BYID_SUCCESS;
  constructor(public call: CallResult, public data: CallDataResult) {}
}

export class GetCallByIdFailure implements Action {
  readonly type = CallsActionTypes.GET_CALL_BYID_FAIL;
  constructor(public payload: string) {}
}

export class UpdateCall implements Action {
  readonly type = CallsActionTypes.UPDATE_CALL;
  constructor(public call: Call, public source: number) {}
}

export class UpdateCallSuccess implements Action {
  readonly type = CallsActionTypes.UPDATE_CALL_SUCCESS;
  constructor() {}
}

export class UpdateCallFail implements Action {
  readonly type = CallsActionTypes.UPDATE_CALL_FAIL;
  constructor(public payload: string) {}
}

export class UpdateCallDispatchTime implements Action {
  readonly type = CallsActionTypes.UPDATE_CALL_DISPATCHTIME;
  constructor(public callId: string, public date: string) {}
}

export class UpdateCallDispatchTimeSuccess implements Action {
  readonly type = CallsActionTypes.UPDATE_CALL_DISPATCHTIME_SUCCESS;
  constructor() {}
}

export class UpdateCallDispatchTimeFail implements Action {
  readonly type = CallsActionTypes.UPDATE_CALL_DISPATCHTIME_FAIL;
  constructor(public payload: string) {}
}

export class ShowUpdateCallDispatchTimeModal implements Action {
  readonly type = CallsActionTypes.SHOW_CALLDISPATCHTIMEMODAL;
  constructor(public callId: string) {}
}

export class IsUpdatingCallDispatchTime implements Action {
  readonly type = CallsActionTypes.UPDATE_CALL_DISPATCHTIME_START;
  constructor() {}
}

export type CallsActionsUnion =
  | GetScheduledCalls
  | GetScheduledCallsSuccess
  | GetScheduledCallsFail
  | UpdateSelectedDispatchPerson
  | UpdateSelectedDispatchGroup
  | UpdateSelectedDispatchRole
  | UpdateSelectedDispatchRoleUnit
  | UpdateEditCallDataFromHomeState
  | GetUpdatedPersonnelandUnitsDistancesToCall
  | UpdatePersonnelandUnitsDistancesToCall
  | GetCallById
  | GetCallByIdSuccess
  | GetCallByIdFailure
  | UpdateCallDispatchTime
  | UpdateCallDispatchTimeSuccess
  | UpdateCallDispatchTimeFail
  | ShowUpdateCallDispatchTimeModal
  | IsUpdatingCallDispatchTime;
