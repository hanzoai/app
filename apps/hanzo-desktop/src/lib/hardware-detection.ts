// Hardware detection utilities for GPU and system capabilities

interface GPUInfo {
  available: boolean;
  vendor?: string;
  renderer?: string;
  vram?: number; // in MB
  capabilities: string[];
}

interface SystemInfo {
  platform: string;
  memory: number; // in GB
  cores: number;
  gpu: GPUInfo;
  supportedEngines: string[];
}

export async function detectGPU(): Promise<GPUInfo> {
  const gpuInfo: GPUInfo = {
    available: false,
    capabilities: []
  };

  try {
    // Try WebGL for GPU detection
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (gl && gl instanceof WebGLRenderingContext) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

      if (debugInfo) {
        gpuInfo.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        gpuInfo.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        gpuInfo.available = true;
      }

      // Estimate VRAM (rough approximation)
      const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      gpuInfo.vram = Math.round((maxTextureSize * maxTextureSize * 4) / (1024 * 1024)) || 4096;

      // Check capabilities
      if (gpuInfo.renderer) {
        const renderer = gpuInfo.renderer.toLowerCase();

        // Apple Silicon detection
        if (renderer.includes('apple') || renderer.includes('m1') || renderer.includes('m2') || renderer.includes('m3')) {
          gpuInfo.capabilities.push('metal', 'mlx', 'coreml');
          gpuInfo.vram = 16384; // Unified memory, estimate 16GB
        }

        // NVIDIA detection
        if (renderer.includes('nvidia') || renderer.includes('geforce') || renderer.includes('rtx') || renderer.includes('gtx')) {
          gpuInfo.capabilities.push('cuda', 'tensorrt');

          // Estimate VRAM based on model
          if (renderer.includes('4090')) gpuInfo.vram = 24576;
          else if (renderer.includes('4080')) gpuInfo.vram = 16384;
          else if (renderer.includes('4070')) gpuInfo.vram = 12288;
          else if (renderer.includes('3090')) gpuInfo.vram = 24576;
          else if (renderer.includes('3080')) gpuInfo.vram = 10240;
          else if (renderer.includes('3070')) gpuInfo.vram = 8192;
        }

        // AMD detection
        if (renderer.includes('amd') || renderer.includes('radeon')) {
          gpuInfo.capabilities.push('rocm', 'vulkan');
        }

        // Intel detection
        if (renderer.includes('intel')) {
          gpuInfo.capabilities.push('openvino', 'vulkan');
        }
      }
    }
  } catch (error) {
    console.error('GPU detection failed:', error);
  }

  return gpuInfo;
}

export async function detectSystem(): Promise<SystemInfo> {
  const gpu = await detectGPU();

  // Get platform
  const platform = navigator.platform.toLowerCase().includes('mac') ? 'macos' :
                   navigator.platform.toLowerCase().includes('win') ? 'windows' : 'linux';

  // Estimate memory (rough approximation)
  const memory = (navigator as any).deviceMemory || 8; // deviceMemory API or default to 8GB

  // Get cores
  const cores = navigator.hardwareConcurrency || 4;

  // Determine supported engines based on platform and GPU
  const supportedEngines: string[] = ['onnx', 'llamacpp'];

  if (platform === 'macos' && gpu.capabilities.includes('metal')) {
    supportedEngines.push('mlx', 'coreml', 'metal');
  }

  if (gpu.capabilities.includes('cuda')) {
    supportedEngines.push('cuda', 'tensorrt', 'triton');
  }

  if (gpu.capabilities.includes('rocm')) {
    supportedEngines.push('rocm');
  }

  return {
    platform,
    memory,
    cores,
    gpu,
    supportedEngines
  };
}

export function canRunModel(modelSize: number, systemInfo: SystemInfo): {
  canRun: boolean;
  warning?: string;
  recommendation?: string;
} {
  const availableMemory = systemInfo.gpu.available ?
    (systemInfo.gpu.vram || 0) / 1024 : // Convert to GB
    systemInfo.memory * 0.7; // Use 70% of system RAM

  const modelSizeGB = modelSize;

  // Need at least 1.5x model size for comfortable operation
  const requiredMemory = modelSizeGB * 1.5;

  if (requiredMemory > availableMemory) {
    return {
      canRun: false,
      warning: `Model requires ${requiredMemory.toFixed(1)}GB but only ${availableMemory.toFixed(1)}GB available`,
      recommendation: `Consider models under ${(availableMemory / 1.5).toFixed(1)}GB for optimal performance`
    };
  }

  if (requiredMemory > availableMemory * 0.8) {
    return {
      canRun: true,
      warning: `Model will use ${((requiredMemory / availableMemory) * 100).toFixed(0)}% of available memory`,
      recommendation: 'Performance may be slower. Consider quantized versions'
    };
  }

  return { canRun: true };
}

export function getRecommendedModels(systemInfo: SystemInfo): string[] {
  const recommendations: string[] = [];
  const availableMemory = systemInfo.gpu.available ?
    (systemInfo.gpu.vram || 0) / 1024 :
    systemInfo.memory * 0.7;

  // Based on available memory
  if (availableMemory < 4) {
    recommendations.push('zen-1.7b', 'phi-3-mini', 'gemma-2b');
  } else if (availableMemory < 8) {
    recommendations.push('zen-4b', 'mistral-7b', 'llama-3.2-3b');
  } else if (availableMemory < 16) {
    recommendations.push('zen-coder', 'llama-3.2-8b', 'mixtral-8x7b');
  } else {
    recommendations.push('zen-next', 'llama-3.3-70b', 'deepseek-r1-70b');
  }

  return recommendations;
}