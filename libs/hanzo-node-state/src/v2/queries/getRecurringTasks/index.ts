import { getRecurringTasks as getRecurringTasksApi } from '@hanzo-app/message/api/recurring-tasks/index';

import { type GetRecurringTasksInput } from './types';

export const getRecurringTasks = async ({
  nodeAddress,
  token,
}: GetRecurringTasksInput) => {
  const result = await getRecurringTasksApi(nodeAddress, token);
  return result;
};
export * from './useGetRecurringTasks';
