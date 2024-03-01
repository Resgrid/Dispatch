import { HomeState, initialState } from "../store/home.store";
import { HomeActionTypes, HomeActionsUnion } from "../actions/home.actions";

import * as _ from "lodash";
import { CallResultData, GpsLocation } from "@resgrid/ngx-resgridlib";
import { UnitStatusResult } from "src/app/core/models/unitStatusResult";
import { PersonnelForCallResult } from "src/app/core/models/personnelForCallResult";
import { GroupsForCallResult } from "src/app/core/models/groupsForCallResult";
import { RolesForCallResult } from "src/app/core/models/rolesForCallResult";
import { CallLocalResult } from "src/app/core/models/callLocalResult";
import { createSelector } from "@ngrx/store";

export function reducer(state: HomeState = initialState, action: HomeActionsUnion): HomeState {
  switch (action.type) {
    case HomeActionTypes.LOADING:
      return {
        ...state,
        // user: action.payload
      };
    case HomeActionTypes.LOADING_SUCCESS:
      let people = _.cloneDeep(action.payload.PersonnelForGrid);
      people.forEach((p) => {
        if (!p.Group || p.Group === "") p.Group = "No Group";
      });

      return {
        ...state,
        hasLoaded: true,
        unitStatuses: action.payload.UnitStatuses as UnitStatusResult[],
        calls: action.payload.Calls as CallLocalResult[],
        callPriorties: action.payload.CallPriorties,
        callTypes: action.payload.CallTypes,
        personnelForGrid: people as PersonnelForCallResult[],
        groupsForGrid: action.payload.GroupsForGrid as GroupsForCallResult[],
        rolesForGrid: action.payload.RolesForGrid as RolesForCallResult[],
        newCallForm: action.payload.NewCallForm,
        personnelStatuses: action.payload.PersonnelStatuses,
        personnelStaffing: action.payload.PersonnelStaffingLevels,
        dispatchNote: action.payload.DispatchNote,
        callNoteTemplates: action.payload.CallNotes,
        config: action.payload.Config,
        rights: action.payload.Rights,
      };

    case HomeActionTypes.LOADING_FAIL:
      return {
        ...state,
        hasLoaded: false,
      };
    case HomeActionTypes.LOADING_MAP:
      return {
        ...state,
      };
    case HomeActionTypes.LOADING_MAP_SUCCESS:
      return {
        ...state,
        mapData: action.payload,
      };
    case HomeActionTypes.LOADING_MAP_FAIL:
      return {
        ...state,
      };
    case HomeActionTypes.OPEN_SETUNITSTATUSMODAL:
      return {
        ...state,
        setUnitStatusModalState: action.payload,
      };
    case HomeActionTypes.UPDATE_UNITSTATES:
      return {
        ...state,
        unitStatuses: action.payload as UnitStatusResult[],
      };
    case HomeActionTypes.UPDATE_SELECTUNIT:
      let units = _.cloneDeep(state.unitStatuses);

      units.forEach((unit) => {
        if (unit.UnitId == action.unitId) {
          unit.Selected = action.checked;
        } else {
          unit.Selected = false;
        }
      });

      return {
        ...state,
        unitStatuses: units,
      };
    case HomeActionTypes.UPDATE_SELECTPERSON:
      let peopleSelect = _.cloneDeep(state.personnelForGrid);

      peopleSelect.forEach((person) => {
        if (person.UserId == action.userId) {
          person.Selected = action.checked;
        }
      });

      return {
        ...state,
        personnelForGrid: peopleSelect,
      };
    case HomeActionTypes.UPDATE_SELECTEDCALL:
      let calls = _.cloneDeep(state.calls);

      calls.forEach((call) => {
        if (call.CallId == action.callId) {
          call.Selected = action.checked;
        } else {
          call.Selected = false;
        }
      });

      return {
        ...state,
        calls: calls,
      };
    case HomeActionTypes.UPDATE_CALLS:
      return {
        ...state,
        calls: action.payload as CallLocalResult[],
      };
    case HomeActionTypes.UPDATE_SELECTEDDISPATCHPERSON:
      let personnel = _.cloneDeep(state.personnelForGrid);

      personnel.forEach((person) => {
        if (person.UserId == action.userId) {
          person.Selected = action.checked;
        }
      });

      return {
        ...state,
        personnelForGrid: personnel,
      };
    case HomeActionTypes.UPDATE_SELECTEDDISPATCHGROUP:
      let groups = _.cloneDeep(state.groupsForGrid);

      groups.forEach((group) => {
        if (group.GroupId == action.groupId) {
          group.Selected = action.checked;
        }
      });

      return {
        ...state,
        groupsForGrid: groups,
      };
    case HomeActionTypes.UPDATE_SELECTEDDISPATCHROLE:
      let roles = _.cloneDeep(state.rolesForGrid);

      roles.forEach((role) => {
        if (role.RoleId == action.roleId) {
          role.Selected = action.checked;
        }
      });

      return {
        ...state,
        rolesForGrid: roles,
      };
    case HomeActionTypes.UPDATE_SELECTEDDISPATCHUNIT:
      let dispatchUnits = _.cloneDeep(state.unitStatuses);

      dispatchUnits.forEach((unit) => {
        if (unit.UnitId == action.unitId) {
          unit.SelectedForDispatch = action.checked;
        }
      });

      return {
        ...state,
        unitStatuses: dispatchUnits,
      };
    case HomeActionTypes.UPDATE_NEWCALLLOCATION:
      const newCallLocation = new GpsLocation(action.latitude, action.longitude);
      return {
        ...state,
        newCallLocation: newCallLocation,
      };
    case HomeActionTypes.OPEN_SELECTCALLTEMPLATEMODAL:
      return {
        ...state,
        callTemplates: action.payload,
      };
    case HomeActionTypes.UPDATE_APPLYCALLTEMPLATE:
      return {
        ...state,
        activeCallTemplate: action.payload,
      };
    case HomeActionTypes.GET_COORDINATESFORADDRESS_SUCCESS:
      return {
        ...state,
        newCallLocation: action.payload,
      };
    case HomeActionTypes.GET_ADDRESSFORCOORDINATES_SUCCESS:
      return {
        ...state,
        newCallAddress: action.address,
      };
    case HomeActionTypes.SAVE_CALL_START:
      return {
        ...state,
        isSavingCall: true,
      };
    case HomeActionTypes.SAVE_CALL_SUCCESS:
      let unitsReset = _.cloneDeep(state.unitStatuses);
      unitsReset.forEach((unit) => {
        unit.SelectedForDispatch = false;
      });

      let rolesReset = _.cloneDeep(state.rolesForGrid);
      rolesReset.forEach((role) => {
        role.Selected = false;
      });

      let groupsReset = _.cloneDeep(state.groupsForGrid);
      groupsReset.forEach((group) => {
        group.Selected = false;
      });

      let personnelReset = _.cloneDeep(state.personnelForGrid);
      personnelReset.forEach((person) => {
        person.Selected = false;
      });

      return {
        ...state,
        newCall: new CallResultData(),
        unitStatuses: unitsReset,
        rolesForGrid: rolesReset,
        groupsForGrid: groupsReset,
        personnelForGrid: personnelReset,
        isSavingCall: false,
      };
    case HomeActionTypes.SAVE_CALL_FAIL:
      return {
        ...state,
        isSavingCall: false,
      };
    case HomeActionTypes.UPDATE_PERSONNELDATA:
      return {
        ...state,
        personnelForGrid: action.payload,
      };
    case HomeActionTypes.OPEN_CALLNOTESMODAL:
      return {
        ...state,
        callNotes: action.payload,
      };
    case HomeActionTypes.OPEN_CALLIMAGESMODAL:
      return {
        ...state,
        callImages: action.payload,
      };
    case HomeActionTypes.OPEN_CALLFILESMODAL:
      return {
        ...state,
        callFiles: action.payload,
      };
    case HomeActionTypes.UPDATE_PERSONANDUNITS_DISTANCE:
      return {
        ...state,
        personnelForGrid: action.personnel,
        unitStatuses: action.units,
      };
    case HomeActionTypes.SET_NEWCALLFORMDATA:
      return {
        ...state,
        newCallFormData: action.formData,
      };
    case HomeActionTypes.UPDATE_PERSONSTATUSES:
      let personnelForUpdate = _.cloneDeep(action.payload);
      personnelForUpdate.forEach((person) => {
        person.Selected = false;
      });

      return {
        ...state,
        personnelForGrid: personnelForUpdate,
      };
    case HomeActionTypes.UPDATE_PERSONSTAFFING:
      let personnelForStaffingUpdate = _.cloneDeep(action.payload);
      personnelForStaffingUpdate.forEach((person) => {
        person.Selected = false;
      });

      return {
        ...state,
        personnelForGrid: personnelForStaffingUpdate,
      };
    case HomeActionTypes.OPEN_VIEW_CALL_FORM:
      return {
        ...state,
        viewCallExtraData: action.payload,
      };
    default:
      return state;
  }
}

// export const getLoginState = (state: AuthState) => state.loggedIn;
// export const getLoginStatus = (state: AuthState) => state.errorMsg;
// export const getIsLoginState = (state: AuthState) => state.isLogging;

export const getHasLoadedState = (state: HomeState) => state.hasLoaded;
export const getIsSavingUnitStateStatus = (state: HomeState) => state.isSavingUnitState;
export const getIsSavingCloseCallStatus = (state: HomeState) => state.isSavingCloseCall;
export const getMapData = (state: HomeState) => state.mapData;
export const getNewCall = (state: HomeState) => state.newCall;
export const getCallTemplate = (state: HomeState) => state.activeCallTemplate;
export const getNewCallAddress = (state: HomeState) => state.newCallLocation;
export const getIsSavingCall = (state: HomeState) => state.isSavingCall;
export const getNewCallLocation = (state: HomeState) => state.newCallAddress;
export const getConfigData = (state: HomeState) => state.config;
