import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel;

export function getLogger(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('CodeGraph');
  }
  return outputChannel;
}

export function log(message: string): void {
  const channel = getLogger();
  const timestamp = new Date().toISOString();
  channel.appendLine(`[${timestamp}] ${message}`);
}

export function logError(message: string, error?: Error): void {
  const channel = getLogger();
  const timestamp = new Date().toISOString();
  channel.appendLine(`[${timestamp}] ERROR: ${message}`);
  if (error) {
    channel.appendLine(`  ${error.message}`);
    if (error.stack) {
      channel.appendLine(`  ${error.stack}`);
    }
  }
}
