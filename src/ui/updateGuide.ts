import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const UPDATE_GUIDE_FILENAME = 'update-guide.html';

/**
 * 打开氚云代码目录结构更新指南。
 */
export function openUpdateGuide(): void {
  const guidePath = path.join(__dirname, '..', 'assets', UPDATE_GUIDE_FILENAME);
  let guideHtml: string;

  try {
    guideHtml = fs.readFileSync(guidePath, 'utf-8');
  } catch (error) {
    vscode.window.showErrorMessage(
      `读取更新指南失败: ${error instanceof Error ? error.message : String(error)}`
    );
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'h3yunUpdateGuide',
    '氚云代码重大更新使用指南',
    vscode.ViewColumn.One,
    { enableScripts: false, retainContextWhenHidden: true }
  );
  panel.webview.html = guideHtml;
}

/**
 * 提示用户查看更新指南。
 */
export async function promptForUpdateGuide(message: string): Promise<void> {
  const action = await vscode.window.showWarningMessage(
    message,
    { modal: true },
    '查看更新指南'
  );

  if (action === '查看更新指南') {
    openUpdateGuide();
  }
}
