import { downloadFile as downloadFileApi } from '@hanzo-app/message/api/jobs/index';

import { type GetDownloadFileInput } from './types';

export const downloadFile = async ({
  nodeAddress,
  token,
  path,
}: GetDownloadFileInput) => {
  return await downloadFileApi(nodeAddress, token, { path });
};
export * from './useGetDownloadFile';
