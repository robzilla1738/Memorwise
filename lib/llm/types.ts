export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

export interface EmbeddingOptions {
  model?: string;
  texts: string[];
}

export interface LLMModel {
  id: string;
  name: string;
  provider: string;
  supportsStreaming: boolean;
}

export interface LLMProvider {
  readonly id: string;
  readonly name: string;
  isAvailable(): Promise<boolean>;
  listModels(): Promise<LLMModel[]>;
  generate(options: GenerateOptions): Promise<string>;
  generateStream(options: GenerateOptions, callbacks: StreamCallbacks): Promise<void>;
  readonly supportsEmbeddings: boolean;
  embed?(options: EmbeddingOptions): Promise<number[][]>;
}
