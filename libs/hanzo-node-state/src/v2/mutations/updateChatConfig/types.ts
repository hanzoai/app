import { type Token } from '@hanzo-app/message/api/general/types';
import {
  type JobConfig,
  type UpdateChatConfigResponse,
} from '@hanzo-app/message/api/jobs/types';

export type UpdateChatConfigOutput = UpdateChatConfigResponse;

export type UpdateChatConfigInput = Token & {
  nodeAddress: string;
  jobId: string;
  jobConfig: JobConfig;
};
