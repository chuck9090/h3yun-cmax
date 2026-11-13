import * as path from 'path';
import { fileService } from './fileService';
import { buildFolderName } from '../utils/folderUtils';

/**
 * 表单（含子表）编码到“字段编码 → 字段名称”的映射。
 */
export type FieldLabelMap = Map<string, Map<string, string>>;

/**
 * 字段名称索引：字段映射 + 表单到子表编码的关系 + 全局表单名称。
 * 自动化可以跨应用引用其他表单,因此索引覆盖整个“氚云代码”目录。
 */
export interface FieldLabelIndex {
  labels: FieldLabelMap;
  childrenOf: Map<string, string[]>;
  childNames: Map<string, string>;   // 子表编码 → 子表名称
  formNames: Map<string, string>;    // 表单编码 → 表单名称
}

/**
 * 单个 fields.md 的解析结果。
 */
export interface ParsedFieldLabels {
  main: Map<string, string>;                    // 主表字段
  children: Map<string, Map<string, string>>;   // 子表编码 → 子表字段
  childNames: Map<string, string>;              // 子表编码 → 子表名称
}

/**
 * 解析 fields.md 中的全部字段名称。
 * 文件由插件自身生成,格式固定：
 *   ## 主表          → 主表字段表格
 *   ## 子表名称       → 紧跟“子表编码：xxx”行,再是子表字段表格
 * @param content fields.md 内容
 */
export function parseFieldLabels(content: string): ParsedFieldLabels {
  const main = new Map<string, string>();
  const children = new Map<string, Map<string, string>>();
  const childNames = new Map<string, string>();

  // 当前正在收集的字段表
  let currentTable: Map<string, string> = main;
  // 当前章节标题,进入子表章节后即为子表名称
  let currentSection = '';

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    // 章节标题：主表或子表
    if (trimmed.startsWith('## ')) {
      currentSection = trimmed.slice(3).trim();
      currentTable = main;
      continue;
    }

    // 子表编码行决定后续表格归属
    const childCodeMatch = /^子表编码[：:]\s*([A-Za-z0-9]+)/.exec(trimmed);
    if (childCodeMatch) {
      const childCode = childCodeMatch[1];
      const childTable = new Map<string, string>();
      children.set(childCode, childTable);
      currentTable = childTable;

      if (currentSection && currentSection !== '主表') {
        childNames.set(childCode, currentSection);
      }
      continue;
    }

    if (!trimmed.startsWith('|')) continue;

    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length < 2) continue;

    const [code, name] = cells;
    // 跳过表头与分隔行
    if (!code || code === '编码' || /^[-:]+$/.test(code)) continue;
    if (!name) continue;

    currentTable.set(code, name);
  }

  return { main, children, childNames };
}

/**
 * 把一份 fields.md 的解析结果合并进索引。
 * 同一编码可能来自多个表单（尤其是复制的应用共用子表编码），
 * 合并时以先写入的为准、只补充缺失项，避免互相覆盖。
 */
function mergeFieldLabels(
  index: FieldLabelIndex,
  schemaCode: string,
  labels: Map<string, string>
): void {
  if (labels.size === 0) {
    return;
  }

  const existing = index.labels.get(schemaCode);
  if (!existing) {
    index.labels.set(schemaCode, new Map(labels));
    return;
  }

  for (const [code, name] of labels) {
    if (!existing.has(code)) {
      existing.set(code, name);
    }
  }
}

/**
 * 读取单个表单目录的 fields.md 并合并到索引。
 */
function mergeFormFields(index: FieldLabelIndex, formFolderPath: string, formCode: string): void {
  const fieldsPath = path.join(formFolderPath, 'fields.md');

  try {
    if (!fileService.fileExists(fieldsPath)) {
      return;
    }

    const parsed = parseFieldLabels(fileService.readFile(fieldsPath));
    mergeFieldLabels(index, formCode, parsed.main);

    const childCodes: string[] = [];
    for (const [childCode, childLabels] of parsed.children) {
      mergeFieldLabels(index, childCode, childLabels);
      childCodes.push(childCode);

      const childName = parsed.childNames.get(childCode);
      if (childName && !index.childNames.has(childCode)) {
        index.childNames.set(childCode, childName);
      }
    }

    if (childCodes.length > 0) {
      const existing = index.childrenOf.get(formCode) || [];
      index.childrenOf.set(formCode, Array.from(new Set([...existing, ...childCodes])));
    }
  } catch (error) {
    console.warn(`读取字段表失败,将回退为显示字段编码: ${fieldsPath}`, error);
  }
}

/**
 * 收集“氚云代码”目录下所有应用的字段名称索引。
 * 自动化可以跨应用引用其他表单的字段,因此不能只扫描当前应用。
 * @param codeFolderPath “氚云代码”根目录
 */
export function collectAllFieldLabels(codeFolderPath: string): FieldLabelIndex {
  const index: FieldLabelIndex = {
    labels: new Map(),
    childrenOf: new Map(),
    childNames: new Map(),
    formNames: new Map()
  };

  try {
    const workspaceConfig = fileService.readWorkspaceConfig(codeFolderPath);

    for (const [appSuffix, appConfig] of Object.entries(workspaceConfig.apps)) {
      const appFolderPath = path.join(
        codeFolderPath,
        buildFolderName(appConfig.appName, appSuffix)
      );

      for (const [formSuffix, entry] of Object.entries(appConfig.forms || {})) {
        if (!entry?.formCode) continue;

        // 表单名称来自 cmax.json,用于解析动作的目标表单
        if (entry.formName) {
          index.formNames.set(entry.formCode, entry.formName);
        }

        mergeFormFields(
          index,
          path.join(appFolderPath, buildFolderName(entry.formName, formSuffix)),
          entry.formCode
        );
      }
    }
  } catch (error) {
    console.warn('收集字段名称索引失败,将回退为显示字段编码:', error);
  }

  return index;
}
