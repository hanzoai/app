import { getToolProtocols as getToolProtocolsApi } from '@hanzo-app/message/api/tools/index';

export const getToolProtocols = async () => {
  const response = await getToolProtocolsApi();
  return response;
};
export * from './types';
export * from './useGetToolProtocols';
