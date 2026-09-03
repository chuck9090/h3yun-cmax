import * as path from 'path';
import * as vscode from 'vscode';
import { fileService } from '../services/fileService';
import { CODE_FOLDER_NAME, getCodeFolderPath } from '../utils/folderUtils';

/**
 * 获取更新 Token 时使用的项目目录
 * @param uri 资源管理器中选中的文件夹
 */
function getProjectFolderPath(uri?: vscode.Uri): string | undefined {
  if (uri) {
    return uri.fsPath;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }

  return workspaceFolders[0].uri.fsPath;
}

/**
 * 更新氚云代码目录中的统一认证 Token
 * @param uri 资源管理器中选中的项目文件夹
 */
export async function handleUpdateProjectToken(uri?: vscode.Uri): Promise<void> {
  const projectFolderPath = getProjectFolderPath(uri);
  if (!projectFolderPath) {
    vscode.window.showErrorMessage('请先打开一个工作区文件夹');
    return;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const codeFolderPath = path.basename(projectFolderPath) === CODE_FOLDER_NAME
    ? projectFolderPath
    : workspaceRoot
      ? getCodeFolderPath(workspaceRoot)
      : undefined;
  if (!codeFolderPath) {
    vscode.window.showErrorMessage('请先打开一个工作区文件夹');
    return;
  }

  const isCodeFolder = path.basename(projectFolderPath) === CODE_FOLDER_NAME;
  const isCodeAppFolder = path.basename(path.dirname(projectFolderPath)) === CODE_FOLDER_NAME;
  if (!isCodeFolder && !isCodeAppFolder && projectFolderPath !== workspaceRoot) {
    vscode.window.showWarningMessage('请在“氚云代码”目录或其下的应用文件夹上执行“更新氚云 Token”');
    return;
  }

  let appFolderPaths: string[];
  try {
    appFolderPaths = fileService.findAppFolders(codeFolderPath);
  } catch (error) {
    vscode.window.showErrorMessage(
      `扫描氚云应用文件夹失败: ${error instanceof Error ? error.message : String(error)}`
    );
    return;
  }

  if (appFolderPaths.length === 0) {
    vscode.window.showWarningMessage('所选文件夹下未找到包含 cmax.json 的氚云应用');
    return;
  }

  const token = await vscode.window.showInputBox({
    title: '更新氚云 Token',
    prompt: `输入一次 h3_token，更新“氚云代码”目录下的统一 .h3token（当前包含 ${appFolderPaths.length} 个应用）`,
    placeHolder: '从浏览器 Cookie 中复制的 h3_token 值',
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => value.trim() ? null : 'h3_token 不能为空'
  });

  if (!token) {
    return;
  }

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '正在更新氚云 Token',
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: '正在保存“氚云代码”目录下的统一 .h3token...' });
        fileService.saveToken(codeFolderPath, token);
        fileService.ensureGitIgnore(codeFolderPath);
      }
    );
  } catch (error) {
    vscode.window.showWarningMessage(
      `Token 更新失败: ${error instanceof Error ? error.message : String(error)}`,
      { modal: true }
    );
    return;
  }

  vscode.window.showInformationMessage(
    `Token 更新完成，已更新“氚云代码”目录下的统一 .h3token，当前可供 ${appFolderPaths.length} 个应用使用`
  );
}
