export type ImageMode = 'local' | 'external';

export interface PromptAsset {
  id: string;
  name: string;
  prompt: string;
}

export interface Scene {
  id: string;
  title: string;
  excerpt: string;
  prompt: string;
  characters: string[];
  environments: string[];
  imageDataUrl?: string;
}

export interface ExternalConfig {
  provider: 'grok' | 'perplexity' | 'custom';
  endpoint: string;
  model: string;
  apiKey: string;
}

export interface StoryProject {
  id: string;
  name: string;
  createdAt: string;
  sourceText: string;
  characterAssets: PromptAsset[];
  environmentAssets: PromptAsset[];
  scenes: Scene[];
  frameCache: Record<string, string>;
  imageMode: ImageMode;
  externalConfig: ExternalConfig;
}
