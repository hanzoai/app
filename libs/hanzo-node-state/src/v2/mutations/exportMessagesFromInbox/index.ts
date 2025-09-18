import { exportMessagesFromInbox as exportMessagesFromInboxApi } from '@hanzo-app/message/api/jobs/index';

import { type ExportMessagesFromInboxInput } from './types';

export const exportMessagesFromInbox = async ({
  nodeAddress,
  token,
  inboxId,
  format,
}: ExportMessagesFromInboxInput) => {
  return await exportMessagesFromInboxApi(nodeAddress, token, {
    inbox_name: inboxId,
    format,
  });
};
export * from './useExportMessagesFromInbox';
