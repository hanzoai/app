import { getAllPrompts as getPromptListAPI } from '@hanzo-app/message/api/tools/index';

import { type GetPromptListInput } from './types';

export const getPromptList = async ({
  nodeAddress,
  token,
}: GetPromptListInput) => {
  const response = await getPromptListAPI(nodeAddress, token);
  return response;
};
export * from './useGetPromptList';
