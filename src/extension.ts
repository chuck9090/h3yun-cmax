import * as vscode from 'vscode';
import { handleBuildProject } from './commands/buildProject';
import { handleSyncProject } from './commands/syncProject';

/**
 * 插件激活时调用
 * @param context 扩展上下文
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('H3Yun CMax 插件已激活');

  // 注册"从氚云构建项目"命令
  const buildProjectCommand = vscode.commands.registerCommand(
    'h3yun-cmax.buildProject',
    async () => {
      try {
        await handleBuildProject();
      } catch (error) {
        console.error('构建项目命令执行失败:', error);
        vscode.window.showErrorMessage(
          `构建项目失败: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // 注册"从氚云同步"命令
  const syncProjectCommand = vscode.commands.registerCommand(
    'h3yun-cmax.syncProject',
    async (uri?: vscode.Uri) => {
      try {
        await handleSyncProject(uri);
      } catch (error) {
        console.error('同步项目命令执行失败:', error);
        vscode.window.showErrorMessage(
          `同步项目失败: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // 将命令订阅添加到上下文
  context.subscriptions.push(buildProjectCommand);
  context.subscriptions.push(syncProjectCommand);
}

/**
 * 插件停用时调用
 */
export function deactivate() {
  console.log('H3Yun CMax 插件已停用');
}
