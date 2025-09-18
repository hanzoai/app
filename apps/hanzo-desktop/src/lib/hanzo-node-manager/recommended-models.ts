import { HanzoModel, HanzoModelQuality, HanzoModelSpeed, HanzoModelCapability } from './hanzo-models';

// Top 50 recommended models for 8GB+ GPUs
// Curated based on: stars, downloads, reviews, performance on limited hardware
export const RECOMMENDED_8GB_MODELS: HanzoModel[] = [
  // === ULTRA EFFICIENT (< 2GB) - Perfect for 8GB GPUs ===
  {
    id: 'phi-3-mini',
    name: 'Phi-3 Mini',
    description: 'Microsoft's tiny powerhouse. Best performance per GB.',
    size: 2.7,
    contextLength: 128000,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.VeryFast,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.Math],
    provider: 'Microsoft',
    huggingFaceUrl: 'https://huggingface.co/microsoft/Phi-3-mini-128k-instruct',
    recommended: true,
    tags: ['efficient', '8gb-friendly', 'top-rated'],
  },
  {
    id: 'gemma-2b',
    name: 'Gemma 2B',
    description: 'Google's compact model. Excellent for quick tasks.',
    size: 1.4,
    contextLength: 8192,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.VeryFast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'Google',
    huggingFaceUrl: 'https://huggingface.co/google/gemma-2b-it',
    recommended: true,
    tags: ['efficient', '8gb-friendly'],
  },
  {
    id: 'tinyllama-1.1b',
    name: 'TinyLlama 1.1B',
    description: 'Smallest Llama. Surprisingly capable for its size.',
    size: 0.6,
    contextLength: 2048,
    quality: HanzoModelQuality.Medium,
    speed: HanzoModelSpeed.VeryFast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'TinyLlama',
    huggingFaceUrl: 'https://huggingface.co/TinyLlama/TinyLlama-1.1B-Chat-v1.0',
    recommended: true,
    tags: ['ultra-light', '8gb-friendly'],
  },
  {
    id: 'stablelm-2-1.6b',
    name: 'StableLM 2 1.6B',
    description: 'Stability AI's efficient model. Great quality/size ratio.',
    size: 0.9,
    contextLength: 4096,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.VeryFast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'Stability AI',
    huggingFaceUrl: 'https://huggingface.co/stabilityai/stablelm-2-1_6b-chat',
    recommended: true,
    tags: ['efficient', '8gb-friendly'],
  },

  // === BALANCED PERFORMERS (2-5GB) - Sweet spot for 8GB GPUs ===
  {
    id: 'mistral-7b',
    name: 'Mistral 7B',
    description: '⭐ Most popular 7B model. Excellent all-rounder.',
    size: 4.0,
    contextLength: 32768,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.Code],
    provider: 'Mistral',
    huggingFaceUrl: 'https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.3',
    recommended: true,
    tags: ['popular', '8gb-friendly', 'best-seller'],
  },
  {
    id: 'llama-3-8b',
    name: 'Llama 3 8B',
    description: '🔥 Meta's latest. Top choice for general tasks.',
    size: 4.5,
    contextLength: 8192,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.Code],
    provider: 'Meta',
    huggingFaceUrl: 'https://huggingface.co/meta-llama/Meta-Llama-3-8B-Instruct',
    recommended: true,
    tags: ['trending', '8gb-friendly', 'latest'],
  },
  {
    id: 'qwen2.5-7b',
    name: 'Qwen 2.5 7B',
    description: '🚀 Alibaba's newest. Excellent reasoning abilities.',
    size: 4.0,
    contextLength: 131072,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.Code, HanzoModelCapability.Math],
    provider: 'Alibaba',
    huggingFaceUrl: 'https://huggingface.co/Qwen/Qwen2.5-7B-Instruct',
    recommended: true,
    tags: ['latest', '8gb-friendly', 'long-context'],
  },
  {
    id: 'neural-chat-7b',
    name: 'Neural Chat 7B',
    description: 'Intel's optimized model. Fast on CPUs too.',
    size: 4.0,
    contextLength: 8192,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'Intel',
    huggingFaceUrl: 'https://huggingface.co/Intel/neural-chat-7b-v3-3',
    recommended: true,
    tags: ['cpu-friendly', '8gb-friendly'],
  },
  {
    id: 'openchat-3.5',
    name: 'OpenChat 3.5',
    description: 'Fine-tuned on GPT-4 data. Punches above its weight.',
    size: 4.0,
    contextLength: 8192,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'OpenChat',
    huggingFaceUrl: 'https://huggingface.co/openchat/openchat-3.5-0106',
    recommended: true,
    tags: ['gpt4-tuned', '8gb-friendly'],
  },
  {
    id: 'zephyr-7b-beta',
    name: 'Zephyr 7B Beta',
    description: 'HuggingFace's fine-tuned Mistral. Very helpful.',
    size: 4.0,
    contextLength: 32768,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'HuggingFace',
    huggingFaceUrl: 'https://huggingface.co/HuggingFaceH4/zephyr-7b-beta',
    recommended: true,
    tags: ['helpful', '8gb-friendly'],
  },

  // === SPECIALIZED MODELS (Various sizes) ===
  {
    id: 'deepseek-coder-6.7b',
    name: 'DeepSeek Coder 6.7B',
    description: '💻 Best coding model for 8GB. Beats larger models.',
    size: 3.8,
    contextLength: 16384,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.Code, HanzoModelCapability.TextGeneration],
    provider: 'DeepSeek',
    huggingFaceUrl: 'https://huggingface.co/deepseek-ai/deepseek-coder-6.7b-instruct',
    recommended: true,
    tags: ['coding', '8gb-friendly', 'specialized'],
  },
  {
    id: 'codellama-7b',
    name: 'CodeLlama 7B',
    description: 'Meta's coding specialist. Excellent for programming.',
    size: 4.0,
    contextLength: 16384,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.Code],
    provider: 'Meta',
    huggingFaceUrl: 'https://huggingface.co/codellama/CodeLlama-7b-Instruct-hf',
    recommended: true,
    tags: ['coding', '8gb-friendly'],
  },
  {
    id: 'wizardcoder-python-7b',
    name: 'WizardCoder Python 7B',
    description: 'Python specialist. Best for Python development.',
    size: 4.0,
    contextLength: 8192,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.Code],
    provider: 'WizardLM',
    huggingFaceUrl: 'https://huggingface.co/WizardLM/WizardCoder-Python-7B-V1.0',
    recommended: true,
    tags: ['python', 'coding', '8gb-friendly'],
  },
  {
    id: 'wizardmath-7b',
    name: 'WizardMath 7B',
    description: '🧮 Math specialist. Solves complex problems.',
    size: 4.0,
    contextLength: 8192,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.Math, HanzoModelCapability.TextGeneration],
    provider: 'WizardLM',
    huggingFaceUrl: 'https://huggingface.co/WizardLM/WizardMath-7B-V1.1',
    recommended: true,
    tags: ['math', '8gb-friendly', 'specialized'],
  },
  {
    id: 'meditron-7b',
    name: 'Meditron 7B',
    description: '🏥 Medical specialist. Trained on medical data.',
    size: 4.0,
    contextLength: 4096,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'EPFL',
    huggingFaceUrl: 'https://huggingface.co/epfl-llm/meditron-7b',
    recommended: true,
    tags: ['medical', '8gb-friendly', 'specialized'],
  },

  // === MULTILINGUAL MODELS ===
  {
    id: 'aya-101',
    name: 'Aya 101',
    description: '🌍 Covers 101 languages. Best multilingual for 8GB.',
    size: 4.0,
    contextLength: 8192,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.Multilingual, HanzoModelCapability.TextGeneration],
    provider: 'Cohere',
    huggingFaceUrl: 'https://huggingface.co/CohereForAI/aya-101',
    recommended: true,
    tags: ['multilingual', '8gb-friendly'],
  },
  {
    id: 'bloomz-7b',
    name: 'BLOOMZ 7B',
    description: 'Multilingual model. 46 languages supported.',
    size: 4.0,
    contextLength: 2048,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.Multilingual, HanzoModelCapability.TextGeneration],
    provider: 'BigScience',
    huggingFaceUrl: 'https://huggingface.co/bigscience/bloomz-7b1',
    recommended: true,
    tags: ['multilingual', '8gb-friendly'],
  },

  // === CREATIVE & ROLEPLAY MODELS ===
  {
    id: 'nous-hermes-2',
    name: 'Nous Hermes 2',
    description: '🎭 Great for creative writing and roleplay.',
    size: 4.0,
    contextLength: 8192,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'Nous Research',
    huggingFaceUrl: 'https://huggingface.co/NousResearch/Nous-Hermes-2-Mistral-7B-DPO',
    recommended: true,
    tags: ['creative', '8gb-friendly', 'roleplay'],
  },
  {
    id: 'mythomax-l2-13b',
    name: 'MythoMax L2',
    description: '📚 Excellent for storytelling. Worth the extra size.',
    size: 7.5,
    contextLength: 4096,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Average,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'Gryphe',
    huggingFaceUrl: 'https://huggingface.co/Gryphe/MythoMax-L2-13b',
    recommended: true,
    tags: ['creative', '8gb-tight', 'storytelling'],
  },

  // === REASONING & ANALYSIS MODELS ===
  {
    id: 'orca-2-7b',
    name: 'Orca 2 7B',
    description: '🧠 Microsoft's reasoning model. Excellent logic.',
    size: 4.0,
    contextLength: 4096,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.Thinking],
    provider: 'Microsoft',
    huggingFaceUrl: 'https://huggingface.co/microsoft/Orca-2-7b',
    recommended: true,
    tags: ['reasoning', '8gb-friendly'],
  },
  {
    id: 'solar-10.7b',
    name: 'SOLAR 10.7B',
    description: 'Depth upscaling tech. 7B performance at 10B quality.',
    size: 6.0,
    contextLength: 4096,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Average,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'Upstage',
    huggingFaceUrl: 'https://huggingface.co/upstage/SOLAR-10.7B-Instruct-v1.0',
    recommended: true,
    tags: ['advanced', '8gb-tight'],
  },

  // === UNCENSORED & UNFILTERED MODELS ===
  {
    id: 'dolphin-mixtral-8x7b',
    name: 'Dolphin 2.6',
    description: '🐬 Uncensored. No refusals. Use responsibly.',
    size: 4.0,
    contextLength: 32768,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'Eric Hartford',
    huggingFaceUrl: 'https://huggingface.co/cognitivecomputations/dolphin-2.6-mistral-7b',
    recommended: true,
    tags: ['uncensored', '8gb-friendly'],
  },
  {
    id: 'wizard-vicuna-uncensored',
    name: 'Wizard Vicuna Uncensored',
    description: 'Unfiltered responses. No content restrictions.',
    size: 4.0,
    contextLength: 2048,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'Eric Hartford',
    huggingFaceUrl: 'https://huggingface.co/cognitivecomputations/WizardLM-7B-Uncensored',
    recommended: true,
    tags: ['uncensored', '8gb-friendly'],
  },

  // === FAST INFERENCE MODELS ===
  {
    id: 'tinydolphin-2.8',
    name: 'TinyDolphin 2.8',
    description: '⚡ Fastest uncensored model. 1.1B parameters.',
    size: 0.6,
    contextLength: 16384,
    quality: HanzoModelQuality.Medium,
    speed: HanzoModelSpeed.VeryFast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'Cognitive Computations',
    huggingFaceUrl: 'https://huggingface.co/cognitivecomputations/TinyDolphin-2.8-1.1b',
    recommended: true,
    tags: ['ultra-fast', '8gb-friendly'],
  },
  {
    id: 'rocket-3b',
    name: 'Rocket 3B',
    description: 'Fast inference. Good quality for size.',
    size: 1.8,
    contextLength: 8192,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.VeryFast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'Rocket',
    huggingFaceUrl: 'https://huggingface.co/pansophic/rocket-3B',
    recommended: true,
    tags: ['fast', '8gb-friendly'],
  },

  // === LONG CONTEXT MODELS ===
  {
    id: 'yarn-mistral-7b',
    name: 'Yarn Mistral 7B',
    description: '📜 128K context. Handle entire books.',
    size: 4.0,
    contextLength: 128000,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'Nous Research',
    huggingFaceUrl: 'https://huggingface.co/NousResearch/Yarn-Mistral-7b-128k',
    recommended: true,
    tags: ['long-context', '8gb-friendly'],
  },
  {
    id: 'longalpaca-7b',
    name: 'LongAlpaca 7B',
    description: 'Extended context Alpaca. 32K tokens.',
    size: 4.0,
    contextLength: 32768,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'Yukang',
    huggingFaceUrl: 'https://huggingface.co/Yukang/LongAlpaca-7B',
    recommended: true,
    tags: ['long-context', '8gb-friendly'],
  },

  // === VISION-LANGUAGE MODELS (if GPU supports) ===
  {
    id: 'bakllava-7b',
    name: 'BakLLaVA 7B',
    description: '👁️ Vision + Language. Understand images.',
    size: 4.5,
    contextLength: 8192,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.Vision, HanzoModelCapability.TextGeneration],
    provider: 'SkunkworksAI',
    huggingFaceUrl: 'https://huggingface.co/SkunkworksAI/BakLLaVA-1',
    recommended: true,
    tags: ['multimodal', '8gb-friendly'],
  },
  {
    id: 'obsidian-3b-v0.5',
    name: 'Obsidian 3B V0.5',
    description: 'Small vision model. Image understanding.',
    size: 2.0,
    contextLength: 8192,
    quality: HanzoModelQuality.Medium,
    speed: HanzoModelSpeed.VeryFast,
    capabilities: [HanzoModelCapability.Vision, HanzoModelCapability.TextGeneration],
    provider: 'NousResearch',
    huggingFaceUrl: 'https://huggingface.co/NousResearch/Obsidian-3B-V0.5',
    recommended: true,
    tags: ['vision', '8gb-friendly'],
  },

  // === LATEST & TRENDING (Updated weekly) ===
  {
    id: 'starling-lm-7b',
    name: 'Starling LM 7B',
    description: '🌟 Berkeley's RLHF model. Top benchmark scores.',
    size: 4.0,
    contextLength: 8192,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'Berkeley',
    huggingFaceUrl: 'https://huggingface.co/berkeley-nest/Starling-LM-7B-alpha',
    recommended: true,
    tags: ['trending', '8gb-friendly', 'top-rated'],
  },
  {
    id: 'openchat-3.6',
    name: 'OpenChat 3.6',
    description: '🔥 Just released. Beats GPT-3.5 on many tasks.',
    size: 4.0,
    contextLength: 8192,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.Code],
    provider: 'OpenChat',
    huggingFaceUrl: 'https://huggingface.co/openchat/openchat-3.6',
    recommended: true,
    tags: ['newest', '8gb-friendly', 'high-quality'],
  },
  {
    id: 'notux-8x7b',
    name: 'Notux 8x7B',
    description: '🚀 MoE model. Mixtral fine-tune. Very capable.',
    size: 26.0,
    contextLength: 32768,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Average,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.Code],
    provider: 'Argilla',
    huggingFaceUrl: 'https://huggingface.co/argilla/notux-8x7b-v1',
    recommended: false, // Too large for 8GB
    tags: ['powerful', '16gb-required'],
  },

  // === EXPERIMENTAL & RESEARCH MODELS ===
  {
    id: 'saul-7b',
    name: 'SauL 7B',
    description: '⚖️ Legal domain expert. Trained on legal texts.',
    size: 4.0,
    contextLength: 4096,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'Legal',
    huggingFaceUrl: 'https://huggingface.co/Equall/Saul-7B-Instruct',
    recommended: true,
    tags: ['legal', '8gb-friendly', 'specialized'],
  },
  {
    id: 'finance-llm',
    name: 'Finance LLM',
    description: '💰 Financial analysis. Market & trading focused.',
    size: 4.0,
    contextLength: 4096,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'Finance',
    huggingFaceUrl: 'https://huggingface.co/AdaptLLM/finance-LLM',
    recommended: true,
    tags: ['finance', '8gb-friendly', 'specialized'],
  },

  // === QUANTIZED CHAMPIONS (Even smaller!) ===
  {
    id: 'llama-3-8b-4bit',
    name: 'Llama 3 8B (4-bit)',
    description: '📦 Quantized Llama 3. 75% smaller, 90% quality.',
    size: 2.5,
    contextLength: 8192,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.VeryFast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'Meta',
    huggingFaceUrl: 'https://huggingface.co/TheBloke/Llama-3-8B-GGUF',
    recommended: true,
    tags: ['quantized', '8gb-friendly', 'efficient'],
  },
  {
    id: 'mixtral-8x7b-4bit',
    name: 'Mixtral 8x7B (4-bit)',
    description: '🎯 Quantized MoE. Enterprise quality on consumer GPU.',
    size: 12.0,
    contextLength: 32768,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Average,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.Code],
    provider: 'Mistral',
    huggingFaceUrl: 'https://huggingface.co/TheBloke/Mixtral-8x7B-Instruct-v0.1-GGUF',
    recommended: false, // Still tight for 8GB
    tags: ['quantized', '16gb-recommended'],
  },

  // === COMMUNITY FAVORITES ===
  {
    id: 'goliath-120b',
    name: 'Goliath 120B',
    description: '👑 Community champion. Needs 64GB+ RAM.',
    size: 65.0,
    contextLength: 8192,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Slow,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'Community',
    huggingFaceUrl: 'https://huggingface.co/alpindale/goliath-120b',
    recommended: false,
    tags: ['massive', '64gb-required'],
  },
  {
    id: 'airoboros-7b',
    name: 'Airoboros 7B',
    description: '🤖 Community trained. Good instruction following.',
    size: 4.0,
    contextLength: 8192,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'Jon Durbin',
    huggingFaceUrl: 'https://huggingface.co/jondurbin/airoboros-l2-7b-3.1.2',
    recommended: true,
    tags: ['community', '8gb-friendly'],
  },
  {
    id: 'platypus-7b',
    name: 'Platypus 7B',
    description: '🦫 STEM focused. Good at technical topics.',
    size: 4.0,
    contextLength: 4096,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.Math],
    provider: 'Platypus',
    huggingFaceUrl: 'https://huggingface.co/garage-bAInd/Platypus2-7B',
    recommended: true,
    tags: ['stem', '8gb-friendly'],
  },
  {
    id: 'guanaco-7b',
    name: 'Guanaco 7B',
    description: '🦙 QLoRA fine-tuned. Efficient training method.',
    size: 4.0,
    contextLength: 2048,
    quality: HanzoModelQuality.Good,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'UW',
    huggingFaceUrl: 'https://huggingface.co/TheBloke/guanaco-7B-HF',
    recommended: true,
    tags: ['efficient', '8gb-friendly'],
  },

  // === CUTTING EDGE (December 2024) ===
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    description: '🆕 Latest from DeepSeek. Incredible reasoning.',
    size: 6.0,
    contextLength: 64000,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.TextGeneration, HanzoModelCapability.Code, HanzoModelCapability.Thinking],
    provider: 'DeepSeek',
    huggingFaceUrl: 'https://huggingface.co/deepseek-ai/DeepSeek-V3',
    recommended: true,
    tags: ['latest', '8gb-tight', 'reasoning'],
  },
  {
    id: 'yi-coder-9b',
    name: 'Yi Coder 9B',
    description: '💻 New coding specialist. Beats GPT-4 on HumanEval.',
    size: 5.0,
    contextLength: 128000,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Fast,
    capabilities: [HanzoModelCapability.Code],
    provider: '01.AI',
    huggingFaceUrl: 'https://huggingface.co/01-ai/Yi-Coder-9B-Chat',
    recommended: true,
    tags: ['coding', '8gb-tight', 'new'],
  },
  {
    id: 'command-r',
    name: 'Command-R',
    description: '🔍 RAG optimized. Built for retrieval tasks.',
    size: 20.0,
    contextLength: 128000,
    quality: HanzoModelQuality.Excellent,
    speed: HanzoModelSpeed.Average,
    capabilities: [HanzoModelCapability.TextGeneration],
    provider: 'Cohere',
    huggingFaceUrl: 'https://huggingface.co/CohereForAI/c4ai-command-r-v01',
    recommended: false,
    tags: ['rag', '32gb-required', 'retrieval'],
  },
];

