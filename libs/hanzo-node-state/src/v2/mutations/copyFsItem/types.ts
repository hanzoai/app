import { type Token } from '@hanzo-app/message/api/general/types';
import { type CopyFsItemResponse } from '@hanzo-app/message/api/vector-fs/types';

export type CopyVRItemOutput = CopyFsItemResponse;

export type CopyVRItemInput = Token & {
  nodeAddress: string;
  originPath: string;
  destinationPath: string;
};
