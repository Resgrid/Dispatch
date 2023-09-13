import {
  CallExtraDataResultData,
  CallResultData,
  GetRolesForCallGridResultData,
  MapDataAndMarkersData,
  UnitStatusResultData,
} from "@resgrid/ngx-resgridlib";
import { CallLocalResult } from "src/app/core/models/callLocalResult";
import { GroupsForCallResult } from "src/app/core/models/groupsForCallResult";
import { PersonnelForCallResult } from "src/app/core/models/personnelForCallResult";
import { RolesForCallResult } from "src/app/core/models/rolesForCallResult";
import { UnitStatusResult } from "src/app/core/models/unitStatusResult";

export interface CallsState {
  pendingScheduledCalls: CallLocalResult[];

  // For Edit Call
  callToEdit: CallResultData;
  callEditData: CallExtraDataResultData;
  mapData: MapDataAndMarkersData;
  unitStatuses: UnitStatusResult[];
  rolesForGrid: RolesForCallResult[];
  groupsForGrid: GroupsForCallResult[];
  personnelForGrid: PersonnelForCallResult[];

  // For Update Dispatch Time
  callIdToUpdateDispatchTime: string;
  updatedDispatchTime: string;
  isUpdatingDispatchTime: boolean;
}

export const initialState: CallsState = {
  pendingScheduledCalls: null,
  unitStatuses: null,
  rolesForGrid: null,
  groupsForGrid: null,
  personnelForGrid: null,
  callToEdit: null,
  callEditData: null,
  mapData: null,
  callIdToUpdateDispatchTime: null,
  updatedDispatchTime: null,
  isUpdatingDispatchTime: false,
};
