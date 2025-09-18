import { type Token } from '@hanzo-app/message/api/general/types';
import { type CreateFolderResponse } from '@hanzo-app/message/api/vector-fs/types';

export type CreateFolderInput = Token & {
  nodeAddress: string;
  path: string;
  folderName: string;
};

export type CreateFolderOutput = CreateFolderResponse;
