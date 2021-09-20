import { CallFileResult } from 'src/app/core/models/callFileResult';
import { CallNoteResult } from 'src/app/core/models/callNoteResult';
import { CallPriorityResult } from 'src/app/core/models/callPriorityResult';
import { CallResult } from 'src/app/core/models/callResult';
import { CallTemplateResult } from 'src/app/core/models/callTemplate';
import { CallTypeResult } from 'src/app/core/models/callTypeResult';
import { FormDataResult } from 'src/app/core/models/formDataResult';
import { GpsLocation } from 'src/app/core/models/gpsLocation';
import { GroupsForCallResult } from 'src/app/core/models/groupsForCallResult';
import { MapResult } from 'src/app/core/models/mapResult';
import { PersonnelForCallResult } from 'src/app/core/models/personnelForCallResult';
import { RolesForCallResult } from 'src/app/core/models/rolesForCallResult';
import { UnitStatusFullResult } from 'src/app/core/models/unitStatusFullResult';
import { SetUnitStateModalData } from '../models/setUnitStateModalData';

export interface HomeState {

    // Home page data
    hasLoaded: boolean;
    unitStatuses: UnitStatusFullResult[];
    calls: CallResult[];
    callPriorties: CallPriorityResult[];
    callTypes: CallTypeResult[];
    personnelForGrid: PersonnelForCallResult[];
    groupsForGrid: GroupsForCallResult[];
    rolesForGrid: RolesForCallResult[];
    newCallForm: FormDataResult;

    // Map data
    mapData: MapResult;

    // New Call data
    newCall: CallResult;
    newCallLocation: GpsLocation;
    newCallFormData: string;
    isSavingCall: boolean;
    
    // Edit Call
    editCall: CallResult;

    // Set unit state
    isSavingUnitState: boolean;
    setUnitStatusModalState: SetUnitStateModalData;

    // Close call
    isSavingCloseCall: boolean;
    closeCallState:  CallResult;

    // Call template
    callTemplates: CallTemplateResult[];
    activeCallTemplate: CallTemplateResult;

    // Call Notes
    callNotes: CallNoteResult[];

    // Call Images
    callImages: CallFileResult[];
    callFiles: CallFileResult[];
}

export const initialState: HomeState = {
    hasLoaded: false,
    unitStatuses: null,
    calls: null,
    callPriorties: null,
    callTypes: null,
    mapData: null,
    newCall: new CallResult(),
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