// Function to fetch trending models from Hugging Face
export async function fetchTrendingModels(
  timeRange: 'day' | 'week' | 'month' = 'week',
  limit: number = 20
): Promise<HanzoModel[]> {
  try {
    // Fetch models sorted by trending score (likes in time period)
    const response = await fetch(
      `https://huggingface.co/api/models?sort=trending&direction=-1&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch trending models');
    }

    const data = await response.json();

    return data.map((model: any) => ({
      id: model.modelId.replace('/', '-'),
      name: model.modelId.split('/').pop(),
      description: `${model.likes} likes this ${timeRange}. ${model.tags?.join(', ') || ''}`,
      size: estimateModelSize(model.modelId),
      contextLength: 8192, // Default, would need to fetch model card for actual
      quality: HanzoModelQuality.Good,
      speed: HanzoModelSpeed.Average,
      capabilities: inferCapabilities(model.tags),
      provider: model.author || model.modelId.split('/')[0],
      huggingFaceUrl: `https://huggingface.co/${model.modelId}`,
      tags: ['trending', `trending-${timeRange}`],
    }));
  } catch (error) {
    console.error('Error fetching trending models:', error);
    return [];
  }
}

// Helper function to estimate model size from name
function estimateModelSize(modelId: string): number {
  const lower = modelId.toLowerCase();
  if (lower.includes('120b')) return 65.0;
  if (lower.includes('70b')) return 40.0;
  if (lower.includes('34b')) return 20.0;
  if (lower.includes('13b')) return 7.5;
  if (lower.includes('8x7b')) return 26.0;
  if (lower.includes('7b')) return 4.0;
  if (lower.includes('3b')) return 1.8;
  if (lower.includes('1.5b') || lower.includes('1.6b')) return 0.9;
  if (lower.includes('1b') || lower.includes('1.1b')) return 0.6;
  return 4.0; // Default assumption
}

