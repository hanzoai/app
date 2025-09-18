import { removeAgent as removeAgentApi } from '@hanzo-app/message/api/agents/index';

import { type RemoveAgentInput } from './types';

export const removeAgent = async ({
  nodeAddress,
  token,
  agentId,
}: RemoveAgentInput) => {
  const data = await removeAgentApi(nodeAddress, token, {
    agent_id: agentId,
  });
  return data;
};
export * from './useRemoveAgent';
