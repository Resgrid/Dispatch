import { UserInfo } from "src/app/core/models/userInfo";

export interface ProfileState {
  loggedIn: boolean;
}

export const initialState: ProfileState = {
  loggedIn: false,
};
