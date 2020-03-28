import { MapResult } from 'src/app/models/mapResult';

export interface NewCallState {
    hasLoaded: boolean;
    mapData: MapResult;
}

export const initialState: NewCallState = {
    hasLoaded: false,
    mapData: null
};
