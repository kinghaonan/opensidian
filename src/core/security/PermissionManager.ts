import { OpensidianSettings, PermissionMode } from '../types/settings';
import { Platform } from 'obsidian';

export class PermissionManager {
  private settings: OpensidianSettings;

  constructor(settings: OpensidianSettings) {
    this.settings = settings;
  }

  updateSettings(settings: OpensidianSettings) {
    this.settings = settings;
  }

  getPermissionMode(): PermissionMode {
    return this.settings.permissionMode;
  }

  shouldAskForPermission(toolName: string): boolean {
    const mode = this.getPermissionMode();
    
    if (mode === 'yolo') {
      return false;
    }
    
    if (mode === 'safe') {
      // In safe mode, ask for dangerous tools
      const dangerousTools = ['bash', 'delete_note', 'move_note'];
      return dangerousTools.includes(toolName);
    }
    
    if (mode === 'plan') {
      // In plan mode, ask for all tool executions
      return true;
    }
    
    return false;
  }

  isCommandBlocked(command: string): boolean {
    if (!this.settings.enableCommandBlocklist) {
      return false;
    }

    const platform = Platform.isWin ? 'win32' : Platform.isMacOS ? 'darwin' : 'linux';
    const blockedCommands = this.settings.blockedCommands;

    // Check global blocked commands
    for (const pattern of blockedCommands.global) {
      if (this.matchPattern(command, pattern)) {
        return true;
      }
    }

    // Check platform-specific blocked commands
    const platformBlocked = blockedCommands[platform];
    if (platformBlocked) {
      for (const pattern of platformBlocked) {
        if (this.matchPattern(command, pattern)) {
          return true;
        }
      }
    }

    return false;
  }

  private matchPattern(command: string, pattern: string): boolean {
    // Support simple glob patterns
    const regex = new RegExp(
      pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
    );
    return regex.test(command);
  }

  isPathAllowed(_filePath: string): boolean {
    // Check if path is within vault or allowed export paths
    // This is a simplified version - full implementation would check actual paths
    return true;
  }
}
