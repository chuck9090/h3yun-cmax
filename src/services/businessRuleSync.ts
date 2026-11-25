import * as path from 'path';
import { BusinessRule, CmaxFormEntry } from '../types';
import { fileService } from './fileService';
import {
  BUSINESS_RULE_FILENAME,
  buildBusinessRuleMarkdown,
  buildEmptyBusinessRuleMarkdown
} from './businessRuleReport';
import { listSubfolders } from '../utils/folderUtils';

export interface BusinessRuleWriteSummary {
  writtenCount: number;
  emptyCount: number;
  skippedCount: number;
  ruleCount: number;
}

/**
 * 把业务规则直接覆盖写入本地各表单目录。
 * 业务规则文件不参与代码冲突确认;没有业务规则的本地表单也会写成只包含“无”的文件。
 *
 * 只处理 `rulesByFormCode` 中出现的表单:请求失败的表单不传入,其本地旧文件保持不变,
 * 避免接口异常时把已有规则清空。
 */
export function writeBusinessRuleFiles(
  appFolderPath: string,
  forms: Record<string, CmaxFormEntry>,
  rulesByFormCode: Map<string, BusinessRule[]>
): BusinessRuleWriteSummary {
  const entryByFormCode = new Map<string, { suffix: string; entry: CmaxFormEntry }>();
  for (const [suffix, entry] of Object.entries(forms)) {
    entryByFormCode.set(entry.formCode, { suffix, entry });
  }

  // 按后缀定位真实目录,避免表单在氚云改名后目录名与配置不一致导致写错位置。
  // 同后缀存在多个目录时固定使用第一个,与 automationSync 的行为保持一致。
  const folderNameBySuffix = new Map<string, string>();
  for (const folderName of listSubfolders(appFolderPath)) {
    const suffixMatch = folderName.match(/\((f[0-9a-z]{5,32})\)$/);
    if (suffixMatch && !folderNameBySuffix.has(suffixMatch[1])) {
      folderNameBySuffix.set(suffixMatch[1], folderName);
    }
  }

  let writtenCount = 0;
  let emptyCount = 0;
  let skippedCount = 0;
  let ruleCount = 0;

  for (const [formCode, rules] of rulesByFormCode) {
    const target = entryByFormCode.get(formCode);
    const folderName = target ? folderNameBySuffix.get(target.suffix) : undefined;

    if (!target || !folderName) {
      console.log(`同步业务规则跳过本地不存在的表单目录: ${formCode}`);
      skippedCount++;
      continue;
    }

    const content = rules.length > 0
      ? buildBusinessRuleMarkdown({
        schemaCode: formCode,
        formName: target.entry.formName,
        rules
      })
      : buildEmptyBusinessRuleMarkdown(target.entry.formName, formCode);

    fileService.saveFile(path.join(appFolderPath, folderName, BUSINESS_RULE_FILENAME), content);
    writtenCount++;
    ruleCount += rules.length;
    if (rules.length === 0) {
      emptyCount++;
    }
  }

  return { writtenCount, emptyCount, skippedCount, ruleCount };
}
