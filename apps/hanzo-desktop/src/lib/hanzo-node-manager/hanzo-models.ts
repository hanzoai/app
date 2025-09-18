import { getPlatformSync } from '../platform-utils';

export enum HanzoModelQuality {
  Low = 'low',
  Medium = 'medium',
  Good = 'good',
  Excellent = 'excellent',
}

export enum HanzoModelSpeed {
  Slow = 'slow',
  Average = 'average',
  Fast = 'fast',
  VeryFast = 'very-fast',
}

export enum HanzoModelCapability {
  TextGeneration = 'text-generation',
  ImageToText = 'image-to-text',
  Thinking = 'thinking',
  ToolCalling = 'tool-calling',
  Code = 'code',
  Math = 'math',
  Vision = 'vision',
  Multilingual = 'multilingual',
}

export interface HanzoModel {
  id: string;
  name: string;
  description: string;
  size: number; // Size in GB
  contextLength: number;
  quality: HanzoModelQuality;
  speed: HanzoModelSpeed;
  capabilities: HanzoModelCapability[];
  provider?: string;
  huggingFaceUrl?: string;
  mlxUrl?: string;
  featured?: boolean;
  recommended?: boolean;
  tags?: string[];
}

const currentPlatform = getPlatformSync();

// Featured Zen models - always shown at top
export const FEATURED_MODELS: HanzoModel[] = [
  {
    id: 'zen-1.7b',
    name: 'Zen 1.7B',
    description: 'Ultra-lightweight model perfect for quick tasks and edge deployment.',
    size: 1.4,
    contextLength: 32768,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.VeryFast,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.ToolCalling],
    provider: 'Zen',
    huggingFaceUrl: 'https://huggingface.co/Qwen/Qwen3-1.7B-Instruct',
    featured: true,
    recommended: true,
  },
  {
    id: 'zen-4b',
    name: 'Zen 4B',
    description: 'Excellent balance between size and capability with fast response times.',
    size: 2.5,
    contextLength: 32768,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.ToolCalling, HanzoModelCapability.Code],
    provider: 'Zen',
    huggingFaceUrl: 'https://huggingface.co/Qwen/Qwen3-4B-Instruct',
    featured: true,
    recommended: true,
  },
  {
    id: 'zen-coder',
    name: 'Zen Coder',
    description: 'Specialized coding model with exceptional programming capabilities.',
    size: 18.5,
    contextLength: 128000,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Average,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.Code, HanzoModelCapability.ToolCalling],
    provider: 'Zen',
    huggingFaceUrl: 'https://huggingface.co/Qwen/Qwen3-Coder-32B-Instruct',
    featured: true,
  },
  {
    id: 'zen-next',
    name: 'Zen Next',
    description: 'Cutting-edge MoE model with GPT5 level performance.',
    size: 42.0,
    contextLength: 128000,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.Thinking, HanzoModelCapability.ToolCalling],
    provider: 'Zen',
    huggingFaceUrl: 'https://huggingface.co/Qwen/Qwen3-Next-80B',
    featured: true,
  },
];

// MLX optimized models for Mac
export const MLX_MODELS: HanzoModel[] = [
  {
    id: 'mistral-7b-mlx',
    name: 'Mistral 7B',
    description: 'Fast and efficient general-purpose model optimized for Apple Silicon.',
    size: 4.0,
    contextLength: 32768,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.VeryFast,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.Code],
    provider: 'Mistral',
    mlxUrl: 'https://huggingface.co/mlx-community/mistral-7B-instruct-v0.3-4bit',
    tags: ['mlx', 'apple-silicon'],
  },
  {
    id: 'phi-3-mini-mlx',
    name: 'Phi-3 Mini',
    description: 'Microsoft compact model with strong reasoning abilities.',
    size: 2.7,
    contextLength: 128000,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.VeryFast,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.Math],
    provider: 'Microsoft',
    mlxUrl: 'https://huggingface.co/mlx-community/phi-3-mini-128k-instruct-4bit',
    tags: ['mlx', 'apple-silicon', 'compact'],
  },
  {
    id: 'llama-3.3-70b-mlx',
    name: 'Llama 3.3 70B',
    description: `Meta's latest model optimized for Mac with MLX.`,
    size: 40.0,
    contextLength: 128000,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Average,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.Code, HanzoModelCapability.Math],
    provider: 'Meta',
    mlxUrl: 'https://huggingface.co/mlx-community/Llama-3.3-70B-Instruct-4bit',
    tags: ['mlx', 'apple-silicon', 'large'],
  },
  {
    id: 'deepseek-coder-7b-mlx',
    name: 'DeepSeek Coder 7B',
    description: 'Specialized coding model for Apple Silicon.',
    size: 4.2,
    contextLength: 16384,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.Code, HanzoModelCapability.TextGeneration],
    provider: 'DeepSeek',
    mlxUrl: 'https://huggingface.co/mlx-community/deepseek-coder-7b-instruct-v1.5-4bit',
    tags: ['mlx', 'apple-silicon', 'code'],
  },
  {
    id: 'gemma-2-9b-mlx',
    name: 'Gemma 2 9B',
    description: `Google's efficient model optimized for Mac.`,
    size: 5.5,
    contextLength: 8192,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.Multilingual],
    provider: 'Google',
    mlxUrl: 'https://huggingface.co/mlx-community/gemma-2-9b-it-4bit',
    tags: ['mlx', 'apple-silicon'],
  },
];

