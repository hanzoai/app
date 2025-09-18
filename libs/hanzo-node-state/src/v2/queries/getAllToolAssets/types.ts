import {
  type CustomToolHeaders,
  type Token,
} from '@hanzo-app/message/api/general/types';
import { type GetAllToolAssetsResponse } from '@hanzo-app/message/api/tools/types';

export type GetAllToolAssetsInput = Token &
  CustomToolHeaders & {
    nodeAddress: string;
  };

export type GetAllToolAssetsOutput = GetAllToolAssetsResponse;
