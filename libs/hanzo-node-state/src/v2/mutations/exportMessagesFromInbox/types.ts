import { type Token } from '@hanzo-app/message/api/general/types';

export type ExportMessagesFromInboxInput = Token & {
  nodeAddress: string;
  inboxId: string;
  format: 'csv' | 'json' | 'txt';
};

export type ExportMessagesFromInboxOutput = Blob;
