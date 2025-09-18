import { getPlatformSync } from '../platform-utils';
import { ModelProvider } from '../../components/ais/constants';
import OLLAMA_MODELS_REPOSITORY from './ollama-models-repository.json';

export enum OllamaModelQuality {
  Low = 'low',
  Medium = 'medium',
  Good = 'good',
}

export enum OllamaModelSpeed {
  Average = 'average',
  Fast = 'fast',
  VeryFast = 'very-fast',
}

export enum OllamaModelCapability {
  TextGeneration = 'text-generation',
  ImageToText = 'image-to-text',
  Thinking = 'thinking',
  ToolCalling = 'tool-calling',
}

export interface OllamaModel {
  model: string;
  tag: string;
  name: string;
  description: string;
  contextLength: number;
  quality: OllamaModelQuality;
  speed: OllamaModelSpeed;
  capabilities: OllamaModelCapability[];
  size: number; // Size in GB
  fullName: string;
  provider?: string;
}
export type OllamaModelDefinition =
  (typeof FILTERED_OLLAMA_MODELS_REPOSITORY)[0];

export const FILTERED_OLLAMA_MODELS_REPOSITORY =
  OLLAMA_MODELS_REPOSITORY.filter((model) => !model.embedding);
export const ALLOWED_OLLAMA_MODELS = FILTERED_OLLAMA_MODELS_REPOSITORY.flatMap(
  (model) => model.tags.map((tag) => tag.name),
);

// Use safe platform detection that works in all contexts
const currentPlatform = getPlatformSync();

