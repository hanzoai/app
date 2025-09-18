import { type Token } from '@hanzo-app/message/api/general/types';
import { type UpdateToolCodeImplementationResponse } from '@hanzo-app/message/api/tools/types';

export type UpdateToolCodeImplementationInput = Token & {
  nodeAddress: string;
  jobId: string;
  code: string;
};

export type UpdateToolCodeImplementationOutput =
  UpdateToolCodeImplementationResponse;
