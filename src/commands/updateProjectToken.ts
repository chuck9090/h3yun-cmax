import * as path from 'path';
import * as vscode from 'vscode';
import { fileService } from '../services/fileService';

/**
 * 获取统一更新 Token 时使用的项目目录
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
 * 统一覆盖项目中所有氚云应用的认证 Token
 * @param uri 资源管理器中选中的项目文件夹
 */
export async function handleUpdateProjectToken(uri?: vscode.Uri): Promise<void> {
  const projectFolderPath = getProjectFolderPath(uri);
  if (!projectFolderPath) {
    vscode.window.showErrorMessage('请先打开一个工作区文件夹');
    return;
  }

  let appFolderPaths: string[];
  try {
    appFolderPaths = fileService.findAppFolders(projectFolderPath);
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
    title: '统一更新氚云 Token',
    prompt: `输入一次 h3_token，将覆盖 ${appFolderPaths.length} 个应用的 .h3token`,
    placeHolder: '从浏览器 Cookie 中复制的 h3_token 值',
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => value.trim() ? null : 'h3_token 不能为空'
  });

  if (!token) {
    return;
  }

  const failedFolders: string[] = [];
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '正在统一更新氚云 Token',
      cancellable: false
    },
    async (progress) => {
      for (let index = 0; index < appFolderPaths.length; index++) {
        const appFolderPath = appFolderPaths[index];
        progress.report({
          message: `${index + 1}/${appFolderPaths.length} ${path.basename(appFolderPath)}`,
          increment: 100 / appFolderPaths.length
        });

        try {
          fileService.saveToken(appFolderPath, token);
          fileService.ensureGitIgnore(appFolderPath);
        } catch (error) {
          console.error(`更新应用 Token 失败: ${appFolderPath}`, error);
          failedFolders.push(path.basename(appFolderPath));
        }
      }
    }
  );

  const successCount = appFolderPaths.length - failedFolders.length;
  if (failedFolders.length > 0) {
    vscode.window.showWarningMessage(
      `已更新 ${successCount}/${appFolderPaths.length} 个应用，失败: ${failedFolders.join('、')}`,
      { modal: true }
    );
    return;
  }

  vscode.window.showInformationMessage(`Token 更新完成，共覆盖 ${successCount} 个应用的 .h3token`);
}
