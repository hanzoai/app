import { type Token } from '@hanzo-app/message/api/general/types';
import { type RemoveFsItemResponse } from '@hanzo-app/message/api/vector-fs/types';

export type RemoveFsItemOutput = RemoveFsItemResponse;
export type RemoveFsItemInput = Token & {
  nodeAddress: string;
  itemPath: string;
};