// Helper function to infer capabilities from tags
function inferCapabilities(tags?: string[]): HanzoModelCapability[] {
  if (!tags) return [HanzoModelCapability.TextGeneration];

  const capabilities: HanzoModelCapability[] = [HanzoModelCapability.TextGeneration];

  const tagStr = tags.join(' ').toLowerCase();
  if (tagStr.includes('code') || tagStr.includes('programming')) {
    capabilities.push(HanzoModelCapability.Code);
  }
  if (tagStr.includes('math')) {
    capabilities.push(HanzoModelCapability.Math);
  }
  if (tagStr.includes('vision') || tagStr.includes('multimodal')) {
    capabilities.push(HanzoModelCapability.Vision);
  }
  if (tagStr.includes('thinking') || tagStr.includes('reasoning')) {
    capabilities.push(HanzoModelCapability.Thinking);
  }
  if (tagStr.includes('multilingual') || tagStr.includes('translation')) {
    capabilities.push(HanzoModelCapability.Multilingual);
  }

  return capabilities;
}

// Get models filtered by GPU RAM
export function getModelsForGPU(gpuRAM: number): HanzoModel[] {
  return RECOMMENDED_8GB_MODELS.filter(model => {
    // Conservative estimates with overhead
    if (gpuRAM <= 4) return model.size <= 2.0;
    if (gpuRAM <= 6) return model.size <= 3.0;
    if (gpuRAM <= 8) return model.size <= 4.5;
    if (gpuRAM <= 12) return model.size <= 7.0;
    if (gpuRAM <= 16) return model.size <= 10.0;
    if (gpuRAM <= 24) return model.size <= 15.0;
    return true; // 32GB+ can handle anything
  });
}

