import { Action } from '@ngrx/store';
import { CallFileResultData, CallNoteResultData, CallResultData, DepartmentVoiceResultData, GetCallTemplatesResultData, GpsLocation, MapDataAndMarkersData, UnitStatusResultData } from '@resgrid/ngx-resgridlib';
import { Call } from 'src/app/core/models/call';
import { PersonnelForCallResult } from 'src/app/core/models/personnelForCallResult';
import { UnitStatusResult } from 'src/app/core/models/unitStatusResult';
import { DashboardPayload } from '../models/dashboardPayload';
import { SaveCloseCallPayload } from '../models/saveCloseCallPayload';
import { SetPersonStatffingPayload } from '../models/setPersonStatffingPayload';
import { SetPersonStatusesPayload } from '../models/setPersonStatusesPayload';
import { SetUnitStateModalData } from '../models/setUnitStateModalData';
import { SetUnitStatePayload } from '../models/setUnitStatePayload';

// [AUTH] Auth module
export enum HomeActionTypes {
  LOADING = '[HOME] LOADING',
  LOADING_SUCCESS = '[HOME] LOADING_SUCCESS',
  LOADING_FAIL = '[HOME] LOADING_FAIL',
  LOADING_MAP = '[HOME] LOADING MAP',
  LOADING_MAP_SUCCESS = '[HOME] LOADING_MAP_SUCCESS',
  LOADING_MAP_FAIL = '[HOME] LOADING_MAP_FAIL',
  SHOW_SETUNITSTATUSMODAL = '[HOME] SHOW_SETUNITSTATUSMODAL',
  OPEN_SETUNITSTATUSMODAL = '[HOME] OPEN_SETUNITSTATUSMODAL',
  SAVING_SETUNITSTATUSMODAL = '[HOME] SAVING_SETUNITSTATUSMODAL',
  SAVE_UNITSTATE = '[HOME] SAVE_UNITSTATE',
  SAVE_UNITSTATE_SUCCESS = '[HOME] SAVE_UNITSTATE_SUCCESS',
  SAVE_UNITSTATE_FAIL = '[HOME] SAVE_UNITSTATE_FAIL',
  GET_LATESTUNITSTATES = '[HOME] GET_LATESTUNITSTATES',
  UPDATE_UNITSTATES = '[HOME] UPDATE_UNITSTATES',
  UPDATE_SELECTUNIT = '[HOME] UPDATE_SELECTUNIT',
  UPDATE_SELECTEDCALL = '[HOME] UPDATE_SELECTEDCALL',
  SAVE_CLOSECALL = '[HOME] SAVE_CLOSECALL',
  SAVE_CLOSECALL_SUCCESS = '[HOME] SAVE_CLOSECALL_SUCCESS',
  SAVE_CLOSECALL_FAIL = '[HOME] SAVE_CLOSECALL_FAIL',
  SHOW_CLOSECALLMODAL = '[HOME] SHOW_CLOSECALLMODAL',
  UPDATE_CALLS = '[HOME] UPDATE_CALLS',
  UPDATE_SELECTEDDISPATCHPERSON = '[HOME] UPDATE_SELECTEDDISPATCHPERSON',
  UPDATE_SELECTEDDISPATCHGROUP = '[HOME] UPDATE_SELECTEDDISPATCHGROUP',
  UPDATE_SELECTEDDISPATCHROLE = '[HOME] UPDATE_SELECTEDDISPATCHROLE',
  UPDATE_SELECTEDDISPATCHUNIT = '[HOME] UPDATE_SELECTEDDISPATCHUNIT',
  UPDATE_NEWCALLLOCATION = '[HOME] UPDATE_NEWCALLLOCATION',
  SHOW_SELECTCALLTEMPLATEMODAL = '[HOME] SHOW_SELECTCALLTEMPLATEMODAL',
  OPEN_SELECTCALLTEMPLATEMODAL = '[HOME] OPEN_SELECTCALLTEMPLATEMODAL',
  UPDATE_APPLYCALLTEMPLATE = '[HOME] UPDATE_APPLYCALLTEMPLATE',
  GET_COORDINATESFORADDRESS = '[HOME] GET_COORDINATESFORADDRESS',
  GET_COORDINATESFORADDRESS_SUCCESS = '[HOME] GET_COORDINATESFORADDRESS_SUCCESS',
  GET_COORDINATESFORADDRESS_FAIL = '[HOME] GET_COORDINATESFORADDRESS_FAIL',
  SAVE_CALL = '[HOME] SAVE_CALL',
  SAVE_CALL_START = '[HOME] SAVE_CALL_START',
  SAVE_CALL_SUCCESS = '[HOME] SAVE_CALL_SUCCESS',
  SAVE_CALL_FAIL = '[HOME] SAVE_CALL_FAIL',
  GENERAL_FAILURE = '[HOME] GENERAL_FAILURE',
  GET_LATESTPERSONNELDATA = '[HOME] GET_LATESTPERSONNELDATA',
  UPDATE_PERSONNELDATA = '[HOME] UPDATE_PERSONNELDATA',
  GET_LATESTCALLS = '[HOME] GET_LATESTCALLS',
  SHOW_CALLNOTESMODAL = '[HOME] SHOW_CALLNOTESMODAL',
  OPEN_CALLNOTESMODAL = '[HOME] OPEN_CALLNOTESMODAL',
  SAVE_CALLNOTE = '[HOME] SAVE_CALLNOTE',
  SAVE_CALLNOTE_SUCCESS = '[HOME] SAVE_CALLNOTE_SUCCESS',
  SAVE_CALLNOTE_FAIL = '[HOME] SAVE_CALLNOTE_FAIL',
  SHOW_CALLIMAGESMODAL = '[HOME] SHOW_CALLIMAGESMODAL',
  OPEN_CALLIMAGESMODAL = '[HOME] OPEN_CALLIMAGESMODAL',
  UPLOAD_CALLIMAGE = '[HOME] UPLOAD_CALLIMAGE',
  UPLOAD_CALLIMAGE_SUCCESS = '[HOME] UPLOAD_CALLIMAGE_SUCCESS',
  UPLOAD_CALLIMAGE_FAIL = '[HOME] UPLOAD_CALLIMAGE_FAIL',
  SHOW_CALLFILESMODAL = '[HOME] SHOW_CALLFILESMODAL',
  OPEN_CALLFILESMODAL = '[HOME] OPEN_CALLFILESMODAL',
  UPLOAD_CALLFILE = '[HOME] UPLOAD_CALLFILE',
  UPLOAD_CALLFILE_SUCCESS = '[HOME] UPLOAD_CALLFILE_SUCCESS',
  UPLOAD_CALLFILE_FAIL = '[HOME] UPLOAD_CALLFILE_FAIL',
  UPDATE_PERSONANDUNITS_DISTANCE = '[HOME] UPDATE_PERSONANDUNITS_DISTANCE',
  GET_UPDATEDPERSONANDUNITS_DISTANCE = '[HOME] GET_UPDATEDPERSONANDUNITS_DISTANCE',
  OPEN_CALLFORMMODAL = '[HOME] OPEN_CALLFORMMODAL',
  SET_NEWCALLFORMDATA = '[HOME] SET_NEWCALLFORMDATA',
  DONE = '[HOME] DONE',
  OPEN_SETPERSONSTATUSMODAL = '[HOME] OPEN_SETPERSONSTATUSMODAL',
  UPDATE_SELECTPERSON = '[HOME] UPDATE_SELECTPERSON',
  OPEN_SETPERSONSTAFFINGMODAL = '[HOME] OPEN_SETPERSONSTAFFINGMODAL',
  SAVE_PERSONSTATUSES = '[HOME] SAVE_PERSONSTATUSES',
  SAVE_PERSONSTATUSES_SUCCESS = '[HOME] SAVE_PERSONSTATUSES_SUCCESS',
  SAVE_PERSONSTATUSES_FAIL = '[HOME] SAVE_PERSONSTATUSES_FAIL',
  UPDATE_PERSONSTATUSES = '[HOME] UPDATE_PERSONSTATUSES',
  SAVE_PERSONSTAFFING = '[HOME] SAVE_PERSONSTAFFING',
  SAVE_PERSONSTAFFING_SUCCESS = '[HOME] SAVE_PERSONSTAFFING_SUCCESS',
  SAVE_PERSONSTAFFING_FAIL = '[HOME] SAVE_PERSONSTAFFING_FAIL',
  UPDATE_PERSONSTAFFING = '[HOME] UPDATE_PERSONSTAFFING',
}

