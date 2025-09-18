import { type Token } from '@hanzo-app/message/api/general/types';
import { type RemoveFolderResponse } from '@hanzo-app/message/api/vector-fs/types';

export type RemoveFolderOutput = RemoveFolderResponse;

export type RemoveFolderInput = Token & {
  nodeAddress: string;
  folderPath: string;
};
