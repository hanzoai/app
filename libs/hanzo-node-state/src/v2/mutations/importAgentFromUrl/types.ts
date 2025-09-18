import { type Agent } from '@hanzo-app/message/api/agents/types';
import { type Token } from '@hanzo-app/message/api/general/types';

export type ImportAgentFromUrlInput = Token & {
  nodeAddress: string;
  url: string;
};

export type ImportAgentFromUrlOutput = Agent;
