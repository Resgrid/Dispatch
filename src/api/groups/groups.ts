import { type GroupResult } from '@/models/v4/groups/groupResult';
import { type GroupsResult } from '@/models/v4/groups/groupsResult';

import { createCachedApiEndpoint } from '../common/cached-client';
import { createApiEndpoint } from '../common/client';

const getAllGroupsApi = createCachedApiEndpoint('/Groups/GetAllGroups', {
  ttl: 15 * 60 * 1000, // Cache for 15 minutes -- operational data, must not go stale
  enabled: true,
});

const getGroupsApi = createApiEndpoint('/Groups/GetAllGroups');

export const getAllGroups = async () => {
  const response = await getAllGroupsApi.get<GroupsResult>();
  return response.data;
};

export const getGroup = async (groupId: string) => {
  const response = await getGroupsApi.get<GroupResult>({
    groupId: encodeURIComponent(groupId),
  });
  return response.data;
};
