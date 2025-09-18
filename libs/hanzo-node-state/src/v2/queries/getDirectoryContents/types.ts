import { type Token } from '@hanzo-app/message/api/general/types';
import { type DirectoryContent } from '@hanzo-app/message/api/vector-fs/types';
import { type QueryObserverOptions } from '@tanstack/react-query';

import { type FunctionKeyV2 } from '../../constants';

export type GetVRPathSimplifiedInput = Token & {
  nodeAddress: string;
  path: string;
  depth?: number;
};

export type UseGetDirectoryContents = [
  FunctionKeyV2.GET_VR_FILES,
  GetVRPathSimplifiedInput,
];

export type GetVRPathSimplifiedOutput = DirectoryContent[];

export type Options = QueryObserverOptions<
  GetVRPathSimplifiedOutput,
  Error,
  GetVRPathSimplifiedOutput,
  GetVRPathSimplifiedOutput,
  UseGetDirectoryContents
>;
