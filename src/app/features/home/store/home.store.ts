import { DashboardPayload } from '../models/dashboardPayload';

export interface HomeState {
    hasLoaded: boolean;
    data: DashboardPayload;
}

export const initialState: HomeState = {
    hasLoaded: false,
    data: null
};