export const OLLAMA_MODELS: OllamaModel[] = [
  ...(currentPlatform === 'windows' || currentPlatform === 'linux'
    ? [
        {
          model: 'gpt-oss',
          tag: '20b',
          name: 'gpt-oss',
          description:
            'OpenAI’s open-weight models designed for powerful reasoning, agentic tasks, and versatile developer use cases.',
          contextLength: 32000,
          quality: OllamaModelQuality.Good,
          speed: OllamaModelSpeed.Fast,
          capabilities: [
            OllamaModelCapability.TextGeneration,
            OllamaModelCapability.Thinking,
            OllamaModelCapability.ToolCalling,
          ],
          size: 7.5,
          fullName: '',
          provider: ModelProvider.OpenAI,
        },
        {
          model: 'llama3.1',
          tag: '8b-instruct-q4_1',
          name: 'Llama 3.1 8b',
          description:
            'A powerful AI model for understanding and generating text, optimized for tasks like writing and processing language',
          contextLength: 128000,
          quality: OllamaModelQuality.Medium,
          speed: OllamaModelSpeed.Fast,
          capabilities: [
            OllamaModelCapability.TextGeneration,
            OllamaModelCapability.ToolCalling,
          ],
          size: 4.7,
          fullName: '',
          provider: ModelProvider.Meta,
        },
      ]
    : []),
  ...(currentPlatform === 'macos'
    ? [
        {
          model: 'gpt-oss',
          tag: '20b',
          name: 'gpt-oss',
          description:
            'OpenAI’s open-weight models designed for powerful reasoning, agentic tasks, and versatile developer use cases.',
          contextLength: 128000,
          quality: OllamaModelQuality.Good,
          speed: OllamaModelSpeed.Fast,
          capabilities: [
            OllamaModelCapability.TextGeneration,
            OllamaModelCapability.Thinking,
            OllamaModelCapability.ToolCalling,
          ],
          size: 14,
          fullName: '',
          provider: ModelProvider.OpenAI,
          platforms: ['macos'],
        },
        {
          model: 'mistral-small3.2',
          tag: '24b-instruct-2506-q4_K_M',
          name: 'Mistral Small 3.2',
          description:
            'An update to Mistral Small that improves function calling, instruction following, and reduces repetition errors.',
          contextLength: 128000,
          quality: OllamaModelQuality.Medium,
          speed: OllamaModelSpeed.Fast,
          capabilities: [
            OllamaModelCapability.TextGeneration,
            OllamaModelCapability.ImageToText,
            OllamaModelCapability.ToolCalling,
          ],
          size: 15,
          fullName: '',
          provider: ModelProvider.Mistral,
          platforms: ['macos'],
        },
      ]
    : []),
  // Qwen3 Models - from smallest to largest
  {
    model: 'qwen3',
    tag: '1.7b',
    name: 'Qwen3 1.7B Nano',
    description:
      'Qwen3 1.7B is an ultra-lightweight model perfect for quick tasks, basic conversations, and edge deployment while maintaining surprisingly good performance.',
    contextLength: 32768,
    quality: OllamaModelQuality.Good,
    speed: OllamaModelSpeed.VeryFast,
    capabilities: [
      OllamaModelCapability.TextGeneration,
      OllamaModelCapability.ToolCalling,
    ],
    size: 1.4,
    fullName: '',
    provider: ModelProvider.Qwen,
    platforms: ['windows', 'linux', 'macos'],
  },
  {
    model: 'qwen3',
    tag: '4b',
    name: 'Qwen3 4B',
    description:
      'Qwen3 4B provides excellent balance between size and capability, ideal for coding, reasoning, and general conversation with fast response times.',
    contextLength: 32768,
    quality: OllamaModelQuality.Good,
    speed: OllamaModelSpeed.Fast,
    capabilities: [
      OllamaModelCapability.TextGeneration,
      OllamaModelCapability.ToolCalling,
    ],
    size: 2.5,
    fullName: '',
    provider: ModelProvider.Qwen,
    platforms: ['windows', 'linux', 'macos'],
  },
  {
    model: 'qwen3-coder',
    tag: '32b-q4',
    name: 'Qwen3-Coder 32B (4-bit)',
    description:
      'Qwen3-Coder 32B is a specialized coding model with exceptional programming capabilities across 100+ languages, optimized with 4-bit quantization for efficiency.',
    contextLength: 128000,
    quality: OllamaModelQuality.Good,
    speed: OllamaModelSpeed.Average,
    capabilities: [
      OllamaModelCapability.TextGeneration,
      OllamaModelCapability.ToolCalling,
    ],
    size: 18.5,
    fullName: '',
    provider: ModelProvider.Qwen,
    platforms: ['windows', 'linux', 'macos'],
  },
  {
    model: 'qwen3-next',
    tag: '80b-3b-active',
    name: 'Qwen3-Next 80B (3B Active)',
    description:
      'Qwen3-Next 80B is a cutting-edge mixture-of-experts model with 80B total parameters but only 3B active, delivering GPT-4 level performance with incredible efficiency.',
    contextLength: 128000,
    quality: OllamaModelQuality.Good,
    speed: OllamaModelSpeed.Fast,
    capabilities: [
      OllamaModelCapability.TextGeneration,
      OllamaModelCapability.Thinking,
      OllamaModelCapability.ToolCalling,
    ],
    size: 42.0,
    fullName: '',
    provider: ModelProvider.Qwen,
    platforms: ['windows', 'linux', 'macos'],
  },
  {
    model: 'deepseek-r1',
    tag: '70b',
    name: 'DeepSeek R1 70B',
    description:
      'DeepSeek R1 70B is a powerful reasoning model achieving performance comparable to OpenAI-o1 across math, code, and reasoning tasks. It is derived from Llama3.3-70B-Instruct and optimized through distillation from larger models.',
    contextLength: 128000,
    quality: OllamaModelQuality.Good,
    speed: OllamaModelSpeed.Average,
    capabilities: [
      OllamaModelCapability.TextGeneration,
      OllamaModelCapability.Thinking,
      OllamaModelCapability.ToolCalling,
    ],
    size: 40.2,
    fullName: '',
    provider: ModelProvider.DeepSeek,
    platforms: ['windows', 'linux', 'macos'],
  },
].map((model) => {
  model.fullName = `${model.model}:${model.tag}` as const;
  return model;
});
