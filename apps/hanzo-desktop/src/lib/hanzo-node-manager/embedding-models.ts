// Embedding models for vector search and RAG applications

export interface EmbeddingModel {
  id: string;
  name: string;
  description: string;
  dimensions: number;
  contextLength: number;
  size: number; // Size in GB
  performance: 'slow' | 'average' | 'fast' | 'very-fast';
  provider: string;
  huggingFaceUrl?: string;
  recommended?: boolean;
  tags?: string[];
}

// Top embedding models
export const EMBEDDING_MODELS: EmbeddingModel[] = [
  {
    id: 'bge-small-en',
    name: 'BGE Small EN',
    description: 'Fastest embedding model, great for real-time applications',
    dimensions: 384,
    contextLength: 512,
    size: 0.1,
    performance: 'very-fast',
    provider: 'BAAI',
    huggingFaceUrl: 'https://huggingface.co/BAAI/bge-small-en-v1.5',
    recommended: true,
  },
  {
    id: 'bge-base-en',
    name: 'BGE Base EN',
    description: 'Balanced performance and quality for most use cases',
    dimensions: 768,
    contextLength: 512,
    size: 0.4,
    performance: 'fast',
    provider: 'BAAI',
    huggingFaceUrl: 'https://huggingface.co/BAAI/bge-base-en-v1.5',
    recommended: true,
  },
  {
    id: 'bge-large-en',
    name: 'BGE Large EN',
    description: 'Highest quality embeddings for accuracy-critical applications',
    dimensions: 1024,
    contextLength: 512,
    size: 1.3,
    performance: 'average',
    provider: 'BAAI',
    huggingFaceUrl: 'https://huggingface.co/BAAI/bge-large-en-v1.5',
    recommended: true,
  },
  {
    id: 'all-minilm-l6',
    name: 'All-MiniLM-L6-v2',
    description: 'Compact model optimized for semantic search',
    dimensions: 384,
    contextLength: 256,
    size: 0.09,
    performance: 'very-fast',
    provider: 'Sentence Transformers',
    huggingFaceUrl: 'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2',
    recommended: true,
  },
  {
    id: 'all-mpnet-base',
    name: 'All-MPNet-Base-v2',
    description: 'Best quality from Sentence Transformers family',
    dimensions: 768,
    contextLength: 384,
    size: 0.4,
    performance: 'fast',
    provider: 'Sentence Transformers',
    huggingFaceUrl: 'https://huggingface.co/sentence-transformers/all-mpnet-base-v2',
  },
  {
    id: 'gte-small',
    name: 'GTE Small',
    description: 'Alibaba model with strong multilingual support',
    dimensions: 384,
    contextLength: 512,
    size: 0.1,
    performance: 'very-fast',
    provider: 'Thenlper',
    huggingFaceUrl: 'https://huggingface.co/thenlper/gte-small',
  },
  {
    id: 'gte-base',
    name: 'GTE Base',
    description: 'Balanced GTE model for general use',
    dimensions: 768,
    contextLength: 512,
    size: 0.4,
    performance: 'fast',
    provider: 'Thenlper',
    huggingFaceUrl: 'https://huggingface.co/thenlper/gte-base',
  },
  {
    id: 'gte-large',
    name: 'GTE Large',
    description: 'High-quality embeddings with extended context',
    dimensions: 1024,
    contextLength: 512,
    size: 1.3,
    performance: 'average',
    provider: 'Thenlper',
    huggingFaceUrl: 'https://huggingface.co/thenlper/gte-large',
  },
  {
    id: 'e5-small-v2',
    name: 'E5 Small v2',
    description: 'Microsoft model optimized for efficiency',
    dimensions: 384,
    contextLength: 512,
    size: 0.1,
    performance: 'very-fast',
    provider: 'Intfloat',
    huggingFaceUrl: 'https://huggingface.co/intfloat/e5-small-v2',
  },
  {
    id: 'e5-base-v2',
    name: 'E5 Base v2',
    description: 'Versatile model for diverse embedding tasks',
    dimensions: 768,
    contextLength: 512,
    size: 0.4,
    performance: 'fast',
    provider: 'Intfloat',
    huggingFaceUrl: 'https://huggingface.co/intfloat/e5-base-v2',
  },
  {
    id: 'e5-large-v2',
    name: 'E5 Large v2',
    description: 'State-of-the-art quality for retrieval tasks',
    dimensions: 1024,
    contextLength: 512,
    size: 1.3,
    performance: 'average',
    provider: 'Intfloat',
    huggingFaceUrl: 'https://huggingface.co/intfloat/e5-large-v2',
  },
  {
    id: 'instructor-base',
    name: 'Instructor Base',
    description: 'Task-specific embeddings with instruction following',
    dimensions: 768,
    contextLength: 512,
    size: 0.4,
    performance: 'fast',
    provider: 'INSTRUCTOR',
    huggingFaceUrl: 'https://huggingface.co/hkunlp/instructor-base',
  },
  {
    id: 'instructor-large',
    name: 'Instructor Large',
    description: 'Advanced instruction-following embedding model',
    dimensions: 1024,
    contextLength: 512,
    size: 1.3,
    performance: 'average',
    provider: 'INSTRUCTOR',
    huggingFaceUrl: 'https://huggingface.co/hkunlp/instructor-large',
  },
  {
    id: 'nomic-embed-text',
    name: 'Nomic Embed Text',
    description: 'Long context embeddings with 8k token support',
    dimensions: 768,
    contextLength: 8192,
    size: 0.5,
    performance: 'fast',
    provider: 'Nomic',
    huggingFaceUrl: 'https://huggingface.co/nomic-ai/nomic-embed-text-v1.5',
    recommended: true,
  },
  {
    id: 'jina-embeddings-v2-small',
    name: 'Jina v2 Small',
    description: 'Multilingual embeddings with 8k context',
    dimensions: 512,
    contextLength: 8192,
    size: 0.15,
    performance: 'fast',
    provider: 'Jina AI',
    huggingFaceUrl: 'https://huggingface.co/jinaai/jina-embeddings-v2-small-en',
  },
  {
    id: 'jina-embeddings-v2-base',
    name: 'Jina v2 Base',
    description: 'High-quality multilingual embeddings',
    dimensions: 768,
    contextLength: 8192,
    size: 0.5,
    performance: 'average',
    provider: 'Jina AI',
    huggingFaceUrl: 'https://huggingface.co/jinaai/jina-embeddings-v2-base-en',
  },
];

// Get recommended embedding models for specific use cases
export function getRecommendedEmbeddings(useCase?: 'speed' | 'quality' | 'multilingual' | 'long-context'): EmbeddingModel[] {
  switch (useCase) {
    case 'speed':
      return EMBEDDING_MODELS.filter(m => m.performance === 'very-fast');
    case 'quality':
      return EMBEDDING_MODELS.filter(m => m.dimensions >= 768);
    case 'multilingual':
      return EMBEDDING_MODELS.filter(m =>
        m.name.toLowerCase().includes('multilingual') ||
        m.description.toLowerCase().includes('multilingual') ||
        m.name.includes('GTE') ||
        m.name.includes('Jina')
      );
    case 'long-context':
      return EMBEDDING_MODELS.filter(m => m.contextLength >= 2048);
    default:
      return EMBEDDING_MODELS.filter(m => m.recommended);
  }
}

// Get embedding models by dimension size
export function getEmbeddingsByDimension(minDim: number, maxDim: number): EmbeddingModel[] {
  return EMBEDDING_MODELS.filter(m => m.dimensions >= minDim && m.dimensions <= maxDim);
}