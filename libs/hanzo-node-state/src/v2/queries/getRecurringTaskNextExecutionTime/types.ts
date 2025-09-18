import { type Token } from '@hanzo-app/message/api/general/types';
import { type GetRecurringTaskResponse } from '@hanzo-app/message/api/recurring-tasks/types';

export type GetRecurringTasksNextExecutionTimeInput = Token & {
  nodeAddress: string;
};

export type GetRecurringTasksNextExecutionTimeOutput = GetRecurringTaskResponse;
