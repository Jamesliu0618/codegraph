import * as vscode from 'vscode';
import { isCodegraphInitialized } from '../utils/workspace';

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
    if (isCodegraphInitialized()) {
      this.statusBarItem.text = '$(check) CodeGraph';
      this.statusBarItem.tooltip = 'CodeGraph: Indexed';
      this.statusBarItem.backgroundColor = undefined;
    } else {
      this.statusBarItem.text = '$(warning) CodeGraph';
      this.statusBarItem.tooltip = 'CodeGraph: Not indexed';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
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
