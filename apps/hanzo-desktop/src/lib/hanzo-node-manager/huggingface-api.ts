// Service to fetch models from Hugging Face public API

interface HuggingFaceModel {
  modelId: string;
  author?: string;
  lastModified?: string;
  downloads?: number;
  likes?: number;
  tags?: string[];
  pipeline_tag?: string;
  library_name?: string;
  private?: boolean;
  gated?: boolean;
}

interface HuggingFaceSearchResponse {
  models: HuggingFaceModel[];
}

const HUGGINGFACE_API_BASE = 'https://huggingface.co/api';

// Fetch trending models from Hugging Face sorted by stars in the last week
export async function fetchTrendingModels(limit = 50): Promise<HuggingFaceModel[]> {
  try {
    // Calculate date one week ago
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const dateString = oneWeekAgo.toISOString().split('T')[0];

    // Fetch models sorted by likes (stars) that were updated in the last week
    const response = await fetch(
      `${HUGGINGFACE_API_BASE}/models?sort=likes&direction=-1&limit=${limit}&filter=text-generation`
    );
    if (!response.ok) throw new Error('Failed to fetch trending models');
    const data: HuggingFaceModel[] = await response.json();

    // Filter for models modified in the last week
    const recentModels = data.filter(model => {
      if (!model.lastModified) return false;
      const modifiedDate = new Date(model.lastModified);
      return modifiedDate >= oneWeekAgo;
    });

    // If we don't have enough recent models, include top liked models
    if (recentModels.length < limit) {
      return [...recentModels, ...data.slice(0, limit - recentModels.length)];
    }

    return recentModels.slice(0, limit);
  } catch (error) {
    console.error('Error fetching trending models:', error);
    return [];
  }
}

// Fetch models by search query
export async function searchHuggingFaceModels(query: string): Promise<HuggingFaceModel[]> {
  try {
    const response = await fetch(
      `${HUGGINGFACE_API_BASE}/models?search=${encodeURIComponent(query)}&limit=30`
    );
    if (!response.ok) throw new Error('Failed to search models');
    const data: HuggingFaceModel[] = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching models:', error);
    return [];
  }
}

// Fetch MLX community models
export async function fetchMLXModels(): Promise<HuggingFaceModel[]> {
  try {
    const response = await fetch(
      `${HUGGINGFACE_API_BASE}/models?author=mlx-community&sort=downloads&direction=-1&limit=200`
    );
    if (!response.ok) throw new Error('Failed to fetch MLX models');
    const data: HuggingFaceModel[] = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching MLX models:', error);
    return [];
  }
}

// Fetch LM Studio community models
export async function fetchLMStudioModels(): Promise<HuggingFaceModel[]> {
  try {
    const response = await fetch(
      `${HUGGINGFACE_API_BASE}/models?author=lmstudio-community&sort=downloads&direction=-1&limit=200`
    );
    if (!response.ok) throw new Error('Failed to fetch LM Studio models');
    const data: HuggingFaceModel[] = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching LM Studio models:', error);
    return [];
  }
}

