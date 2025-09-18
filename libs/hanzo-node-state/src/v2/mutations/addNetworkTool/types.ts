import { type Token } from '@hanzo-app/message/api/general/types';
import { type NetworkHanzoTool } from '@hanzo-app/message/api/tools/types';

export type AddNetworkToolInput = Token & {
  nodeAddress: string;
  networkTool: NetworkHanzoTool;
};
export type AddNetworkToolOutput = any;
