import { CallDataResult } from "src/app/core/models/callDataResult";
import { CallResult } from "src/app/core/models/callResult";
import { GroupsForCallResult } from "src/app/core/models/groupsForCallResult";
import { PersonnelForCallResult } from "src/app/core/models/personnelForCallResult";
import { RolesForCallResult } from "src/app/core/models/rolesForCallResult";
import { UnitStatusFullResult } from "src/app/core/models/unitStatusFullResult";

export interface CallsState {
    pendingScheduledCalls: CallResult[];

    // For Edit Call
    callToEdit: CallResult;
    callEditData: CallDataResult;
    unitStatuses: UnitStatusFullResult[];
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
    callIdToUpdateDispatchTime: null,
    updatedDispatchTime: null,
    isUpdatingDispatchTime: false
};