import { CallFileResultData, CallNoteResultData, CallPriorityResultData, CallResultData, CallTypeResultData, FormResultData, GetCallTemplatesResultData, GpsLocation, MapDataAndMarkersData } from '@resgrid-shared/ngx-resgridlib';
import { CallLocalResult } from 'src/app/core/models/callLocalResult';
import { GroupsForCallResult } from 'src/app/core/models/groupsForCallResult';
import { PersonnelForCallResult } from 'src/app/core/models/personnelForCallResult';
import { RolesForCallResult } from 'src/app/core/models/rolesForCallResult';
import { UnitStatusResult } from 'src/app/core/models/unitStatusResult';
import { SetUnitStateModalData } from '../models/setUnitStateModalData';

export interface HomeState {

    // Home page data
    hasLoaded: boolean;
    unitStatuses: UnitStatusResult[];
    calls: CallLocalResult[];
    callPriorties: CallPriorityResultData[];
    callTypes: CallTypeResultData[];
    personnelForGrid: PersonnelForCallResult[];
    groupsForGrid: GroupsForCallResult[];
    rolesForGrid: RolesForCallResult[];
    newCallForm: FormResultData;

    // Map data
    mapData: MapDataAndMarkersData;

    // New Call data
    newCall: CallResultData;
    newCallLocation: GpsLocation;
    newCallFormData: string;
    isSavingCall: boolean;
    
    // Edit Call
    editCall: CallResultData;

    // Set unit state
    isSavingUnitState: boolean;
    setUnitStatusModalState: SetUnitStateModalData;

    // Close call
    isSavingCloseCall: boolean;
    closeCallState:  CallResultData;

    // Call template
    callTemplates: GetCallTemplatesResultData[];
    activeCallTemplate: GetCallTemplatesResultData;

    // Call Notes
    callNotes: CallNoteResultData[];

    // Call Images
    callImages: CallFileResultData[];
    callFiles: CallFileResultData[];
}

export const initialState: HomeState = {
    hasLoaded: false,
    unitStatuses: null,
    calls: null,
    callPriorties: null,
    callTypes: null,
    mapData: null,
    newCall: new CallResultData(),
    isSavingCall: false,
    isSavingUnitState: false,
    setUnitStatusModalState: null,
    isSavingCloseCall: false,
    closeCallState: null,
    personnelForGrid: null,
    groupsForGrid: null,
    rolesForGrid: null,
    newCallLocation: null,
    callTemplates: null,
    activeCallTemplate: null,
    callNotes: null,
    callImages: null,
    callFiles: null,
    newCallForm: null,
    newCallFormData: null,
    editCall: null,
};