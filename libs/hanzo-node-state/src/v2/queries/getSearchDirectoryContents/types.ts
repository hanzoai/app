import { type Token } from '@hanzo-app/message/api/general/types';
import { type GetSearchDirectoryContentsResponse } from '@hanzo-app/message/api/vector-fs/types';

export type GetSearchDirectoryContentsInput = Token & {
  nodeAddress: string;
  name: string;
};
export type GetSearchDirectoryContentsOutput =
  GetSearchDirectoryContentsResponse;