// Home
export class Loading implements Action {
  readonly type = HomeActionTypes.LOADING;
  constructor() {}
}

export class LoadingSuccess implements Action {
  readonly type = HomeActionTypes.LOADING_SUCCESS;
  constructor(public payload: DashboardPayload) {}
}

export class LoadingFail implements Action {
  readonly type = HomeActionTypes.LOADING_FAIL;
  constructor(public payload: string) {}
}


// Map
export class LoadingMap implements Action {
  readonly type = HomeActionTypes.LOADING_MAP;
  constructor() {}
}

export class LoadingMapSuccess implements Action {
  readonly type = HomeActionTypes.LOADING_MAP_SUCCESS;
  constructor(public payload: MapDataAndMarkersData) {}
}

export class LoadingMapFail implements Action {
  readonly type = HomeActionTypes.LOADING_MAP_FAIL;
  constructor(public payload: string) {}
}

// Set Unit State Modal
export class ShowSetUnitStateModal implements Action {
  readonly type = HomeActionTypes.SHOW_SETUNITSTATUSMODAL;
  constructor(public unitId: string) {}
}

export class OpenSetUnitStateModal implements Action {
  readonly type = HomeActionTypes.OPEN_SETUNITSTATUSMODAL;
  constructor(public payload: SetUnitStateModalData) {}
}

