import {
  type CustomToolHeaders,
  type Token,
} from '@hanzo-app/message/api/general/types';

export type RemoveAssetToToolInput = Token &
  CustomToolHeaders & {
    nodeAddress: string;
    filename: string;
  };

export type RemoveAssetToToolOutput = {
  success: boolean;
};
