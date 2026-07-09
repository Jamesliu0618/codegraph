import * as vscode from 'vscode';
import { getInitializationSummary } from '../utils/workspace';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'codegraph.showStatus';
    this.update();
  }

  public update() {
    const summary = getInitializationSummary();
    if (summary.total === 0) {
      this.statusBarItem.text = '$(warning) CodeGraph';
      this.statusBarItem.tooltip = 'CodeGraph: No workspace open';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
    } else if (summary.initialized === summary.total) {
      this.statusBarItem.text = '$(check) CodeGraph';
      this.statusBarItem.tooltip = `CodeGraph: ${summary.initialized}/${summary.total} folders indexed`;
      this.statusBarItem.backgroundColor = undefined;
    } else if (summary.initialized === 0) {
      this.statusBarItem.text = '$(warning) CodeGraph';
      this.statusBarItem.tooltip = `CodeGraph: Not indexed (${summary.total} folder${summary.total === 1 ? '' : 's'})`;
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
    } else {
      this.statusBarItem.text = '$(sync~spin) CodeGraph';
      this.statusBarItem.tooltip = `CodeGraph: ${summary.initialized}/${summary.total} folders indexed`;
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.prominentBackground'
      );
    }
    this.statusBarItem.show();
  }

  public setIndexing() {
    this.statusBarItem.text = '$(sync~spin) CodeGraph: Indexing...';
    this.statusBarItem.tooltip = 'CodeGraph: Indexing in progress';
    this.statusBarItem.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.prominentBackground'
    );
  }

  public dispose() {
    this.statusBarItem.dispose();
  }
}
