import { getProviderFromJob as getProviderFromJobApi } from '@hanzo-app/message/api/jobs/index';

import { type GetProviderFromJobInput } from './types';

export const getProviderFromJob = async ({
  nodeAddress,
  token,
  jobId,
}: GetProviderFromJobInput) => {
  const result = await getProviderFromJobApi(nodeAddress, token, {
    job_id: jobId,
  });
  return result;
};
export * from './useGetProviderFromJob';
