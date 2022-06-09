import { initialState, MappingState } from "../store/mapping.store";
import { MappingActionsUnion, MappingActionTypes } from "../actions/mapping.actions";
import * as _ from "lodash";

export function reducer(
  state: MappingState = initialState,
  action: MappingActionsUnion
): MappingState {
  switch (action.type) {
    case MappingActionTypes.LOADING_MAP_DATA_SUCCESS:
			return {
				...state,
				mapData: action.payload,
			};
    default:
      return state;
  }
}