// Get top N models by specific criteria
export function getTopModelsByCategory(category: 'coding' | 'creative' | 'math' | 'multilingual' | 'fast' | 'quality', limit: number = 10): HanzoModel[] {
  let filtered: HanzoModel[] = [];

  switch (category) {
    case 'coding':
      filtered = RECOMMENDED_8GB_MODELS.filter(m =>
        m.capabilities.includes(HanzoModelCapability.Code) ||
        m.tags?.includes('coding') || m.tags?.includes('python')
      );
      break;
    case 'creative':
      filtered = RECOMMENDED_8GB_MODELS.filter(m =>
        m.tags?.includes('creative') || m.tags?.includes('roleplay') ||
        m.tags?.includes('storytelling')
      );
      break;
    case 'math':
      filtered = RECOMMENDED_8GB_MODELS.filter(m =>
        m.capabilities.includes(HanzoModelCapability.Math) ||
        m.tags?.includes('math') || m.tags?.includes('stem')
      );
      break;
    case 'multilingual':
      filtered = RECOMMENDED_8GB_MODELS.filter(m =>
        m.capabilities.includes(HanzoModelCapability.Multilingual) ||
        m.tags?.includes('multilingual')
      );
      break;
    case 'fast':
      filtered = RECOMMENDED_8GB_MODELS.filter(m =>
        m.speed === HanzoModelSpeed.VeryFast ||
        m.tags?.includes('ultra-fast') || m.tags?.includes('efficient')
      );
      break;
    case 'quality':
      filtered = RECOMMENDED_8GB_MODELS.filter(m =>
        m.quality === HanzoModelQuality.Excellent
      );
      break;
  }

  return filtered.slice(0, limit);
}