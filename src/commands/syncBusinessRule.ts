import * as vscode from 'vscode';
import { handleSyncProject } from './syncProject';

/**
 * 同步业务规则命令处理器。
 * 逐个表单拉取业务规则,按表单写入 business-rule.md。
 * @param uri 选中的文件夹 URI(从右键菜单传入)
 */
export async function handleSyncBusinessRule(uri?: vscode.Uri): Promise<void> {
  await handleSyncProject(uri, 'businessRule');
}
