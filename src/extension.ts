import * as vscode from 'vscode';
import { handleBuildProject } from './commands/buildProject';
import { handleSyncProject } from './commands/syncProject';
import { handleSyncAutomation } from './commands/syncAutomation';
import { handleUpdateProjectToken } from './commands/updateProjectToken';
import { handleQueryFormName } from './commands/queryFormName';
import { registerH3yunFrontendApiProvider } from './providers/h3yunFrontendApiProvider';
import { registerH3yunBackendApiProvider } from './providers/h3yunBackendApiProvider';

/**
 * 插件激活时调用
 * @param context 扩展上下文
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('H3Yun CMax 插件已激活');
  registerH3yunFrontendApiProvider(context);
  registerH3yunBackendApiProvider(context);

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

  // 注册"从氚云分项同步"子菜单中的命令
  const syncFormDesignCommand = vscode.commands.registerCommand(
    'h3yun-cmax.syncFormDesign',
    async (uri?: vscode.Uri) => {
      try {
        await handleSyncProject(uri, 'formDesign');
      } catch (error) {
        console.error('同步表单设计命令执行失败:', error);
        vscode.window.showErrorMessage(
          `同步表单设计失败: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  const syncCodeCommand = vscode.commands.registerCommand(
    'h3yun-cmax.syncCode',
    async (uri?: vscode.Uri) => {
      try {
        await handleSyncProject(uri, 'code');
      } catch (error) {
        console.error('同步代码命令执行失败:', error);
        vscode.window.showErrorMessage(
          `同步代码失败: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  const syncAutomationCommand = vscode.commands.registerCommand(
    'h3yun-cmax.syncAutomation',
    async (uri?: vscode.Uri) => {
      try {
        await handleSyncAutomation(uri);
      } catch (error) {
        console.error('同步自动化命令执行失败:', error);
        vscode.window.showErrorMessage(
          `同步自动化失败: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  const updateProjectTokenCommand = vscode.commands.registerCommand(
    'h3yun-cmax.updateProjectToken',
    async (uri?: vscode.Uri) => {
      try {
        await handleUpdateProjectToken(uri);
      } catch (error) {
        console.error('更新氚云 Token 命令执行失败:', error);
        vscode.window.showErrorMessage(
          `更新氚云 Token 失败: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  const queryFormNameCommand = vscode.commands.registerCommand(
    'h3yun-cmax.queryFormName',
    async (uri?: vscode.Uri) => {
      await handleQueryFormName(uri);
    }
  );

  // 将命令订阅添加到上下文
  context.subscriptions.push(buildProjectCommand);
  context.subscriptions.push(syncProjectCommand);
  context.subscriptions.push(syncFormDesignCommand);
  context.subscriptions.push(syncCodeCommand);
  context.subscriptions.push(syncAutomationCommand);
  context.subscriptions.push(updateProjectTokenCommand);
  context.subscriptions.push(queryFormNameCommand);
}

/**
 * 插件停用时调用
 */
export function deactivate() {
  console.log('H3Yun CMax 插件已停用');
}
