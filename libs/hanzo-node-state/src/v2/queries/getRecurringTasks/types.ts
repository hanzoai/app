import { type Token } from '@hanzo-app/message/api/general/types';
import { type GetRecurringTasksResponse } from '@hanzo-app/message/api/recurring-tasks/types';

export type GetRecurringTasksInput = Token & {
  nodeAddress: string;
};

export type GetRecurringTasksOutput = GetRecurringTasksResponse;
