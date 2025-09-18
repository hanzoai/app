import { uploadFilesToVR } from '@hanzo-app/message/api/vector-fs/index';

import { type UploadVRFilesInput } from './types';

export const uploadVRFiles = async ({
  nodeAddress,
  token,
  destinationPath,
  files,
}: UploadVRFilesInput) => {
  const response = await uploadFilesToVR(
    nodeAddress,
    token,
    destinationPath,
    files,
  );

  return response;
};
export * from './useUploadVRFiles';
