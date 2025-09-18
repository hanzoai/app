import { type Token } from '@hanzo-app/message/api/general/types';
import {
  type GetToolsCategory,
  type GetToolsResponse,
} from '@hanzo-app/message/api/tools/types';

export type GetToolsListInput = Token & {
  nodeAddress: string;
  category?: GetToolsCategory;
};

export type GetToolsListOutput = GetToolsResponse;
