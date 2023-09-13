import { MapDataAndMarkersData } from "@resgrid/ngx-resgridlib";

export interface MappingState {
  mapData: MapDataAndMarkersData;
}

export const initialState: MappingState = {
  mapData: null,
};
