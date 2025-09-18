import { getNgrokStatus as getNgrokStatusApi } from '@hanzo-app/message/api/ngrok';
import { type GetNgrokStatusInput } from './types';

export const getNgrokStatus = async ({
  nodeAddress,
  token,
}: GetNgrokStatusInput) => {
  return await getNgrokStatusApi(nodeAddress, token);
};
export * from './useGetNgrokStatus';
