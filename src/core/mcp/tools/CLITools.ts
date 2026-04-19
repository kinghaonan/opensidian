import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TFile } from 'obsidian';
import OpensidianPlugin from '../../../main';

/**
 * 注册 Obsidian CLI 相关的 MCP 工具
 */
export function registerCLITools(
  mcpServer: McpServer,
  plugin: OpensidianPlugin
): void {
  const cliService = plugin.obsidianCLI;

  // 工具 1: 创建笔记
  mcpServer.tool(
    'create_note',
    '在 Obsidian 中创建新笔记',
    {
      title: z.string().describe('笔记标题'),
      folder: z.string().optional().describe('文件夹路径（可选）'),
      template: z.string().optional().describe('模板名称（可选）'),
      content: z.string().optional().describe('笔记内容（可选）'),
    },
    async ({ title, folder, template, content }) => {
      try {
        if (!cliService.isAvailable()) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ Obsidian CLI 不可用。请确保已安装并启用 Obsidian CLI。',
              },
            ],
          };
        }

        await cliService.createNote(title, folder, template);
        
        let result = `✅ 成功创建笔记：${title}`;
        if (folder) result += `\n📁 文件夹：${folder}`;
        if (template) result += `\n📄 模板：${template}`;

        // 如果提供了内容，写入笔记
        if (content) {
          const vault = plugin.app.vault;
          const file = vault.getAbstractFileByPath(`${folder ? folder + '/' : ''}${title}.md`);
          if (file && file instanceof TFile) {
            await vault.modify(file, content);
            result += '\n✏️ 已写入内容';
          }
        }

        return {
          content: [{ type: 'text', text: result }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ 创建笔记失败：${error instanceof Error ? error.message : '未知错误'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 工具 2: 打开笔记
  mcpServer.tool(
    'open_note',
    '在 Obsidian 中打开指定笔记',
    {
      title: z.string().describe('笔记标题'),
    },
    async ({ title }) => {
      try {
        if (!cliService.isAvailable()) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ Obsidian CLI 不可用',
              },
            ],
          };
        }

        await cliService.openNote(title);

        return {
          content: [
            {
              type: 'text',
              text: `✅ 已打开笔记：${title}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ 打开笔记失败：${error instanceof Error ? error.message : '未知错误'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 工具 3: 搜索笔记
  mcpServer.tool(
    'search_notes',
    '在 Obsidian 中搜索笔记',
    {
      query: z.string().describe('搜索关键词'),
      limit: z.number().optional().default(10).describe('最大结果数量'),
    },
    async ({ query, limit }) => {
      try {
        if (!cliService.isAvailable()) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ Obsidian CLI 不可用',
              },
            ],
          };
        }

        const results = await cliService.searchNotes(query, limit);

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `📭 未找到与 "${query}" 相关的笔记`,
              },
            ],
          };
        }

        const formattedResults = results
          .map((result: any, index: number) => {
            return `${index + 1}. **${result.name}**\n   - 路径：${result.path}\n   - 创建时间：${new Date(result.created).toLocaleString()}`;
          })
          .join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `🔍 找到 ${results.length} 篇相关笔记：\n\n${formattedResults}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ 搜索失败：${error instanceof Error ? error.message : '未知错误'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 工具 4: 列出所有命令
  mcpServer.tool(
    'list_commands',
    '列出 Obsidian 中所有可用的命令',
    {},
    async () => {
      try {
        if (!cliService.isAvailable()) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ Obsidian CLI 不可用',
              },
            ],
          };
        }

        const commands = await cliService.listCommands();

        if (commands.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: '📭 没有找到可用命令',
              },
            ],
          };
        }

        const formattedCommands = commands
          .slice(0, 50) // 限制显示数量
          .map((cmd: any, index: number) => {
            return `${index + 1}. \`${cmd.id}\` - ${cmd.name || '无描述'}`;
          })
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `⌨️ 可用命令（共 ${commands.length} 个，显示前 50 个）：\n\n${formattedCommands}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ 获取命令列表失败：${error instanceof Error ? error.message : '未知错误'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 工具 5: 运行命令
  mcpServer.tool(
    'run_command',
    '运行 Obsidian 中的指定命令',
    {
      commandId: z.string().describe('命令 ID'),
    },
    async ({ commandId }) => {
      try {
        if (!cliService.isAvailable()) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ Obsidian CLI 不可用',
              },
            ],
          };
        }

        await cliService.runCommand(commandId);

        return {
          content: [
            {
              type: 'text',
              text: `✅ 命令执行成功：${commandId}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ 执行命令失败：${error instanceof Error ? error.message : '未知错误'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 工具 6: 获取 Vault 信息
  mcpServer.tool(
    'get_vault_info',
    '获取当前 Obsidian Vault 的详细信息',
    {},
    async () => {
      try {
        if (!cliService.isAvailable()) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ Obsidian CLI 不可用',
              },
            ],
          };
        }

        const vaultInfo = await cliService.getVaultInfo();

        const formattedInfo = `
📚 Vault 信息：
- 名称：${vaultInfo.name || '未知'}
- 路径：${vaultInfo.path || '未知'}
- 笔记数量：${vaultInfo.fileCount || '未知'}
- 文件夹数量：${vaultInfo.folderCount || '未知'}
`.trim();

        return {
          content: [
            {
              type: 'text',
              text: formattedInfo,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ 获取 Vault 信息失败：${error instanceof Error ? error.message : '未知错误'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 工具 7: 切换主题
  mcpServer.tool(
    'set_theme',
    '切换 Obsidian 的主题模式',
    {
      theme: z.enum(['light', 'dark', 'system']).describe('主题模式'),
    },
    async ({ theme }) => {
      try {
        if (!cliService.isAvailable()) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ Obsidian CLI 不可用',
              },
            ],
          };
        }

        await cliService.setTheme(theme);

        const themeNames = {
          light: '浅色',
          dark: '深色',
          system: '系统默认',
        };

        return {
          content: [
            {
              type: 'text',
              text: `🎨 已切换主题为：${themeNames[theme]} (${theme})`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ 切换主题失败：${error instanceof Error ? error.message : '未知错误'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
