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
  formName: string;
  filename: string;
  localPath: string;
  diffReport: DiffReport;
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
      title: '全部使用本地版本'
    },
    {
      title: '全部使用远程版本'
    },
    {
      title: '逐个询问'
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
