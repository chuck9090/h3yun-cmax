import * as vscode from 'vscode';
import { DiffReport } from '../utils/diffUtils';

/**
 * 冲突解决选项
 */
export enum ConflictResolution {
  USE_LOCAL = 'local',      // 使用本地版本
  USE_REMOTE = 'remote',    // 使用远程版本
  SKIP = 'skip'             // 跳过此文件
}

/**
 * 文件冲突信息
 */
export interface FileConflict {
  filename: string;
  localPath: string;
  diffReport: DiffReport;
}

/**
 * 显示冲突解决对话框
 * @param conflict 文件冲突信息
 * @returns 用户选择的解决方案
 */
export async function showConflictDialog(conflict: FileConflict): Promise<ConflictResolution | null> {
  const { filename, diffReport } = conflict;
  
  // 构建详细的冲突信息
  const message = `检测到文件 "${filename}" 存在差异:\n\n` +
    `本地版本: ${diffReport.localLines} 行 (${diffReport.localSize} 字节)\n` +
    `远程版本: ${diffReport.remoteLines} 行 (${diffReport.remoteSize} 字节)\n` +
    `变化: +${diffReport.addedLines} 行, -${diffReport.removedLines} 行\n\n` +
    `请选择以哪个版本为准:`;
  
  const items: vscode.MessageItem[] = [
    {
      title: '$(file-code) 使用本地版本 (保留我的修改)'
    },
    {
      title: '$(cloud-download) 使用远程版本 (覆盖为氚云版本)'
    },
    {
      title: '$(skip) 跳过 (暂不处理)'
    }
  ];
  
  const selection = await vscode.window.showWarningMessage(
    message,
    { modal: true },
    ...items
  );
  
  if (!selection) {
    return null; // 用户关闭对话框
  }
  
  if (selection.title.includes('本地')) {
    return ConflictResolution.USE_LOCAL;
  } else if (selection.title.includes('远程')) {
    return ConflictResolution.USE_REMOTE;
  } else {
    return ConflictResolution.SKIP;
  }
}

/**
 * 批量冲突解决选项
 */
export enum BatchConflictResolution {
  USE_LOCAL_ALL = 'local_all',     // 全部使用本地
  USE_REMOTE_ALL = 'remote_all',   // 全部使用远程
  ASK_EACH = 'ask_each'            // 逐个询问
}

/**
 * 显示批量冲突解决对话框
 * @param conflictCount 冲突文件数量
 * @returns 用户选择的批量解决方案
 */
export async function showBatchConflictDialog(conflictCount: number): Promise<BatchConflictResolution | null> {
  const message = `发现 ${conflictCount} 个文件存在差异\n\n请选择处理方式:`;
  
  const items: vscode.MessageItem[] = [
    {
      title: '$(file-code) 全部使用本地版本 (保留所有本地修改)'
    },
    {
      title: '$(cloud-download) 全部使用远程版本 (覆盖为氚云版本)'
    },
    {
      title: '$(question) 逐个询问 (每个文件都让我选择)'
    }
  ];
  
  const selection = await vscode.window.showWarningMessage(
    message,
    { modal: true },
    ...items
  );
  
  if (!selection) {
    return null; // 用户关闭对话框
  }
  
  if (selection.title.includes('全部') && selection.title.includes('本地')) {
    return BatchConflictResolution.USE_LOCAL_ALL;
  } else if (selection.title.includes('全部') && selection.title.includes('远程')) {
    return BatchConflictResolution.USE_REMOTE_ALL;
  } else {
    return BatchConflictResolution.ASK_EACH;
  }
}
