import { type NetworkToolWithOffering } from '@hanzo/message/api/tools/types';

export type FormattedNetworkAgent = {
  id: string;
  name: string;
  description: string;
  price: string;
  category: string;
  provider: string;
  toolRouterKey: string;
  apiData: NetworkToolWithOffering;
};
