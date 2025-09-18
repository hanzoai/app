import { restoreToolConversation as restoreToolConversationApi } from '@hanzo-app/message/api/tools/index';

import { type RestoreToolConversationInput } from './types';

export const restoreToolConversation = async ({
  nodeAddress,
  token,
  jobId,
  messageId,
}: RestoreToolConversationInput) => {
  return await restoreToolConversationApi(nodeAddress, token, {
    job_id: jobId,
    message_hash: messageId,
  });
};
export * from './useRestoreToolConversation';
