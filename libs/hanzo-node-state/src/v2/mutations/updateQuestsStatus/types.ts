import { type Token } from '@hanzo-app/message/api/general/types';
import { type UpdateQuestsStatusResponse } from '@hanzo-app/message/api/quests/types';

export type UpdateQuestsStatusInput = Token & {
  nodeAddress: string;
};

export type UpdateQuestsStatusOutput = UpdateQuestsStatusResponse;
