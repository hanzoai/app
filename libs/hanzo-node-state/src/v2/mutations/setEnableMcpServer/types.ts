import { Token } from '@hanzo-app/message/api/general/types';

export type SetEnableMcpServerOutput = {
  success: boolean;
};

export type SetEnableMcpServerInput = Token & {
  nodeAddress: string;
  mcpServerId: number;
  isEnabled: boolean;
};
