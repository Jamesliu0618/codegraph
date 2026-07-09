import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { log, logError } from '../utils/logger';
import { getWorkspaceRoot } from '../utils/workspace';

export class CopilotIntegration {
  public async register(): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) {
      log('Copilot: No workspace root, skipping registration');
      return;
    }

    try {
      // Write .vscode/mcp.json for Copilot Coding Agent
      const vscodeDir = path.join(root, '.vscode');
      if (!fs.existsSync(vscodeDir)) {
        fs.mkdirSync(vscodeDir, { recursive: true });
      }

      const mcpConfig = {
        servers: {
          codegraph: {
            command: 'codegraph',
            args: ['serve', '--mcp'],
            cwd: root,
          },
        },
      };

      const mcpPath = path.join(vscodeDir, 'mcp.json');
      fs.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2));
      log(`Copilot: Written MCP config to ${mcpPath}`);
    } catch (error) {
      logError('Copilot: Failed to register', error as Error);
    }
  }
}
