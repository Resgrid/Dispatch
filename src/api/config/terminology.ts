import { type GetTerminologyResult } from '@/models/v4/configs/getTerminologyResult';

import { createApiEndpoint } from '../common/client';

const getTerminologyApi = createApiEndpoint('/Config/GetTerminology');

/** The department's own names for modules and built-in record types (setting 118). */
export const getTerminology = async () => {
  const response = await getTerminologyApi.get<GetTerminologyResult>();
  return response.data;
};