export class SavingSetUnitState implements Action {
  readonly type = HomeActionTypes.SAVING_SETUNITSTATUSMODAL;
  constructor() {}
}

export class SavingUnitState implements Action {
  readonly type = HomeActionTypes.SAVE_UNITSTATE;
  constructor(public payload: SetUnitStatePayload) {}
}

export class SavingUnitStateSuccess implements Action {
  readonly type = HomeActionTypes.SAVE_UNITSTATE_SUCCESS;
  constructor() {}
}

export class SavingUnitStateFail implements Action {
  readonly type = HomeActionTypes.SAVE_UNITSTATE_FAIL;
  constructor(public payload: string) {}
}

export class GetLatestUnitStates implements Action {
  readonly type = HomeActionTypes.GET_LATESTUNITSTATES;
  constructor() {}
}

export class UpdateUnitStates implements Action {
  readonly type = HomeActionTypes.UPDATE_UNITSTATES;
  constructor(public payload: UnitStatusResultData[]) {}
}

export class UpdateSelectUnit implements Action {
  readonly type = HomeActionTypes.UPDATE_SELECTUNIT;
  constructor(public unitId: string, public checked: boolean) {}
}

export class UpdateSelectPerson implements Action {
  readonly type = HomeActionTypes.UPDATE_SELECTPERSON;
  constructor(public userId: string, public checked: boolean) {}
}

export class UpdateSelectedCall implements Action {
  readonly type = HomeActionTypes.UPDATE_SELECTEDCALL;
  constructor(public callId: string, public checked: boolean) {}
}

export class SavingCloseCall implements Action {
  readonly type = HomeActionTypes.SAVE_CLOSECALL;
  constructor(public payload: SaveCloseCallPayload) {}
}