// Fetch models from a specific organization
export async function fetchOrganizationModels(org: string): Promise<HuggingFaceModel[]> {
  try {
    const response = await fetch(
      `${HUGGINGFACE_API_BASE}/models?author=${org}&sort=downloads&direction=-1&limit=100`
    );
    if (!response.ok) throw new Error(`Failed to fetch models from ${org}`);
    const data: HuggingFaceModel[] = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching ${org} models:`, error);
    return [];
  }
}

// Get model details
export async function getModelDetails(modelId: string): Promise<any> {
  try {
    const response = await fetch(`${HUGGINGFACE_API_BASE}/models/${modelId}`);
    if (!response.ok) throw new Error(`Failed to fetch model details for ${modelId}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching model details:`, error);
    return null;
  }
}

// Fetch top text generation models
export async function fetchTopTextGenerationModels(): Promise<HuggingFaceModel[]> {
  try {
    const response = await fetch(
      `${HUGGINGFACE_API_BASE}/models?pipeline_tag=text-generation&sort=downloads&direction=-1&limit=50`
    );
    if (!response.ok) throw new Error('Failed to fetch text generation models');
    const data: HuggingFaceModel[] = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching text generation models:', error);
    return [];
  }
}

// Fetch code generation models
export async function fetchCodeModels(): Promise<HuggingFaceModel[]> {
  try {
    const response = await fetch(
      `${HUGGINGFACE_API_BASE}/models?pipeline_tag=text-generation&search=code&sort=downloads&direction=-1&limit=30`
    );
    if (!response.ok) throw new Error('Failed to fetch code models');
    const data: HuggingFaceModel[] = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching code models:', error);
    return [];
  }
}

// Fetch embedding models from Hugging Face
export async function fetchEmbeddingModels(limit = 30): Promise<HuggingFaceModel[]> {
  try {
    const response = await fetch(
      `${HUGGINGFACE_API_BASE}/models?pipeline_tag=feature-extraction&sort=downloads&direction=-1&limit=${limit}`
    );
    if (!response.ok) throw new Error('Failed to fetch embedding models');
    const data: HuggingFaceModel[] = await response.json();

    // Also search for sentence-transformers models which are popular for embeddings
    const sentenceTransformersResponse = await fetch(
      `${HUGGINGFACE_API_BASE}/models?library=sentence-transformers&sort=downloads&direction=-1&limit=${limit}`
    );

    if (sentenceTransformersResponse.ok) {
      const sentenceData: HuggingFaceModel[] = await sentenceTransformersResponse.json();
      // Combine and deduplicate
      const combined = [...data, ...sentenceData];
      const unique = combined.filter((model, index, self) =>
        index === self.findIndex((m) => m.modelId === model.modelId)
      );
      return unique.slice(0, limit);
    }

    return data;
  } catch (error) {
    console.error('Error fetching embedding models:', error);
    return [];
  }
}

// Fetch popular embedding models with good performance
export async function fetchRecommendedEmbeddingModels(): Promise<HuggingFaceModel[]> {
  const recommendedModels = [
    'BAAI/bge-small-en-v1.5',
    'BAAI/bge-base-en-v1.5',
    'BAAI/bge-large-en-v1.5',
    'sentence-transformers/all-MiniLM-L6-v2',
    'sentence-transformers/all-mpnet-base-v2',
    'thenlper/gte-small',
    'thenlper/gte-base',
    'thenlper/gte-large',
    'intfloat/e5-small-v2',
    'intfloat/e5-base-v2',
    'intfloat/e5-large-v2',
  ];

  try {
    const models: HuggingFaceModel[] = [];
    for (const modelId of recommendedModels) {
      try {
        const details = await getModelDetails(modelId);
        if (details) {
          models.push({
            modelId: details.modelId || modelId,
            author: details.author || modelId.split('/')[0],
            downloads: details.downloads || 0,
            likes: details.likes || 0,
            tags: details.tags || [],
            pipeline_tag: details.pipeline_tag || 'feature-extraction',
            library_name: details.library_name || 'sentence-transformers',
          });
        }
      } catch {
        // Skip if model not found
      }
    }
    return models;
  } catch (error) {
    console.error('Error fetching recommended embedding models:', error);
    return [];
  }
}

// Check if model is available for download
export async function checkModelAvailability(modelId: string): Promise<boolean> {
  try {
    const details = await getModelDetails(modelId);
    return details && !details.private && !details.gated;
  } catch {
    return false;
  }
}

// Convert HuggingFace model to our HanzoModel format
export function convertToHanzoModel(hfModel: HuggingFaceModel): any {
  // Estimate size based on model name (this is a rough estimate)
  let estimatedSize = 7.0; // Default 7GB
  const modelName = hfModel.modelId.toLowerCase();

  if (modelName.includes('3b') || modelName.includes('3.')) estimatedSize = 2.0;
  else if (modelName.includes('7b') || modelName.includes('7.')) estimatedSize = 4.0;
  else if (modelName.includes('13b') || modelName.includes('13.')) estimatedSize = 8.0;
  else if (modelName.includes('30b') || modelName.includes('33b')) estimatedSize = 20.0;
  else if (modelName.includes('70b')) estimatedSize = 40.0;
  else if (modelName.includes('180b')) estimatedSize = 100.0;

  return {
    id: hfModel.modelId.replace('/', '-'),
    name: hfModel.modelId.split('/').pop() || hfModel.modelId,
    description: `${hfModel.modelId} - ${hfModel.downloads || 0} downloads`,
    size: estimatedSize,
    contextLength: 4096, // Default, would need model card parsing for accurate value
    quality: 'good',
    speed: estimatedSize < 10 ? 'fast' : 'average',
    capabilities: ['text-generation'],
    provider: hfModel.author || 'Community',
    huggingFaceUrl: `https://huggingface.co/${hfModel.modelId}`,
    downloads: hfModel.downloads,
    likes: hfModel.likes,
    tags: hfModel.tags,
  };
}