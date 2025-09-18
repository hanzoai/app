import { type Token } from '@hanzo-app/message/api/general/types';
import { type GetQuestsStatusResponse } from '@hanzo-app/message/api/quests/types';

export type GetQuestsStatusInput = Token & {
  nodeAddress: string;
};

export type GetQuestsStatusOutput = GetQuestsStatusResponse;
