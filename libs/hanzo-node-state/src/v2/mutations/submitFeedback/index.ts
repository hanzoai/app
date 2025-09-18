import { submitFeedback as submitFeedbackApi } from '@hanzo-app/message/api/external-services/index';

import { type SubmitFeedbackInput } from './types';

export const submitFeedback = async ({
  feedback,
  contact,
}: SubmitFeedbackInput) => {
  return await submitFeedbackApi({
    feedback,
    contact,
  });
};
export * from './useSubmitFeedback';
