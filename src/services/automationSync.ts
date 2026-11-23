import * as path from 'path';
import { CmaxFormEntry, FormAutomations } from '../types';
import { fileService } from './fileService';
import {
  AUTOMATION_FILENAME,
  buildAutomationMarkdown,
  buildEmptyAutomationMarkdown
} from './automationReport';
import { listSubfolders } from '../utils/folderUtils';

export interface AutomationWriteSummary {
  writtenCount: number;
  emptyCount: number;
  skippedCount: number;
  automationCount: number;
}

function findFormFolderBySuffix(appFolderPath: string, suffix: string): string | undefined {
  const suffixPattern = `(${suffix})`;
  const folderName = listSubfolders(appFolderPath).find((name) => name.endsWith(suffixPattern));
  return folderName ? path.join(appFolderPath, folderName) : undefined;
}

/**
 * 将应用自动化配置直接覆盖写入本地各表单目录。
 * 自动化文件不参与代码冲突确认；没有自动化的本地表单也会清理为明确的空配置说明。
 */
export function writeAutomationFiles(
  appFolderPath: string,
  forms: Record<string, CmaxFormEntry>,
  formAutomations: FormAutomations[]
): AutomationWriteSummary {
  const suffixByFormCode = new Map(
    Object.entries(forms).map(([suffix, entry]) => [entry.formCode, suffix])
  );
  let writtenCount = 0;
  let emptyCount = 0;
  let skippedCount = 0;
  let automationCount = 0;

  for (const form of formAutomations) {
    const suffix = suffixByFormCode.get(form.schemaCode);
    const formFolderPath = suffix ? findFormFolderBySuffix(appFolderPath, suffix) : undefined;

    if (!suffix || !formFolderPath) {
      console.log(`同步自动化跳过本地不存在的表单目录: ${form.formName}(${form.schemaCode})`);
      skippedCount++;
      continue;
    }

    fileService.saveFile(
      path.join(formFolderPath, AUTOMATION_FILENAME),
      buildAutomationMarkdown(form)
    );
    writtenCount++;
    automationCount += form.automations.length;
    if (form.automations.length === 0) {
      emptyCount++;
    }
  }

  // 接口未返回自动化记录的本地表单也要覆盖旧文件,避免残留已删除的自动化配置。
  const handledCodes = new Set(formAutomations.map((form) => form.schemaCode));
  for (const [suffix, entry] of Object.entries(forms)) {
    if (handledCodes.has(entry.formCode)) continue;

    const formFolderPath = findFormFolderBySuffix(appFolderPath, suffix);
    if (!formFolderPath) continue;

    fileService.saveFile(
      path.join(formFolderPath, AUTOMATION_FILENAME),
      buildEmptyAutomationMarkdown(entry.formName, entry.formCode)
    );
    writtenCount++;
    emptyCount++;
  }

  return { writtenCount, emptyCount, skippedCount, automationCount };
}
