import { ProfileActionsUnion } from '../actions/profile.actions';
import { initialState, ProfileState } from '../store/profile.store';

export function reducer(state: ProfileState = initialState, action: ProfileActionsUnion): ProfileState {
  switch (action.type) {
    
    default:
      return state;
  }
}


