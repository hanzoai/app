import type { LoaderFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { providerBaseUrlEnvKeys } from '~/utils/constants';

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider');

  if (!provider || !providerBaseUrlEnvKeys[provider].apiTokenKey) {
    return json({ isSet: false });
  }

  const envVarName = providerBaseUrlEnvKeys[provider].apiTokenKey;
  const isSet = !!import.meta.env[envVarName];

  return json({ isSet });
};
