import { type Token } from '@hanzo-app/message/api/general/types';
import { type ImportToolZipResponse } from '@hanzo-app/message/api/tools/types';

export type ImportToolFromZipInput = Token & {
  nodeAddress: string;
  file: File;
};

export type ImportToolFromZipOutput = ImportToolZipResponse;
