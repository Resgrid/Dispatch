import { UserInfo } from 'src/app/models/userInfo';

export interface AuthState {
    loggedIn: boolean;
    errorMsg: string;
    isLogging: boolean;
    user: UserInfo;
}

export const initialState: AuthState = {
    loggedIn: false,
    errorMsg: null,
    isLogging: false,
    user: null
};
