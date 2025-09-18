import { type Token } from '@hanzo-app/message/api/general/types';
import {
  type PayInvoiceRequest,
  type PayInvoiceResponse,
} from '@hanzo-app/message/api/tools/types';

export type PayInvoiceOutput = PayInvoiceResponse;

export type PayInvoiceInput = Token & {
  nodeAddress: string;
  payload: PayInvoiceRequest;
};
