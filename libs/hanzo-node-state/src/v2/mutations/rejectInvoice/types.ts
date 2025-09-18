import { type Token } from '@hanzo-app/message/api/general/types';
import { type RejectInvoiceRequest } from '@hanzo-app/message/api/tools/types';

export type RejectInvoiceOutput = any;

export type RejectInvoiceInput = Token & {
  nodeAddress: string;
  payload: RejectInvoiceRequest;
};
