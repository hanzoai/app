import { type Token } from '@hanzo-app/message/api/general/types';
import { type GetToolsWithOfferingsResponse } from '@hanzo-app/message/api/tools/types';

export type GetToolsWithOfferingsInput = Token & {
  nodeAddress: string;
};

export type GetToolsWithOfferingsOutput = GetToolsWithOfferingsResponse;
