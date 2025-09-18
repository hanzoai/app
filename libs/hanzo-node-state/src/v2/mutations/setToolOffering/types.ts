import { type Token } from '@hanzo-app/message/api/general/types';
import {
  type ToolOffering,
  type SetToolOfferingResponse,
} from '@hanzo-app/message/api/tools/types';

export type SetToolOfferingOutput = SetToolOfferingResponse;

export type SetToolOfferingInput = Token & {
  nodeAddress: string;
  offering: ToolOffering;
};
