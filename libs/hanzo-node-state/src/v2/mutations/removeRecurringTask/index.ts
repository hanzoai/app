import { removeRecurringTask as removeRecurringTaskApi } from '@hanzo-app/message/api/recurring-tasks/index';

import { type RemoveRecurringTaskInput } from './types';

export const removeRecurringTask = async ({
  nodeAddress,
  token,
  recurringTaskId,
}: RemoveRecurringTaskInput) => {
  const response = await removeRecurringTaskApi(nodeAddress, token, {
    cron_task_id: recurringTaskId,
  });
  return response;
};
export * from './useRemoveRecurringTask';
