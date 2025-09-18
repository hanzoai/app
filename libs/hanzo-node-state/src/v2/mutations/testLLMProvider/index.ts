import { testLLMProvider as testLLMProviderApi } from '@hanzo-app/message/api/jobs/index';

import { type TestLLMProviderInput } from './types';

export const testLLMProvider = async ({
  nodeAddress,
  token,
  agent,
}: TestLLMProviderInput) => {
  const response = await testLLMProviderApi(nodeAddress, token, agent);
  return response;
};
export * from './useTestLLMProvider';
