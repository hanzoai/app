import { updateAgent as updateAgentApi } from '@hanzo-app/message/api/agents/index';

import { type UpdateAgentInput } from './types';

export const updateAgent = async ({
  nodeAddress,
  token,
  agent,
}: UpdateAgentInput) => {
  const response = await updateAgentApi(nodeAddress, token, {
    ...agent,
  });
  return response;
};
export * from './useUpdateAgent';
