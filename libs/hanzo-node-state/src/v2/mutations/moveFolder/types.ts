import { type Token } from '@hanzo-app/message/api/general/types';
import { type MoveFolderResponse } from '@hanzo-app/message/api/vector-fs/types';

export type MoveFolderOutput = MoveFolderResponse;

export type MoveVRFolderInput = Token & {
  nodeAddress: string;
  originPath: string;
  destinationPath: string;
};
