export interface ParsedNote {
  frontmatter: Record<string, any>;
  content: string;
  originalContent: string;
}

export interface NoteWriteParams {
  path: string;
  content: string;
  frontmatter?: Record<string, any>;
  mode?: 'overwrite' | 'append' | 'prepend';
}

export interface NoteReadParams {
  path: string;
  includeContent?: boolean;
  includeFrontmatter?: boolean;
}

export interface PatchNoteParams {
  path: string;
  oldString: string;
  newString: string;
  replaceAll?: boolean;
}

export interface PatchNoteResult {
  success: boolean;
  path: string;
  message: string;
  matchCount?: number;
}

export interface DeleteNoteParams {
  path: string;
  confirmPath: string;
}

export interface DeleteResult {
  success: boolean;
  path: string;
  message: string;
}

export interface MoveNoteParams {
  oldPath: string;
  newPath: string;
  overwrite?: boolean;
}

export interface MoveResult {
  success: boolean;
  oldPath: string;
  newPath: string;
  message: string;
}

export interface SearchParams {
  query: string;
  limit?: number;
  searchContent?: boolean;
  searchFrontmatter?: boolean;
  caseSensitive?: boolean;
}

export interface SearchResult {
  path: string;
  title: string;
  excerpt: string;
  matchCount: number;
  lineNumber?: number;
  obsidianUri?: string;
}

export interface TagManagementParams {
  path: string;
  operation: 'add' | 'remove' | 'list';
  tags?: string[];
}

export interface TagManagementResult {
  path: string;
  operation: string;
  tags: string[];
  success: boolean;
  message: string;
}

export interface VaultStats {
  totalNotes: number;
  totalFolders: number;
  totalSize: number;
  lastModified: number;
  newestNote: string | null;
  oldestNote: string | null;
}

export interface FileInfo {
  path: string;
  size: number;
  modified: number;
  created: number;
  hasFrontmatter: boolean;
  obsidianUri: string;
}
