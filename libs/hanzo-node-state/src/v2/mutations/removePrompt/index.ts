import { removePrompt as removePromptApi } from '@hanzo-app/message/api/tools/index';

import { type RemovePromptInput } from './types';

export const removePrompt = async ({
  nodeAddress,
  token,
  promptName,
}: RemovePromptInput) => {
  return await removePromptApi(nodeAddress, token, {
    prompt_name: promptName,
  });
};
export * from './useRemovePrompt';
