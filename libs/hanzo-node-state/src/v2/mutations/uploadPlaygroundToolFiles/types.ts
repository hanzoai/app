import {
  type CustomToolHeaders,
  type Token,
} from '@hanzo-app/message/api/general/types';

export type UploadPlaygroundToolFilesInput = Token &
  CustomToolHeaders & {
    nodeAddress: string;
    files: File[];
  };

export type UploadPlaygroundToolFilesOutput = {
  success: boolean;
  fileContent: Record<string, string>;
};
