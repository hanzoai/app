import { type GetAgentResponse } from '@hanzo-app/message/api/agents/types';
import { type Token } from '@hanzo-app/message/api/general/types';

export type GetAgentInput = Token & {
  nodeAddress: string;
  agentId: string;
};

export type GetAgentOutput = GetAgentResponse;
