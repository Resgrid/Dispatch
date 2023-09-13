import { Action } from "@ngrx/store";

export enum ProfileActionTypes {
  UPDATE_PROFILE = "[PROFILE] UPDATE_PROFILE",
}

export class UpdateProfile implements Action {
  readonly type = ProfileActionTypes.UPDATE_PROFILE;
  constructor() {}
}

export type ProfileActionsUnion = UpdateProfile;
