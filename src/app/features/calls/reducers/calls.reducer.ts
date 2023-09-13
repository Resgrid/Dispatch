import { initialState, CallsState } from "../store/calls.store";
import { CallsActionsUnion, CallsActionTypes } from "../actions/calls.actions";

import * as _ from "lodash";
import { CallLocalResult } from "src/app/core/models/callLocalResult";

export function reducer(state: CallsState = initialState, action: CallsActionsUnion): CallsState {
  switch (action.type) {
    case CallsActionTypes.GET_SCHEDULED_CALLS_SUCCESS:
      return {
        ...state,
        pendingScheduledCalls: action.payload as CallLocalResult[],
      };
    case CallsActionTypes.UPDATE_SELECTEDDISPATCHPERSON:
      var personnel = _.cloneDeep(state.personnelForGrid);

      personnel.forEach((person) => {
        if (person.UserId == action.userId) {
          person.Selected = action.checked;
        }
      });

      return {
        ...state,
        personnelForGrid: personnel,
      };
    case CallsActionTypes.UPDATE_SELECTEDDISPATCHGROUP:
      var groups = _.cloneDeep(state.groupsForGrid);

      groups.forEach((group) => {
        if (group.GroupId == action.groupId) {
          group.Selected = action.checked;
        }
      });

      return {
        ...state,
        groupsForGrid: groups,
      };
    case CallsActionTypes.UPDATE_SELECTEDDISPATCHROLE:
      var roles = _.cloneDeep(state.rolesForGrid);

      roles.forEach((role) => {
        if (role.RoleId == action.roleId) {
          role.Selected = action.checked;
        }
      });

      return {
        ...state,
        rolesForGrid: roles,
      };
    case CallsActionTypes.UPDATE_SELECTEDDISPATCHUNIT:
      var units = _.cloneDeep(state.unitStatuses);

      units.forEach((unit) => {
        if (unit.UnitId == action.unitId) {
          unit.SelectedForDispatch = action.checked;
        }
      });

      return {
        ...state,
        unitStatuses: units,
      };
    case CallsActionTypes.UPDATE_EDITCALLDATA_FROMHOME:
      return {
        ...state,
        unitStatuses: action.unitStatuses,
        rolesForGrid: action.rolesForGrid,
        groupsForGrid: action.groupsForGrid,
        personnelForGrid: action.personnelForGrid,
        mapData: action.mapData,
      };
    case CallsActionTypes.UPDATE_PERSONANDUNITS_DISTANCE:
      return {
        ...state,
        personnelForGrid: personnel,
        unitStatuses: units,
      };
    case CallsActionTypes.GET_CALL_BYID_SUCCESS:
      var units = _.cloneDeep(state.unitStatuses);
      var roles = _.cloneDeep(state.rolesForGrid);
      var groups = _.cloneDeep(state.groupsForGrid);
      var personnel = _.cloneDeep(state.personnelForGrid);

      if (action.data) {
        action.data.Dispatches.forEach((dispatch) => {
          if (dispatch.Type === "Group") {
            groups.forEach((group) => {
              if (group.GroupId === dispatch.GroupId) {
                group.Selected = true;
              } else {
                group.Selected = false;
              }
            });
          } else if (dispatch.Type === "Unit") {
            units.forEach((unit) => {
              if (unit.UnitId === dispatch.Id) {
                unit.SelectedForDispatch = true;
              } else {
                unit.Selected = false;
              }
            });
          } else if (dispatch.Type === "User") {
            personnel.forEach((person) => {
              if (person.UserId === dispatch.Id) {
                person.Selected = true;
              } else {
                person.Selected = false;
              }
            });
          } else if (dispatch.Type === "Role") {
            roles.forEach((role) => {
              if (role.RoleId == dispatch.Id) {
                role.Selected = true;
              } else {
                role.Selected = false;
              }
            });
          }
        });
      }

      return {
        ...state,
        callToEdit: action.call,
        callEditData: action.data,
        mapData: action.mapData,
        personnelForGrid: personnel,
        unitStatuses: units,
        rolesForGrid: roles,
        groupsForGrid: groups,
      };
    case CallsActionTypes.SHOW_CALLDISPATCHTIMEMODAL:
      return {
        ...state,
        callIdToUpdateDispatchTime: action.callId,
      };
    case CallsActionTypes.UPDATE_CALL_DISPATCHTIME_SUCCESS:
      return {
        ...state,
        isUpdatingDispatchTime: false,
        updatedDispatchTime: "",
      };
    case CallsActionTypes.UPDATE_CALL_DISPATCHTIME_FAIL:
      return {
        ...state,
        isUpdatingDispatchTime: false,
        updatedDispatchTime: "",
      };
    case CallsActionTypes.UPDATE_CALL_DISPATCHTIME_START:
      return {
        ...state,
        isUpdatingDispatchTime: true,
      };
    default:
      return state;
  }
}

export const getPendingScheduledCalls = (state: CallsState) => state.pendingScheduledCalls;
export const getEditCall = (state: CallsState) => state.callToEdit;
export const getEditCallData = (state: CallsState) => state.callEditData;
