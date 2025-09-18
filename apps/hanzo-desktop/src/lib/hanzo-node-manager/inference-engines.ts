// Inference engine definitions for Hanzo Node

export interface InferenceEngine {
  id: string;
  name: string;
  description: string;
  platforms: string[];
  requirements: string[];
  performance: 'slow' | 'fast' | 'very-fast';
  memory: 'low' | 'medium' | 'high';
  features: string[];
  defaultEngine?: boolean;
  icon?: string;
}

export const INFERENCE_ENGINES: InferenceEngine[] = [
  {
    id: 'hanzo-engine',
    name: 'Hanzo Engine',
    description: 'Default high-performance inference engine built into Hanzo Node',
    platforms: ['macos', 'windows', 'linux'],
    requirements: [],
    performance: 'very-fast',
    memory: 'low',
    features: [
      'Optimized for Zen models',
      'Automatic quantization',
      'Dynamic batching',
      'Memory mapping',
      'GPU acceleration',
      'Streaming support'
    ],
    defaultEngine: true,
    icon: '⚡'
  },
  {
    id: 'llamacpp',
    name: 'llama.cpp',
    description: 'Fast CPU/GPU inference with GGUF model support',
    platforms: ['macos', 'windows', 'linux'],
    requirements: ['4GB+ RAM'],
    performance: 'fast',
    memory: 'low',
    features: [
      'GGUF format support',
      'CPU optimized',
      'Metal support (Mac)',
      'CUDA support',
      'Quantization support',
      'Low memory usage'
    ],
    icon: '🦙'
  },
  {
    id: 'mlx',
    name: 'MLX',
    description: 'Apple Silicon optimized framework with unified memory',
    platforms: ['macos'],
    requirements: ['Apple Silicon Mac', 'macOS 13+'],
    performance: 'very-fast',
    memory: 'medium',
    features: [
      'Unified memory architecture',
      'Dynamic computation graphs',
      'Native M1/M2/M3 optimization',
      'Fast model switching',
      'Python integration'
    ],
    icon: '🍎'
  },
  {
    id: 'onnx',
    name: 'ONNX Runtime',
    description: 'Cross-platform inference with broad hardware support',
    platforms: ['macos', 'windows', 'linux'],
    requirements: ['2GB+ RAM'],
    performance: 'fast',
    memory: 'medium',
    features: [
      'Hardware agnostic',
      'DirectML (Windows)',
      'CoreML (Mac)',
      'CUDA support',
      'TensorRT support',
      'Model optimization'
    ],
    icon: '🔧'
  },
  {
    id: 'tensorrt',
    name: 'TensorRT',
    description: 'NVIDIA GPU optimized inference engine',
    platforms: ['windows', 'linux'],
    requirements: ['NVIDIA GPU', 'CUDA 11.0+', '8GB+ VRAM'],
    performance: 'very-fast',
    memory: 'high',
    features: [
      'INT8 quantization',
      'Dynamic shapes',
      'Multi-GPU support',
      'Layer fusion',
      'Kernel auto-tuning',
      'FP16 inference'
    ],
    icon: '🚀'
  },
  {
    id: 'vllm',
    name: 'vLLM',
    description: 'High-throughput serving with PagedAttention',
    platforms: ['linux'],
    requirements: ['NVIDIA GPU', '16GB+ VRAM'],
    performance: 'very-fast',
    memory: 'high',
    features: [
      'PagedAttention',
      'Continuous batching',
      'Tensor parallelism',
      'Speculative decoding',
      'OpenAI compatible API'
    ],
    icon: '⚡'
  },
  {
    id: 'triton',
    name: 'Triton Inference Server',
    description: 'Production-grade multi-model serving',
    platforms: ['linux'],
    requirements: ['8GB+ RAM', 'Docker'],
    performance: 'fast',
    memory: 'high',
    features: [
      'Multi-model serving',
      'Dynamic batching',
      'Model versioning',
      'Metrics and monitoring',
      'Ensemble models',
      'Cloud native'
    ],
    icon: '🔱'
  },
  {
    id: 'coreml',
    name: 'Core ML',
    description: 'Apple native machine learning framework',
    platforms: ['macos', 'ios'],
    requirements: ['macOS 10.15+'],
    performance: 'fast',
    memory: 'low',
    features: [
      'On-device inference',
      'Neural Engine support',
      'Energy efficient',
      'Privacy focused',
      'Automatic optimization'
    ],
    icon: '📱'
  },
  {
    id: 'openvino',
    name: 'OpenVINO',
    description: 'Intel hardware optimized inference',
    platforms: ['windows', 'linux'],
    requirements: ['Intel CPU/GPU'],
    performance: 'fast',
    memory: 'medium',
    features: [
      'Intel CPU optimization',
      'Intel GPU support',
      'Model compression',
      'INT8 quantization',
      'Neural network optimization'
    ],
    icon: '💙'
  },
  {
    id: 'candle',
    name: 'Candle',
    description: 'Rust-based minimalist ML framework',
    platforms: ['macos', 'windows', 'linux'],
    requirements: ['2GB+ RAM'],
    performance: 'fast',
    memory: 'low',
    features: [
      'Rust performance',
      'WASM support',
      'No Python dependency',
      'CUDA support',
      'Metal support',
      'Small binary size'
    ],
    icon: '🕯️'
  }
];

export function getEnginesForPlatform(platform: string): InferenceEngine[] {
  return INFERENCE_ENGINES.filter(engine =>
    engine.platforms.includes(platform.toLowerCase())
  );
}

export function getDefaultEngine(): InferenceEngine {
  return INFERENCE_ENGINES.find(e => e.defaultEngine) || INFERENCE_ENGINES[0];
}

export function getEngineById(id: string): InferenceEngine | undefined {
  return INFERENCE_ENGINES.find(engine => engine.id === id);
}