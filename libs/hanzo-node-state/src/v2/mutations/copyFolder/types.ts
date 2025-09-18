import { type Token } from '@hanzo-app/message/api/general/types';
import { type CopyFolderResponse } from '@hanzo-app/message/api/vector-fs/types';

export type CopyFolderOutput = CopyFolderResponse;

export type CopyFolderInput = Token & {
  nodeAddress: string;
  originPath: string;
  destinationPath: string;
};
