import { type Token } from '@hanzo-app/message/api/general/types';
import { type RemoveRecurringTaskResponse } from '@hanzo-app/message/api/recurring-tasks/types';

export type RemoveRecurringTaskOutput = RemoveRecurringTaskResponse;

export type RemoveRecurringTaskInput = Token & {
  nodeAddress: string;
  recurringTaskId: string;
};
