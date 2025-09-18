export enum OnboardingStep {
  TERMS_CONDITIONS = 'terms-conditions',
  ANALYTICS = 'analytics',
  NETWORK_SETUP = 'network-setup',
  MODEL_SELECTION = 'model-selection',
}

export type OnboardingStepConfig = {
  id: OnboardingStep;
  path: string;
  required: boolean;
};

export const COMPLETION_DESTINATION = '/home';

export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  {
    id: OnboardingStep.TERMS_CONDITIONS,
    path: '/terms-conditions',
    required: true,
  },
  {
    id: OnboardingStep.ANALYTICS,
    path: '/analytics',
    required: true,
  },
  {
    id: OnboardingStep.NETWORK_SETUP,
    path: '/network-setup',
    required: false, // Optional step - users can skip
  },
  {
    id: OnboardingStep.MODEL_SELECTION,
    path: '/install-ai-models',
    required: true,
  },
];

export enum ProviderSelectionUser {
  CLOUD = 'cloud',
  LOCAL = 'local',
  FREE = 'free',
}

type TermsChoice = boolean;
type AnalyticsChoice = boolean;
type ModelSelectionChoice = boolean;
type NetworkSetupChoice = {
  exposureType: 'none' | 'localxpose' | 'ngrok' | 'public';
  apiKey?: string;
  customDomain?: string;
  enableRouter?: boolean;
  walletAddress?: string;
};

export type StepChoiceMap = {
  [OnboardingStep.TERMS_CONDITIONS]: TermsChoice | null;
  [OnboardingStep.ANALYTICS]: AnalyticsChoice | null;
  [OnboardingStep.NETWORK_SETUP]: NetworkSetupChoice | null;
  [OnboardingStep.MODEL_SELECTION]: ModelSelectionChoice | null;
};

export type OnboardingState = {
  steps: {
    [K in OnboardingStep]?: {
      completed: boolean;
      choice: StepChoiceMap[K];
    };
  };
};

export function validateChoice<T extends OnboardingStep>(
  stepId: T,
  choice: any,
): StepChoiceMap[T] {
  switch (stepId) {
    case OnboardingStep.TERMS_CONDITIONS:
      return (typeof choice === 'boolean' ? choice : null) as StepChoiceMap[T];
    case OnboardingStep.ANALYTICS:
      return (typeof choice === 'boolean' ? choice : null) as StepChoiceMap[T];
    case OnboardingStep.NETWORK_SETUP:
      // Network setup is optional, and stores complex config
      return (
        choice && typeof choice === 'object' ? choice : null
      ) as StepChoiceMap[T];
    case OnboardingStep.MODEL_SELECTION:
      return (typeof choice === 'boolean' ? choice : null) as StepChoiceMap[T];
    default:
      return null as StepChoiceMap[T];
  }
}
