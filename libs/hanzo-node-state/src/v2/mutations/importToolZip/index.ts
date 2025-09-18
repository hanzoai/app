import { importToolZip as importToolZipApi } from '@hanzo-app/message/api/tools/index';

import { type ImportToolFromZipInput } from './types';

export const importToolFromZip = async ({
  nodeAddress,
  token,
  file,
}: ImportToolFromZipInput) => {
  return await importToolZipApi(nodeAddress, token, {
    file,
  });
};
export * from './useImportToolZip';
