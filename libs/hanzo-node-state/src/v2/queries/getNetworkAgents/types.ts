import {
  type NetworkToolNode,
  type NetworkToolWithOffering,
} from '@hanzo-app/message/api/tools/types';

export type FormattedNetworkAgent = {
  id: string;
  name: string;
  description: string;
  price: string;
  category: string;
  provider: string;
  toolRouterKey: string;
  apiData: NetworkToolWithOffering;
  node: NetworkToolNode;
};

export type GetNetworkAgentsOutput = FormattedNetworkAgent[];
