import { type Token } from '@hanzo-app/message/api/general/types';
import { type PublishToolResponse } from '@hanzo-app/message/api/tools/types';

export type PublishToolOutput = PublishToolResponse;

export type PublishToolInput = Token & {
  nodeAddress: string;
  toolKey: string;
};
