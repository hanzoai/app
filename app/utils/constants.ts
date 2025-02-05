import { LLMManager } from '~/lib/modules/llm/manager';
import type { Template } from '~/types/template';

export const WORK_DIR_NAME = 'project';
export const WORK_DIR = `/home/${WORK_DIR_NAME}`;
export const MODIFICATIONS_TAG_NAME = 'hanzo_file_modifications';
export const MODEL_REGEX = /^\[Model: (.*?)\]\n\n/;
export const PROVIDER_REGEX = /\[Provider: (.*?)\]\n\n/;
export const DEFAULT_MODEL = 'claude-3-5-sonnet-latest';
export const PROMPT_COOKIE_KEY = 'cachedPrompt';

const llmManager = LLMManager.getInstance(import.meta.env);

export const PROVIDER_LIST = llmManager.getAllProviders();
export const DEFAULT_PROVIDER = llmManager.getDefaultProvider();

export const providerBaseUrlEnvKeys: Record<string, { baseUrlKey?: string; apiTokenKey?: string }> = {};
PROVIDER_LIST.forEach((provider) => {
  providerBaseUrlEnvKeys[provider.name] = {
    baseUrlKey: provider.config.baseUrlKey,
    apiTokenKey: provider.config.apiTokenKey,
  };
});

// starter Templates

export const STARTER_TEMPLATES: Template[] = [
  {
    name: 'hanzo-astro-basic',
    label: 'Astro Basic',
    description: 'Lightweight Astro starter template for building fast static websites',
    githubRepo: 'hanzo-app/astro-basic',
    tags: ['astro', 'blog', 'performance'],
    icon: 'i-hanzo:astro',
  },
  {
    name: 'hanzo-nextjs-shadcn',
    label: 'Next.js with shadcn/ui',
    description: 'Next.js starter fullstack template integrated with shadcn/ui components and styling system',
    githubRepo: 'hanzo-app/nextjs-shadcn',
    tags: ['nextjs', 'react', 'typescript', 'shadcn', 'tailwind'],
    icon: 'i-hanzo:nextjs',
  },
  {
    name: 'hanzo-qwik-ts',
    label: 'Qwik TypeScript',
    description: 'Qwik framework starter with TypeScript for building resumable applications',
    githubRepo: 'hanzo-app/qwik-ts-template',
    tags: ['qwik', 'typescript', 'performance', 'resumable'],
    icon: 'i-hanzo:qwik',
  },
  {
    name: 'hanzo-remix-ts',
    label: 'Remix TypeScript',
    description: 'Remix framework starter with TypeScript for full-stack web applications',
    githubRepo: 'hanzo-app/remix-ts-template',
    tags: ['remix', 'typescript', 'fullstack', 'react'],
    icon: 'i-hanzo:remix',
  },
  {
    name: 'hanzo-slidev',
    label: 'Slidev Presentation',
    description: 'Slidev starter template for creating developer-friendly presentations using Markdown',
    githubRepo: 'hanzo-app/slidev-template',
    tags: ['slidev', 'presentation', 'markdown'],
    icon: 'i-hanzo:slidev',
  },
  {
    name: 'hanzo-sveltekit',
    label: 'SvelteKit',
    description: 'SvelteKit starter template for building fast, efficient web applications',
    githubRepo: 'hanzo-app/sveltekit-template',
    tags: ['svelte', 'sveltekit', 'typescript'],
    icon: 'i-hanzo:svelte',
  },
  {
    name: 'vanilla-vite',
    label: 'Vanilla + Vite',
    description: 'Minimal Vite starter template for vanilla JavaScript projects',
    githubRepo: 'hanzo-app/vanilla-vite-template',
    tags: ['vite', 'vanilla-js', 'minimal'],
    icon: 'i-hanzo:vite',
  },
  {
    name: 'hanzo-vite-react',
    label: 'React + Vite + typescript',
    description: 'React starter template powered by Vite for fast development experience',
    githubRepo: 'hanzo-app/vite-react-ts-template',
    tags: ['react', 'vite', 'frontend'],
    icon: 'i-hanzo:react',
  },
  {
    name: 'hanzo-vite-ts',
    label: 'Vite + TypeScript',
    description: 'Vite starter template with TypeScript configuration for type-safe development',
    githubRepo: 'hanzo-app/vite-ts-template',
    tags: ['vite', 'typescript', 'minimal'],
    icon: 'i-hanzo:typescript',
  },
  {
    name: 'hanzo-vue',
    label: 'Vue.js',
    description: 'Vue.js starter template with modern tooling and best practices',
    githubRepo: 'hanzo-app/vue-template',
    tags: ['vue', 'typescript', 'frontend'],
    icon: 'i-hanzo:vue',
  },
  {
    name: 'hanzo-angular',
    label: 'Angular Starter',
    description: 'A modern Angular starter template with TypeScript support and best practices configuration',
    githubRepo: 'hanzo-app/angular-template',
    tags: ['angular', 'typescript', 'frontend', 'spa'],
    icon: 'i-hanzo:angular',
  },
];
