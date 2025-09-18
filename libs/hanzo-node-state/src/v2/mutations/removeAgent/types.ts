import { type RemoveAgentResponse } from '@hanzo-app/message/api/agents/types';
import { type Token } from '@hanzo-app/message/api/general/types';

export type RemoveAgentInput = Token & {
  nodeAddress: string;
  agentId: string;
};
export type RemoveAgentOutput = RemoveAgentResponse;
