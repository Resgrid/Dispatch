import { createApiEndpoint } from '@/api/common/client';
import { type GetSetUnitStateResult } from '@/models/v4/dispatch/getSetUnitStateResult';
import { type GetNearestUnitsResult, type NearestUnitBoard } from '@/models/v4/dispatch/nearestUnitBoard';
import { type NewCallFormResult } from '@/models/v4/dispatch/newCallFormResult';

const getNewCallDataApi = createApiEndpoint('/Dispatch/GetNewCallData');
const getSetUnitStateApi = createApiEndpoint('/Dispatch/GetSetUnitStatusData');
const getNearestUnitsApi = createApiEndpoint('/Dispatch/GetNearestUnits');

/**
 * The units and responders the viewer may dispatch, ranked by response time to a location, with distance, ETA, status,
 * crew and position. Not gated by run cards; the department's routed-ETA setting decides road vs estimated ETAs.
 */
export const getNearestUnits = async (latitude: number, longitude: number, signal?: AbortSignal): Promise<NearestUnitBoard | null> => {
  const response = await getNearestUnitsApi.get<GetNearestUnitsResult>({ latitude, longitude }, signal);
  return response.data?.Data ?? null;
};

export const getNewCallData = async () => {
  const response = await getNewCallDataApi.get<NewCallFormResult>();
  return response.data;
};

export const getSetUnitState = async (unitId: string) => {
  const response = await getSetUnitStateApi.get<GetSetUnitStateResult>({
    unitId: unitId,
  });
  return response.data;
};

export const getSetUnitStatusData = getSetUnitState;
