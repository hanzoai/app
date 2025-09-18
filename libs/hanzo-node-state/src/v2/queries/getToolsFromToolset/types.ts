import { type Token } from '@hanzo-app/message/api/general/types';
import {
  type HanzoToolHeader,
  type HanzoToolType,
} from '@hanzo-app/message/api/tools/types';

export type GetToolsFromToolsetInput = Token & {
  nodeAddress: string;
  tool_set_key: string;
};

export type GetToolsFromToolsetOutput = {
  type: HanzoToolType;
  content: [HanzoToolHeader, boolean];
}[];
