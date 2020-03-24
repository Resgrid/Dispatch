import { MapResult } from 'src/app/models/mapResult';

export interface MapState {
    hasLoaded: boolean;
    mapData: MapResult;
}

export const initialState: MapState = {
    hasLoaded: false,
    mapData: null
};
