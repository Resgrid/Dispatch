import { Action } from "@ngrx/store";
import { MapDataAndMarkersData } from "@resgrid/ngx-resgridlib";

export enum MappingActionTypes {
  LOADING_MAP_DATA = "[MAPPING] LOADING_MAP_DATA",
  LOADING_MAP_DATA_SUCCESS = "[MAPPING] LOADING_MAP_DATA_SUCCESS",
  LOADING_MAP_DATA_FAIL = "[MAPPING] LOADING_MAP_DATA_FAIL",
  LOADING_MAP_DATA_DONE = "[MAPPING] LOADING_MAP_DATA_DONE",
}

export class LoadMapData implements Action {
  readonly type = MappingActionTypes.LOADING_MAP_DATA;
  constructor() {}
}

export class LoadMapDataSuccess implements Action {
  readonly type = MappingActionTypes.LOADING_MAP_DATA_SUCCESS;
  constructor(public payload: MapDataAndMarkersData) {}
}

export class LoadMapDataFail implements Action {
  readonly type = MappingActionTypes.LOADING_MAP_DATA_FAIL;
  constructor() {}
}

export class LoadMapDataDone implements Action {
  readonly type = MappingActionTypes.LOADING_MAP_DATA_DONE;
  constructor() {}
}

export type MappingActionsUnion = LoadMapData | LoadMapDataSuccess | LoadMapDataFail | LoadMapDataDone;
