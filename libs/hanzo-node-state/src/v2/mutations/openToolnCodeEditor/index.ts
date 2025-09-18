import { openToolInCodeEditor as openToolInCodeEditorApi } from '@hanzo-app/message/api/tools/index';

import {
  type OpenToolInCodeEditorInput,
  type OpenToolInCodeEditorOutput,
} from './types';

export const openToolInCodeEditor = async ({
  nodeAddress,
  token,
  language,
  xHanzoAppId,
  xHanzoToolId,
  xHanzoLLMProvider,
}: OpenToolInCodeEditorInput): Promise<OpenToolInCodeEditorOutput> => {
  const response = await openToolInCodeEditorApi(
    nodeAddress,
    token,
    { language },
    xHanzoAppId,
    xHanzoToolId,
    xHanzoLLMProvider,
  );
  return response;
};
export * from './useOpenToolInCodeEditor';