export class SavingCloseCallSuccess implements Action {
  readonly type = HomeActionTypes.SAVE_CLOSECALL_SUCCESS;
  constructor() {}
}

export class SavingCloseCallFail implements Action {
  readonly type = HomeActionTypes.SAVE_CLOSECALL_FAIL;
  constructor(public payload: string) {}
}

export class ShowCloseCallModal implements Action {
  readonly type = HomeActionTypes.SHOW_CLOSECALLMODAL;
  constructor() {}
}

export class UpdateCalls implements Action {
  readonly type = HomeActionTypes.UPDATE_CALLS;
  constructor(public payload: CallResultData[]) {}
}

export class UpdateSelectedDispatchPerson implements Action {
  readonly type = HomeActionTypes.UPDATE_SELECTEDDISPATCHPERSON;
  constructor(public userId: string, public checked: boolean) {}
}

export class UpdateSelectedDispatchGroup implements Action {
  readonly type = HomeActionTypes.UPDATE_SELECTEDDISPATCHGROUP;
  constructor(public groupId: string, public checked: boolean) {}
}

export class UpdateSelectedDispatchRole implements Action {
  readonly type = HomeActionTypes.UPDATE_SELECTEDDISPATCHROLE;
  constructor(public roleId: string, public checked: boolean) {}
}

export class UpdateSelectedDispatchRoleUnit implements Action {
  readonly type = HomeActionTypes.UPDATE_SELECTEDDISPATCHUNIT;
  constructor(public unitId: string, public checked: boolean) {}
}

export class UpdateNewCallLocation implements Action {
  readonly type = HomeActionTypes.UPDATE_NEWCALLLOCATION;
  constructor(public latitude: number, public longitude: number) {}
}

export class ShowSelectCallTemplateModal implements Action {
  readonly type = HomeActionTypes.SHOW_SELECTCALLTEMPLATEMODAL;
  constructor() {}
}

export class OpenSelectCallTemplateModal implements Action {
  readonly type = HomeActionTypes.OPEN_SELECTCALLTEMPLATEMODAL;
  constructor(public payload: GetCallTemplatesResultData[]) {}
}

export class ApplyCallTemplate implements Action {
  readonly type = HomeActionTypes.UPDATE_APPLYCALLTEMPLATE;
  constructor(public payload: GetCallTemplatesResultData) {}
}

export class GetCoordinatesForAddress implements Action {
  readonly type = HomeActionTypes.GET_COORDINATESFORADDRESS;
  constructor(public address: string) {}
}

export class GetCoordinatesForAddressSuccess implements Action {
  readonly type = HomeActionTypes.GET_COORDINATESFORADDRESS_SUCCESS;
  constructor(public payload: GpsLocation) {}
}

export class GetCoordinatesForAddressFail implements Action {
  readonly type = HomeActionTypes.GET_COORDINATESFORADDRESS_FAIL;
  constructor(public payload: string) {}
}

export class IsSavingCall implements Action {
  readonly type = HomeActionTypes.SAVE_CALL_START;
  constructor() {}
}

export class SaveCall implements Action {
  readonly type = HomeActionTypes.SAVE_CALL;
  constructor(public call: Call) {}
}

export class SaveCallSuccess implements Action {
  readonly type = HomeActionTypes.SAVE_CALL_SUCCESS;
  constructor(public payload: string) {}
}

export class SaveCallFail implements Action {
  readonly type = HomeActionTypes.SAVE_CALL_FAIL;
  constructor(public payload: string) {}
}

export class GeneralNetworkFailure implements Action {
  readonly type = HomeActionTypes.GENERAL_FAILURE;
  constructor(public payload: string) {}
}

export class GetLatestPersonnelData implements Action {
  readonly type = HomeActionTypes.GET_LATESTPERSONNELDATA;
  constructor() {}
}

