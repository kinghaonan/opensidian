import OpensidianPlugin from '../../../main';
import { 
  ParsedNote, 
  NoteWriteParams, 
  PatchNoteParams,
  DeleteNoteParams,
  MoveNoteParams,
  SearchParams,
  SearchResult,
  TagManagementParams,
  TagManagementResult,
  VaultStats,
  FileInfo
} from '../../types/vault';
import { TFile, TFolder } from 'obsidian';
import matter from 'gray-matter';

export class InternalMCPServer {
  private plugin: OpensidianPlugin;
  private ignoredPatterns = [
    '.obsidian/**',
    '.git/**',
    'node_modules/**',
    '.DS_Store',
    'Thumbs.db',
    '*.tmp',
    '*.temp'
  ];

  constructor(plugin: OpensidianPlugin) {
    this.plugin = plugin;
  }

  getTools(): any[] {
    return [
      {
        name: 'read_note',
        description: 'Read a note from the Obsidian vault with frontmatter',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the note relative to vault root' }
          },
          required: ['path']
        }
      },
      {
        name: 'write_note',
        description: 'Write a note to the vault. Supports overwrite, append, or prepend modes.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
            frontmatter: { type: 'object' },
            mode: { type: 'string', enum: ['overwrite', 'append', 'prepend'], default: 'overwrite' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'patch_note',
        description: 'Replace specific content in a note using string matching',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            oldString: { type: 'string' },
            newString: { type: 'string' },
            replaceAll: { type: 'boolean', default: false }
          },
          required: ['path', 'oldString', 'newString']
        }
      },
      {
        name: 'list_directory',
        description: 'List files and directories in a vault path',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', default: '' }
          }
        }
      },
      {
        name: 'delete_note',
        description: 'Delete a note from the vault (requires confirmation)',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            confirmPath: { type: 'string', description: 'Must match path exactly to confirm deletion' }
          },
          required: ['path', 'confirmPath']
        }
      },
      {
        name: 'search_notes',
        description: 'Search for notes by content or frontmatter',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            limit: { type: 'number', default: 10 },
            searchContent: { type: 'boolean', default: true },
            searchFrontmatter: { type: 'boolean', default: false },
            caseSensitive: { type: 'boolean', default: false }
          },
          required: ['query']
        }
      },
      {
        name: 'move_note',
        description: 'Move or rename a note',
        parameters: {
          type: 'object',
          properties: {
            oldPath: { type: 'string' },
            newPath: { type: 'string' },
            overwrite: { type: 'boolean', default: false }
          },
          required: ['oldPath', 'newPath']
        }
      },
      {
        name: 'get_notes_info',
        description: 'Get metadata for notes without reading full content',
        parameters: {
          type: 'object',
          properties: {
            paths: { type: 'array', items: { type: 'string' } }
          },
          required: ['paths']
        }
      },
      {
        name: 'update_frontmatter',
        description: 'Update frontmatter of a note without changing content',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            frontmatter: { type: 'object' },
            merge: { type: 'boolean', default: true }
          },
          required: ['path', 'frontmatter']
        }
      },
      {
        name: 'manage_tags',
        description: 'Add, remove, or list tags in a note',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            operation: { type: 'string', enum: ['add', 'remove', 'list'] },
            tags: { type: 'array', items: { type: 'string' } }
          },
          required: ['path', 'operation']
        }
      },
      {
        name: 'get_vault_stats',
        description: 'Get statistics about the vault',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }

  async executeTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'read_note':
        return this.readNote(args.path);
      case 'write_note':
        return this.writeNote(args);
      case 'patch_note':
        return this.patchNote(args);
      case 'list_directory':
        return this.listDirectory(args.path || '');
      case 'delete_note':
        return this.deleteNote(args);
      case 'search_notes':
        return this.searchNotes(args);
      case 'move_note':
        return this.moveNote(args);
      case 'get_notes_info':
        return this.getNotesInfo(args.paths);
      case 'update_frontmatter':
        return this.updateFrontmatter(args);
      case 'manage_tags':
        return this.manageTags(args);
      case 'get_vault_stats':
        return this.getVaultStats();
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async readNote(filePath: string): Promise<ParsedNote> {
    const file = this.getFile(filePath);
    if (!file) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = await this.plugin.app.vault.cachedRead(file);
    const parsed = matter(content);

    return {
      frontmatter: parsed.data || {},
      content: parsed.content,
      originalContent: content
    };
  }

  private async writeNote(params: NoteWriteParams): Promise<{ message: string }> {
    const { path: filePath, content, frontmatter, mode = 'overwrite' } = params;
    
    const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
    
    if (mode === 'overwrite' || !file) {
      // Create or overwrite
      let finalContent = content;
      if (frontmatter && Object.keys(frontmatter).length > 0) {
        finalContent = matter.stringify(content, frontmatter);
      }
      
      if (file instanceof TFile) {
        await this.plugin.app.vault.modify(file, finalContent);
      } else {
        // Ensure parent directory exists
        await this.ensureDirectory(this.getParentPath(filePath));
        await this.plugin.app.vault.create(filePath, finalContent);
      }
    } else if (file instanceof TFile) {
      // Append or prepend
      const existingContent = await this.plugin.app.vault.cachedRead(file);
      const existing = matter(existingContent);
      
      let newContent: string;
      const mergedFrontmatter = { ...existing.data, ...frontmatter };
      
      if (mode === 'append') {
        newContent = existing.content + '\n' + content;
      } else {
        newContent = content + '\n' + existing.content;
      }
      
      const finalContent = matter.stringify(newContent, mergedFrontmatter);
      await this.plugin.app.vault.modify(file, finalContent);
    }

    return { message: `Successfully wrote note: ${filePath}` };
  }

  private async patchNote(params: PatchNoteParams): Promise<any> {
    const { path: filePath, oldString, newString, replaceAll = false } = params;
    
    if (!oldString) {
      throw new Error('oldString cannot be empty');
    }

    const file = this.getFile(filePath);
    if (!file) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = await this.plugin.app.vault.cachedRead(file);
    const parsed = matter(content);
    
    let matchCount = 0;
    let newContent = parsed.content;
    
    if (replaceAll) {
      const regex = new RegExp(this.escapeRegex(oldString), 'g');
      matchCount = (parsed.content.match(regex) || []).length;
      newContent = parsed.content.replace(regex, newString);
    } else {
      const index = parsed.content.indexOf(oldString);
      if (index !== -1) {
        matchCount = 1;
        newContent = parsed.content.substring(0, index) + 
                     newString + 
                     parsed.content.substring(index + oldString.length);
      }
    }

    if (matchCount === 0) {
      throw new Error(`Could not find text to replace in ${filePath}`);
    }

    const finalContent = matter.stringify(newContent, parsed.data);
    await this.plugin.app.vault.modify(file, finalContent);

    return {
      success: true,
      path: filePath,
      matchCount,
      message: `Successfully patched note: ${filePath}`
    };
  }

  private async listDirectory(dirPath: string): Promise<{ dirs: string[], files: string[] }> {
    const folder = dirPath 
      ? this.plugin.app.vault.getAbstractFileByPath(dirPath)
      : this.plugin.app.vault.getRoot();

    if (!(folder instanceof TFolder)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

    const dirs: string[] = [];
    const files: string[] = [];

    for (const child of folder.children) {
      if (this.isIgnored(child.path)) continue;
      
      if (child instanceof TFolder) {
        dirs.push(child.name);
      } else if (child instanceof TFile && child.extension === 'md') {
        files.push(child.name);
      }
    }

    return { dirs, files };
  }

  private async deleteNote(params: DeleteNoteParams): Promise<any> {
    const { path: filePath, confirmPath } = params;
    
    if (filePath !== confirmPath) {
      return {
        success: false,
        path: filePath,
        message: 'Deletion cancelled: confirmation path does not match'
      };
    }

    const file = this.getFile(filePath);
    if (!file) {
      throw new Error(`File not found: ${filePath}`);
    }

    await this.plugin.app.vault.trash(file, false);

    return {
      success: true,
      path: filePath,
      message: `Successfully deleted note: ${filePath}`
    };
  }

  private async searchNotes(params: SearchParams): Promise<SearchResult[]> {
    const { 
      query, 
      limit = 10, 
      searchContent = true, 
      searchFrontmatter = false,
      caseSensitive = false 
    } = params;

    const results: SearchResult[] = [];
    const files = this.plugin.app.vault.getMarkdownFiles();
    
    const searchRegex = new RegExp(
      this.escapeRegex(query),
      caseSensitive ? 'g' : 'gi'
    );

    for (const file of files) {
      if (this.isIgnored(file.path)) continue;
      if (results.length >= limit) break;

      try {
        const content = await this.plugin.app.vault.cachedRead(file);
        const parsed = matter(content);
        
        let matchCount = 0;
        let excerpt = '';
        let lineNumber: number | undefined;

        if (searchContent) {
          const matches = parsed.content.match(searchRegex);
          if (matches) {
            matchCount = matches.length;
            const index = parsed.content.search(searchRegex);
            excerpt = this.extractExcerpt(parsed.content, index);
            lineNumber = this.getLineNumber(parsed.content, index);
          }
        }

        if (searchFrontmatter && matchCount === 0) {
          const fmString = JSON.stringify(parsed.data);
          const matches = fmString.match(searchRegex);
          if (matches) {
            matchCount = matches.length;
            excerpt = '[Found in frontmatter]';
          }
        }

        if (matchCount > 0) {
          results.push({
            path: file.path,
            title: file.basename,
            excerpt,
            matchCount,
            lineNumber,
            obsidianUri: this.generateObsidianUri(file.path)
          });
        }
      } catch (error) {
        console.error(`Error searching file ${file.path}:`, error);
      }
    }

    return results;
  }

  private async moveNote(params: MoveNoteParams): Promise<any> {
    const { oldPath, newPath, overwrite = false } = params;
    
    const oldFile = this.getFile(oldPath);
    if (!oldFile) {
      throw new Error(`Source file not found: ${oldPath}`);
    }

    const existingNewFile = this.getFile(newPath);
    if (existingNewFile && !overwrite) {
      throw new Error(`Destination file already exists: ${newPath}`);
    }

    // Ensure parent directory exists
    await this.ensureDirectory(this.getParentPath(newPath));

    // Move the file
    await this.plugin.app.fileManager.renameFile(oldFile, newPath);

    return {
      success: true,
      oldPath,
      newPath,
      message: `Successfully moved note from ${oldPath} to ${newPath}`
    };
  }

  private async getNotesInfo(paths: string[]): Promise<FileInfo[]> {
    const results: FileInfo[] = [];

    for (const filePath of paths) {
      const file = this.getFile(filePath);
      if (!file) {
        results.push({
          path: filePath,
          size: 0,
          modified: 0,
          created: 0,
          hasFrontmatter: false,
          obsidianUri: ''
        });
        continue;
      }

      const stat = await this.plugin.app.vault.adapter.stat(filePath);
      const content = await this.plugin.app.vault.cachedRead(file);
      const parsed = matter(content);

      results.push({
        path: filePath,
        size: stat?.size || 0,
        modified: stat?.mtime || 0,
        created: stat?.ctime || 0,
        hasFrontmatter: Object.keys(parsed.data).length > 0,
        obsidianUri: this.generateObsidianUri(filePath)
      });
    }

    return results;
  }

  private async updateFrontmatter(params: { path: string; frontmatter: any; merge?: boolean }): Promise<any> {
    const { path: filePath, frontmatter, merge = true } = params;
    
    const file = this.getFile(filePath);
    if (!file) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = await this.plugin.app.vault.cachedRead(file);
    const parsed = matter(content);
    
    const newFrontmatter = merge 
      ? { ...parsed.data, ...frontmatter }
      : frontmatter;

    const finalContent = matter.stringify(parsed.content, newFrontmatter);
    await this.plugin.app.vault.modify(file, finalContent);

    return { message: `Successfully updated frontmatter for: ${filePath}` };
  }

  private async manageTags(params: TagManagementParams): Promise<TagManagementResult> {
    const { path: filePath, operation, tags = [] } = params;
    
    const file = this.getFile(filePath);
    if (!file) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = await this.plugin.app.vault.cachedRead(file);
    const parsed = matter(content);
    
    let currentTags: string[] = [];
    const tagsData = parsed.data.tags;
    if (Array.isArray(tagsData)) {
      currentTags = tagsData as string[];
    } else if (typeof tagsData === 'string') {
      currentTags = tagsData.split(',').map((t: string) => t.trim());
    }

    let updatedTags: string[];
    let message: string;

    switch (operation) {
      case 'add':
        updatedTags = [...new Set([...currentTags, ...tags])];
        message = 'Successfully added tags';
        break;
      case 'remove':
        updatedTags = currentTags.filter(t => !tags.includes(t));
        message = 'Successfully removed tags';
        break;
      case 'list':
      default:
        return {
          path: filePath,
          operation,
          tags: currentTags,
          success: true,
          message: `Found ${currentTags.length} tags`
        };
    }

    parsed.data.tags = updatedTags;
    const finalContent = matter.stringify(parsed.content, parsed.data);
    await this.plugin.app.vault.modify(file, finalContent);

    return {
      path: filePath,
      operation,
      tags: updatedTags,
      success: true,
      message
    };
  }

  private async getVaultStats(): Promise<VaultStats> {
    const files = this.plugin.app.vault.getMarkdownFiles();
    const allFiles = this.plugin.app.vault.getFiles();
    
    let totalSize = 0;
    let lastModified = 0;
    let newestNote: string | null = null;
    let oldestNote: string | null = null;
    let newestTime = 0;
    let oldestTime = Date.now();

    for (const file of allFiles) {
      const stat = await this.plugin.app.vault.adapter.stat(file.path);
      if (stat) {
        totalSize += stat.size;
        
        if (stat.mtime > lastModified) {
          lastModified = stat.mtime;
        }
        
        if (file.extension === 'md') {
          if (stat.mtime > newestTime) {
            newestTime = stat.mtime;
            newestNote = file.path;
          }
          if (stat.mtime < oldestTime) {
            oldestTime = stat.mtime;
            oldestNote = file.path;
          }
        }
      }
    }

    // Count folders
    let folderCount = 0;
    const traverse = (folder: TFolder) => {
      for (const child of folder.children) {
        if (child instanceof TFolder) {
          folderCount++;
          traverse(child);
        }
      }
    };
    traverse(this.plugin.app.vault.getRoot());

    return {
      totalNotes: files.length,
      totalFolders: folderCount,
      totalSize,
      lastModified,
      newestNote,
      oldestNote
    };
  }

  // Helper methods
  private getFile(path: string): TFile | null {
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? file : null;
  }

  private isIgnored(filePath: string): boolean {
    for (const pattern of this.ignoredPatterns) {
      if (this.matchGlob(filePath, pattern)) {
        return true;
      }
    }
    return false;
  }

  private matchGlob(path: string, pattern: string): boolean {
    // Simple glob matching
    const regex = new RegExp(
      '^' + 
      pattern
        .replace(/\*\*/g, '###GLOB###')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.')
        .replace(/###GLOB###/g, '.*')
        .replace(/\./g, '\\.') +
      '$'
    );
    return regex.test(path);
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private extractExcerpt(content: string, index: number, length = 50): string {
    const start = Math.max(0, index - length);
    const end = Math.min(content.length, index + length);
    return content.substring(start, end).replace(/\n/g, ' ');
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private getParentPath(filePath: string): string {
    const lastSlash = filePath.lastIndexOf('/');
    return lastSlash > 0 ? filePath.substring(0, lastSlash) : '';
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    if (!dirPath) return;
    
    const exists = await this.plugin.app.vault.adapter.exists(dirPath);
    if (!exists) {
      await this.plugin.app.vault.createFolder(dirPath);
    }
  }

  private generateObsidianUri(filePath: string): string {
    const vaultName = this.plugin.app.vault.getName();
    const pathWithoutExt = filePath.replace(/\.md$/, '');
    return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(pathWithoutExt)}`;
  }
}
