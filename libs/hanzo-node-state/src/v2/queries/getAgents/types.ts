import { type GetAgentsResponse } from '@hanzo-app/message/api/agents/types';
import { type Token } from '@hanzo-app/message/api/general/types';

export type GetAgentsInput = Token & {
  nodeAddress: string;
  categoryFilter?: 'recently_used';
};

export type GetAgentsOutput = GetAgentsResponse;
