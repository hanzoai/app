import { type Token } from '@hanzo-app/message/api/general/types';
import {
  type HanzoTool,
  type HanzoToolType,
  type UpdateToolResponse,
} from '@hanzo-app/message/api/tools/types';

export type UpdateToolOutput = UpdateToolResponse;

export type UpdateToolInput = Token & {
  nodeAddress: string;
  toolKey: string;
  toolType: HanzoToolType;
  toolPayload: HanzoTool;
  isToolEnabled: boolean;
};
