export interface Notebook {
  id: string;
  name: string;
  description: string;
  embedding_model: string;
  embedding_dimension: number;
  created_at: string;
  updated_at: string;
}

export interface Source {
  id: string;
  notebook_id: string;
  filename: string;
  filepath: string;
  filetype: string;
  file_size: number;
  chunk_count: number;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_message: string | null;
  source_type: 'file' | 'url' | 'youtube' | 'image' | 'audio' | 'video';
  folder_id: string | null;
  summary: string | null;
  created_at: string;
}

export interface Folder {
  id: string;
  notebook_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
}

export interface Tag {
  id: string;
  notebook_id: string;
  name: string;
  color: string;
}

export interface TagAssignment {
  tag_id: string;
  target_id: string;
  target_type: 'source' | 'note';
}

export interface Link {
  id: string;
  notebook_id: string;
  from_id: string;
  from_type: 'note' | 'source';
  to_id: string;
  to_type: 'note' | 'source';
  created_at: string;
}

export interface ChatSession {
  id: string;
  notebook_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: Citation[] | null;
  created_at: string;
}

export interface Citation {
  source_id: string;
  filename: string;
  chunk_text: string;
  score: number;
}

export interface Note {
  id: string;
  notebook_id: string;
  title: string;
  content: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LLMModel {
  id: string;
  name: string;
  provider: string;
  supportsStreaming: boolean;
}

// Graph types
export interface GraphNode {
  id: string;
  type: 'source' | 'note' | 'tag';
  label: string;
  sourceType?: string;
  status?: string;
  color?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'link' | 'tag' | 'citation' | 'similarity';
  similarity?: number;
}
