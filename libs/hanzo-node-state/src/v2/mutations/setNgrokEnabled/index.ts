import { setNgrokEnabled as setNgrokEnabledApi } from '@hanzo-app/message/api/ngrok';
import { type SetNgrokEnabledInput } from './types';

export const setNgrokEnabled = async ({
  nodeAddress,
  token,
  enabled,
}: SetNgrokEnabledInput) => {
  return await setNgrokEnabledApi(nodeAddress, token, enabled);
};
export * from './useSetNgrokEnabled';