// Top Hugging Face models
export const HUGGINGFACE_MODELS: HanzoModel[] = [
  {
    id: 'deepseek-r1-70b',
    name: 'DeepSeek R1 70B',
    description: 'Powerful reasoning model comparable to OpenAI o1.',
    size: 40.2,
    contextLength: 128000,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Average,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.Thinking, HanzoModelCapability.Math],
    provider: 'DeepSeek',
    huggingFaceUrl: 'https://huggingface.co/deepseek-ai/DeepSeek-R1-70B',
    recommended: true,
  },
  {
    id: 'llama-3.3-70b',
    name: 'Llama 3.3 70B',
    description: `Meta's latest and most powerful open model.`,
    size: 40.0,
    contextLength: 128000,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Average,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.Code, HanzoModelCapability.Math],
    provider: 'Meta',
    huggingFaceUrl: 'https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct',
    recommended: true,
  },
  {
    id: 'mixtral-8x7b',
    name: 'Mixtral 8x7B',
    description: 'Mixture of experts model with excellent performance.',
    size: 26.0,
    contextLength: 32768,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.Code],
    provider: 'Mistral',
    huggingFaceUrl: 'https://huggingface.co/mistralai/Mixtral-8x7B-Instruct-v0.1',
  },
  {
    id: 'yi-34b',
    name: 'Yi 34B',
    description: 'High-quality bilingual model supporting English and Chinese.',
    size: 20.0,
    contextLength: 200000,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Average,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.Multilingual],
    provider: '01.AI',
    huggingFaceUrl: 'https://huggingface.co/01-ai/Yi-34B-Chat',
  },
  {
    id: 'solar-10.7b',
    name: 'SOLAR 10.7B',
    description: 'Efficient model with strong performance across tasks.',
    size: 6.5,
    contextLength: 4096,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'Upstage',
    huggingFaceUrl: 'https://huggingface.co/upstage/SOLAR-10.7B-Instruct-v1.0',
  },
  {
    id: 'falcon-180b',
    name: 'Falcon 180B',
    description: 'One of the largest open-source models available.',
    size: 100.0,
    contextLength: 2048,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Slow,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'TII',
    huggingFaceUrl: 'https://huggingface.co/tiiuae/falcon-180B-chat',
  },
  {
    id: 'vicuna-33b',
    name: 'Vicuna 33B',
    description: 'Fine-tuned Llama model with improved conversational abilities.',
    size: 19.0,
    contextLength: 2048,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Average,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'LMSYS',
    huggingFaceUrl: 'https://huggingface.co/lmsys/vicuna-33b-v1.3',
  },
  {
    id: 'wizardcoder-34b',
    name: 'WizardCoder 34B',
    description: 'Specialized model for code generation and programming tasks.',
    size: 20.0,
    contextLength: 8192,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Average,
    capabilities: [HanzoModelCapability.Code, HanzoModelCapability.TextGeneration],
    provider: 'WizardLM',
    huggingFaceUrl: 'https://huggingface.co/WizardLM/WizardCoder-Python-34B-V1.0',
  },
  {
    id: 'starcoder2-15b',
    name: 'StarCoder2 15B',
    description: 'Advanced code generation model from BigCode.',
    size: 9.0,
    contextLength: 16384,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.Code],
    provider: 'BigCode',
    huggingFaceUrl: 'https://huggingface.co/bigcode/starcoder2-15b-instruct',
  },
  {
    id: 'zephyr-7b',
    name: 'Zephyr 7B',
    description: 'Highly optimized chat model based on Mistral.',
    size: 4.0,
    contextLength: 32768,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.VeryFast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'HuggingFace',
    huggingFaceUrl: 'https://huggingface.co/HuggingFaceH4/zephyr-7b-beta',
  },
];

// Combine all models
export const ALL_MODELS: HanzoModel[] = [
  ...FEATURED_MODELS,
  ...(currentPlatform === 'macos' ? MLX_MODELS : []),
  ...HUGGINGFACE_MODELS,
];

// Get models by size range
export function getModelsBySize(minSize: number, maxSize: number): HanzoModel[] {
  return ALL_MODELS.filter(model => model.size >= minSize && model.size <= maxSize);
}

// Get featured models
export function getFeaturedModels(): HanzoModel[] {
  return FEATURED_MODELS;
}

// Get recommended models
export function getRecommendedModels(): HanzoModel[] {
  return ALL_MODELS.filter(model => model.recommended);
}

// Search models
export function searchModels(query: string): HanzoModel[] {
  const lowerQuery = query.toLowerCase();
  return ALL_MODELS.filter(model =>
    model.name.toLowerCase().includes(lowerQuery) ||
    model.description.toLowerCase().includes(lowerQuery) ||
    model.provider?.toLowerCase().includes(lowerQuery) ||
    model.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

// Helper function to check if a model can run on the system
export function canRunModel(modelSizeGB: number, systemInfo: { memory: number; gpu?: { vram?: number } }) {
  const requiredMemory = modelSizeGB * 1.5; // Need 1.5x model size for safe operation
  const availableMemory = systemInfo.gpu?.vram
    ? (systemInfo.gpu.vram / 1024) // Convert MB to GB
    : systemInfo.memory * 0.7; // Use 70% of system RAM if no GPU

  const canRun = availableMemory >= requiredMemory;
  let warning = '';

  if (!canRun) {
    warning = `Requires ${requiredMemory.toFixed(1)}GB, only ${availableMemory.toFixed(1)}GB available`;
  } else if (availableMemory < requiredMemory * 1.2) {
    warning = 'May run slowly with limited memory';
  }

  return { canRun, warning, requiredMemory, availableMemory };
}