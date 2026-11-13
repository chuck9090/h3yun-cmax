import * as vscode from 'vscode';
import { handleSyncProject } from './syncProject';

/**
 * 同步自动化命令处理器。
 * 拉取应用下全部表单的自动化配置,按表单写入 automation.md。
 * @param uri 选中的文件夹 URI(从右键菜单传入)
 */
export async function handleSyncAutomation(uri?: vscode.Uri): Promise<void> {
  await handleSyncProject(uri, 'automation');
}
