import { type Token } from '@hanzo-app/message/api/general/types';
import { type MoveFsItemResponse } from '@hanzo-app/message/api/vector-fs/types';

export type MoveFsItemOutput = MoveFsItemResponse;

export type MoveFsItemInput = Token & {
  nodeAddress: string;
  originPath: string;
  destinationPath: string;
};
