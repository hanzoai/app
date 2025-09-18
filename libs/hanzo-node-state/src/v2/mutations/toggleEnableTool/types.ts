import { type Token } from '@hanzo-app/message/api/general/types';
import { type ToggleEnableToolResponse } from '@hanzo-app/message/api/tools/types';

export type ToggleEnableToolOutput = ToggleEnableToolResponse;

export type ToggleEnableToolInput = Token & {
  nodeAddress: string;
  toolKey: string;
  isToolEnabled: boolean;
};
