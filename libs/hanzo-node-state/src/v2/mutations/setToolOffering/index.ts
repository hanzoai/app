import { setToolOffering as setToolOfferingApi } from '@hanzo-app/message/api/tools/index';

import { type SetToolOfferingInput } from './types';

export const setToolOffering = async ({
  nodeAddress,
  token,
  offering,
}: SetToolOfferingInput) => {
  const response = await setToolOfferingApi(nodeAddress, token, {
    tool_offering: offering,
  });
  return response;
};
export * from './useSetToolOffering';
