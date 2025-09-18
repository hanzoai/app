import { type Token } from '@hanzo-app/message/api/general/types';
import { type GetRecurringTaskResponse } from '@hanzo-app/message/api/recurring-tasks/types';

export type GetRecurringTaskInput = Token & {
  nodeAddress: string;
  recurringTaskId: string;
};

export type GetRecurringTaskOutput = GetRecurringTaskResponse;
