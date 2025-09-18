import { type Agent } from '@hanzo-app/message/api/agents/types';
import { type Token } from '@hanzo-app/message/api/general/types';

export type ImportAgentInput = Token & {
  nodeAddress: string;
  file: File;
};

export type ImportAgentOutput = Agent;
