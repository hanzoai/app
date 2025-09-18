import { updateChatConfig as updateChatConfigApi } from '@hanzo-app/message/api/jobs/index';

import { type UpdateChatConfigInput } from './types';

export const updateChatConfig = async ({
  nodeAddress,
  token,
  jobId,
  jobConfig,
}: UpdateChatConfigInput) => {
  const response = await updateChatConfigApi(nodeAddress, token, {
    job_id: jobId,
    config: jobConfig,
  });
  return response;
};
export * from './useUpdateChatConfig';
