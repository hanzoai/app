import { type ActionFunctionArgs } from '@remix-run/node';
import { streamText } from '~/lib/.server/llm/stream-text';
import type { IProviderSetting, ProviderInfo } from '~/types/model';
import { generateText } from 'ai';
import { PROVIDER_LIST } from '~/utils/constants';
import { MAX_TOKENS } from '~/lib/.server/llm/constants';
import { LLMManager } from '~/lib/modules/llm/manager';
import type { ModelInfo } from '~/lib/modules/llm/types';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';
import { createScopedLogger } from '~/utils/logger';

export async function action(args: ActionFunctionArgs) {
  return llmCallAction(args);
}

async function getModelList(options: {
  apiKeys?: Record<string, string>;
  providerSettings?: Record<string, IProviderSetting>;
  serverEnv?: Record<string, string>;
}) {
  const llmManager = LLMManager.getInstance(import.meta.env);
  logger.debug('Updating model list with options', { options });

  const models = await llmManager.updateModelList(options);
  logger.debug('Model list updated', { models: models.map((m: ModelInfo) => m.name) });

  return models;
}

const logger = createScopedLogger('api.llmcall');

async function llmCallAction({ context, request }: ActionFunctionArgs) {
  logger.debug('Received context', { context });

  const payload = await request.json();
  logger.debug('Request payload received', { payload });

  const { system, message, model, provider, streamOutput } = payload as {
    system: string;
    message: string;
    model: string;
    provider: ProviderInfo;
    streamOutput?: boolean;
  };

  const { name: providerName } = provider;

  if (!model || typeof model !== 'string') {
    logger.error('Invalid or missing model', { model });
    throw new Response('Invalid or missing model', {
      status: 400,
      statusText: 'Bad Request',
    });
  }

  if (!providerName || typeof providerName !== 'string') {
    logger.error('Invalid or missing provider', { provider });
    throw new Response('Invalid or missing provider', {
      status: 400,
      statusText: 'Bad Request',
    });
  }

  const cookieHeader = request.headers.get('Cookie');
  logger.debug('Cookie header', { cookieHeader });

  const apiKeys = getApiKeysFromCookie(cookieHeader);
  const providerSettingsRaw = getProviderSettingsFromCookie(cookieHeader);
  logger.debug('Extracted apiKeys and providerSettingsRaw', { apiKeys, providerSettingsRaw });

  if (streamOutput) {
    try {
      logger.info('Initiating streamText', { system, providerName, model, message });

      const result = await streamText({
        options: { system },
        messages: [{ role: 'user', content: message }],
        env: import.meta.env,
        apiKeys,
        providerSettings: providerSettingsRaw,
      });
      logger.info('streamText call successful');

      return new Response(result.textStream, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : 'no stack available';
      logger.error('Error during streamText', { error: errMsg, stack: errStack });
      console.log('streamText error', error);

      if (error instanceof Error && error.message?.includes('API key')) {
        throw new Response('Invalid or missing API key', {
          status: 401,
          statusText: 'Unauthorized',
        });
      }

      throw new Response(null, {
        status: 500,
        statusText: 'Internal Server Error',
      });
    }
  } else {
    try {
      logger.info('Fetching model list for provider', { providerName });

      const models = await getModelList({
        apiKeys,
        providerSettings: providerSettingsRaw ? { [providerName]: providerSettingsRaw } : undefined,
        serverEnv: import.meta.env,
      });
      const modelDetails = models.find((m: ModelInfo) => m.name === model);

      if (!modelDetails) {
        logger.error('Model not found', {
          requestedModel: model,
          availableModels: models.map((m: ModelInfo) => m.name),
        });
        throw new Error('Model not found');
      }

      const dynamicMaxTokens = modelDetails.maxTokenAllowed || MAX_TOKENS;
      logger.debug('Selected model details', { model: modelDetails.name, dynamicMaxTokens });

      const providerInfo = PROVIDER_LIST.find((p) => p.name === provider.name);

      if (!providerInfo) {
        logger.error('Provider not found in list', { providerName });
        throw new Error('Provider not found');
      }

      logger.info('Generating text response', {
        provider: provider.name,
        model: modelDetails.name,
        dynamicMaxTokens,
      });

      const modelInstance = providerInfo.getModelInstance({
        model: modelDetails.name,
        serverEnv: import.meta.env,
        apiKeys,
        providerSettings: providerSettingsRaw,
      });
      logger.debug('Obtained model instance', { modelInstance });

      const result = await generateText({
        system,
        messages: [{ role: 'user', content: message }],
        model: modelInstance,
        maxTokens: dynamicMaxTokens,
        toolChoice: 'none',
      });
      logger.info('Text generation successful');
      logger.debug('Generation result', { result });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : 'no stack available';
      logger.error('Error during generateText', { error: errMsg, stack: errStack });
      console.log('generateText error', error);

      if (error instanceof Error && error.message?.includes('API key')) {
        throw new Response('Invalid or missing API key', {
          status: 401,
          statusText: 'Unauthorized',
        });
      }

      throw new Response(null, {
        status: 500,
        statusText: 'Internal Server Error',
      });
    }
  }
}