export class UpdatePersonnelData implements Action {
  readonly type = HomeActionTypes.UPDATE_PERSONNELDATA;
  constructor(public payload: PersonnelForCallResult[]) {}
}

export class GetLatestCalls implements Action {
  readonly type = HomeActionTypes.GET_LATESTCALLS;
  constructor() {}
}

export class ShowCallNotesModal implements Action {
  readonly type = HomeActionTypes.SHOW_CALLNOTESMODAL;
  constructor(public callId: string) {}
}

export class OpenCallNotesModal implements Action {
  readonly type = HomeActionTypes.OPEN_CALLNOTESMODAL;
  constructor(public payload: CallNoteResultData[]) {}
}

export class SaveCallNote implements Action {
  readonly type = HomeActionTypes.SAVE_CALLNOTE;
  constructor(public callId: string, public callNote: string, public userId: string) {}
}

export class SaveCallNoteSuccess implements Action {
  readonly type = HomeActionTypes.SAVE_CALLNOTE_SUCCESS;
  constructor() {}
}

export class SaveCallNoteFail implements Action {
  readonly type = HomeActionTypes.SAVE_CALLNOTE_FAIL;
  constructor() {}
}

export class ShowCallImagesModal implements Action {
  readonly type = HomeActionTypes.SHOW_CALLIMAGESMODAL;
  constructor(public callId: string) {}
}

export class OpenCallImagesModal implements Action {
  readonly type = HomeActionTypes.OPEN_CALLIMAGESMODAL;
  constructor(public payload: CallFileResultData[]) {}
}

export class UploadCallImage implements Action {
  readonly type = HomeActionTypes.UPLOAD_CALLIMAGE;
  constructor(public callId: string, public userId: string, public name: string, public image: string) {}
}

export class UploadCallImageSuccess implements Action {
  readonly type = HomeActionTypes.UPLOAD_CALLIMAGE_SUCCESS;
  constructor() {}
}

export class UploadCallImageFail implements Action {
  readonly type = HomeActionTypes.UPLOAD_CALLIMAGE_FAIL;
  constructor() {}
}

export class ShowCallFilesModal implements Action {
  readonly type = HomeActionTypes.SHOW_CALLFILESMODAL;
  constructor(public callId: string) {}
}

export class OpenCallFilesModal implements Action {
  readonly type = HomeActionTypes.OPEN_CALLFILESMODAL;
  constructor(public payload: CallFileResultData[]) {}
}

export class UploadCallFile implements Action {
  readonly type = HomeActionTypes.UPLOAD_CALLFILE;
  constructor(public callId: string, public userId: string, public name: string, public image: string) {}
}

export class UploadCallFileSuccess implements Action {
  readonly type = HomeActionTypes.UPLOAD_CALLFILE_SUCCESS;
  constructor() {}
}

export class UploadCallFileFail implements Action {
  readonly type = HomeActionTypes.UPLOAD_CALLFILE_FAIL;
  constructor() {}
}

export class UpdatePersonnelandUnitsDistancesToCall implements Action {
  readonly type = HomeActionTypes.UPDATE_PERSONANDUNITS_DISTANCE;
  constructor(public personnel: PersonnelForCallResult[], public units: UnitStatusResult[]) {}
}

export class GetUpdatedPersonnelandUnitsDistancesToCall implements Action {
  readonly type = HomeActionTypes.GET_UPDATEDPERSONANDUNITS_DISTANCE;
  constructor(public callLocation: GpsLocation, public personnel: PersonnelForCallResult[], public units: UnitStatusResult[]) {}
}

export class OpenCallFormModal implements Action {
  readonly type = HomeActionTypes.OPEN_CALLFORMMODAL;
  constructor() {}
}

export class SetNewCallFormData implements Action {
  readonly type = HomeActionTypes.SET_NEWCALLFORMDATA;
  constructor(public formData: string) {}
}

export class OpenSetPersonStatusModal implements Action {
  readonly type = HomeActionTypes.OPEN_SETPERSONSTATUSMODAL;
  constructor() {}
}

