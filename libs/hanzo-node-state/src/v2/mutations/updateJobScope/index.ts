import { updateJobScope as updateJobScopeApi } from '@hanzo-app/message/api/jobs/index';

import { type UpdateChatConfigInput } from './types';

export const updateJobScope = async ({
  nodeAddress,
  token,
  jobId,
  jobScope,
}: UpdateChatConfigInput) => {
  const response = await updateJobScopeApi(nodeAddress, token, {
    job_id: jobId,
    job_scope: jobScope,
  });
  return response;
};
export * from './useUpdateJobScope';
