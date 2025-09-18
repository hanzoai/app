import {
  type CustomToolHeaders,
  type Token,
} from '@hanzo-app/message/api/general/types';

export type UploadAssetsToToolInput = Token &
  CustomToolHeaders & {
    nodeAddress: string;
    files: File[];
  };

export type UploadAssetsToToolOutput = {
  success: boolean;
};
