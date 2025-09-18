import { getAgent as getAgentApi } from '@hanzo-app/message/api/agents/index';

import { type GetAgentInput } from './types';

export const getAgent = async ({
  nodeAddress,
  token,
  agentId,
}: GetAgentInput) => {
  const result = await getAgentApi(nodeAddress, token, {
    agentId,
  });
  return result;
};
export * from './useGetAgent';
