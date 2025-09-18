import { stopGeneratingLLM as stopGeneratingLLMApi } from '@hanzo-app/message/api/jobs/index';

import { type StopGeneratingLLMInput } from './types';

export const stopGeneratingLLM = async ({
  nodeAddress,
  token,
  jobId,
}: StopGeneratingLLMInput) => {
  const response = await stopGeneratingLLMApi(nodeAddress, token, jobId);
  return response;
};
export * from './useStopGeneratingLLM';
