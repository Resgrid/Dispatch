import { type GetAllPersonnelInfosResult } from '@/models/v4/personnel/getAllPersonnelInfosResult';
import { type GetPersonnelFilterOptionsResult } from '@/models/v4/personnel/getPersonnelFilterOptionsResult';
import { type PersonnelInfoResult } from '@/models/v4/personnel/personnelInfoResult';

import { createCachedApiEndpoint } from '../common/cached-client';
import { createApiEndpoint } from '../common/client';

const getPersonnelInfoApi = createApiEndpoint('/Personnel/GetPersonnelInfo');

const getAllPersonnelInfosApi = createApiEndpoint('/Personnel/GetAllPersonnelInfos');

const ugetPersonnelFilterOptionsApi = createCachedApiEndpoint('/Personnel/GetPersonnelFilterOptions', {
  ttl: 15 * 60 * 1000, // Cache for 15 minutes -- operational data, must not go stale
  enabled: true,
});

export const getPersonnelInfo = async (userId: string) => {
  const response = await getPersonnelInfoApi.get<PersonnelInfoResult>({
    userId: userId,
  });
  return response.data;
};

export const getAllPersonnelInfos = async (filter: string) => {
  if (filter) {
    const response = await getAllPersonnelInfosApi.get<GetAllPersonnelInfosResult>({
      activeFilter: encodeURIComponent(filter),
    });
    return response.data;
  }

  const response = await getAllPersonnelInfosApi.get<GetAllPersonnelInfosResult>();
  return response.data;
};

export const getUnitsFilterOptions = async () => {
  const response = await ugetPersonnelFilterOptionsApi.get<GetPersonnelFilterOptionsResult>();
  return response.data;
};

// Alias for backwards compatibility
export const getPersonnelFilterOptions = getUnitsFilterOptions;
