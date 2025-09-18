import { runTaskNowApi } from '@hanzo-app/message/api/recurring-tasks/index';

import { type RunTaskNowInput } from './types';

export const runTaskNow = async ({
  nodeAddress,
  token,
  taskId,
}: RunTaskNowInput) => {
  const response = await runTaskNowApi(nodeAddress, token, taskId);
  return response;
};
export * from './useRunTaskNow';
