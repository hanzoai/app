import { getPreferences as getPreferencesApi } from '@hanzo-app/message/api/general/index';

import { type GetPreferencesInput } from './types';

export const getPreferences = async ({
  nodeAddress,
  token,
}: GetPreferencesInput) => {
  const preferences = await getPreferencesApi(nodeAddress, token);
  return preferences;
};
export * from './useGetPreferences';