export class OpenSetPersonStaffingModal implements Action {
  readonly type = HomeActionTypes.OPEN_SETPERSONSTAFFINGMODAL;
  constructor() {}
}

export class SavingPersonStatuses implements Action {
  readonly type = HomeActionTypes.SAVE_PERSONSTATUSES;
  constructor(public payload: SetPersonStatusesPayload) {}
}

export class SavingPersonStatusesSuccess implements Action {
  readonly type = HomeActionTypes.SAVE_PERSONSTATUSES_SUCCESS;
  constructor() {}
}

export class SavingPersonStatusesFail implements Action {
  readonly type = HomeActionTypes.SAVE_PERSONSTATUSES_FAIL;
  constructor() {}
}

export class UpdatePersonStatuses implements Action {
  readonly type = HomeActionTypes.UPDATE_PERSONSTATUSES;
  constructor(public payload: PersonnelForCallResult[]) {}
}

export class SavingPersonStaffing implements Action {
  readonly type = HomeActionTypes.SAVE_PERSONSTAFFING;
  constructor(public payload: SetPersonStatffingPayload) {}
}

export class SavingPersonStaffingSuccess implements Action {
  readonly type = HomeActionTypes.SAVE_PERSONSTAFFING_SUCCESS;
  constructor() {}
}

export class SavingPersonStaffingFail implements Action {
  readonly type = HomeActionTypes.SAVE_PERSONSTAFFING_FAIL;
  constructor() {}
}

export class UpdatePersonStaffings implements Action {
  readonly type = HomeActionTypes.UPDATE_PERSONSTAFFING;
  constructor(public payload: PersonnelForCallResult[]) {}
}

export class Done implements Action {
  readonly type = HomeActionTypes.DONE;
  constructor() {}
}

export type HomeActionsUnion = Loading | LoadingSuccess | LoadingFail | LoadingMap | LoadingMapSuccess | LoadingMapFail | 
                               ShowSetUnitStateModal | OpenSetUnitStateModal | SavingSetUnitState | SavingUnitState | SavingUnitStateSuccess |
                               SavingUnitStateFail | UpdateUnitStates | UpdateSelectUnit | UpdateSelectedCall | SavingCloseCall |
                               SavingCloseCallSuccess | SavingCloseCallFail | ShowCloseCallModal | UpdateCalls | UpdateSelectedDispatchPerson |
                               UpdateSelectedDispatchGroup | UpdateSelectedDispatchRole | UpdateSelectedDispatchRoleUnit | UpdateNewCallLocation |
                               ShowSelectCallTemplateModal | OpenSelectCallTemplateModal | ApplyCallTemplate | GetCoordinatesForAddress | 
                               GetCoordinatesForAddressSuccess | GetCoordinatesForAddressFail | SaveCall | SaveCallSuccess | SaveCallFail |
                               GetLatestUnitStates | GeneralNetworkFailure | GetLatestPersonnelData | UpdatePersonnelData | GetLatestCalls |
                               ShowCallNotesModal | OpenCallNotesModal | SaveCallNote | SaveCallNoteSuccess | SaveCallNoteFail | ShowCallImagesModal |
                               OpenCallImagesModal | UploadCallImage | UploadCallImageSuccess | UploadCallImageFail | ShowCallFilesModal | 
                               OpenCallFilesModal | UpdatePersonnelandUnitsDistancesToCall | GetUpdatedPersonnelandUnitsDistancesToCall |
                               OpenCallFormModal | SetNewCallFormData | IsSavingCall | Done | UpdateSelectPerson | OpenSetPersonStatusModal |  
                               OpenSetPersonStaffingModal | SavingPersonStatuses | UpdatePersonStatuses | SavingPersonStaffing | SavingPersonStaffing |
                               SavingPersonStaffingSuccess | SavingPersonStaffingFail | UpdatePersonStaffings
                               ;
