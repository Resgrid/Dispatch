import { type GetUnitFilterOptionsResult } from '@/models/v4/units/getUnitFilterOptionsResult';
import { type UnitsInfoResult } from '@/models/v4/units/unitInfoResult';
import { type UnitsResult } from '@/models/v4/units/unitsResult';

import { createCachedApiEndpoint } from '../common/cached-client';

const unitsApi = createCachedApiEndpoint('/Units/GetAllUnits', {
  ttl: 15 * 60 * 1000, // Cache for 15 minutes -- operational data, must not go stale
  enabled: true,
});

const unitsInfosApi = createCachedApiEndpoint('/Units/GetAllUnitsInfos', {
  ttl: 15 * 60 * 1000, // Cache for 15 minutes -- operational data, must not go stale
  enabled: true,
});

const unitsFilterOptionsApi = createCachedApiEndpoint('/Units/GetUnitsFilterOptions', {
  ttl: 15 * 60 * 1000, // Cache for 15 minutes -- operational data, must not go stale
  enabled: true,
});

export const getUnits = async (forceRefresh = false) => {
  const response = await unitsApi.get<UnitsResult>(undefined, { forceRefresh });
  return response.data;
};

export const getUnitsInfos = async (filter: string) => {
  if (filter) {
    const response = await unitsInfosApi.get<UnitsInfoResult>({
      activeFilter: encodeURIComponent(filter),
    });
    return response.data;
  }

  const response = await unitsInfosApi.get<UnitsInfoResult>();
  return response.data;
};

export const getUnitsFilterOptions = async () => {
  const response = await unitsFilterOptionsApi.get<GetUnitFilterOptionsResult>();
  return response.data;
};
