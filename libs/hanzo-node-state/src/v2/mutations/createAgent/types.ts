import {
  type Agent,
  type CreateAgentResponse,
} from '@hanzo-app/message/api/agents/types';
import { type Token } from '@hanzo-app/message/api/general/types';

export type CreateAgentOutput = CreateAgentResponse;

export type CreateAgentInput = Token & {
  nodeAddress: string;
  agent: Agent;
  cronExpression?: string;
};
