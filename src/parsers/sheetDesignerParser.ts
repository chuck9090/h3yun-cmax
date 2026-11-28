interface FieldInfo {
  key: string;
  displayName: string;
  controlType: string;
  valueType: string;
  databaseDescription: string;
  /** 是否允许用设计内容里同编码控件的名称覆盖默认名称。仅针对表单设计器里可拖入的系统控件。 */
  mutableName?: boolean;
}

interface ChildTableInfo {
  key: string;
  displayName: string;
  fields: FieldInfo[];
}

interface SchemaInfo {
  schemaName: string;
  schemaCode: string;
  controlsData: unknown;
}

export interface SheetDesignerLoadFormResponse {
  Successful?: boolean;
  successful?: boolean;
  ErrorMessage?: string | null;
  ReturnData?: SchemaResponseData;
  returnData?: SchemaResponseData;
  SheetName?: string;
  SheetCode?: string;
  DesignModeContent?: string | unknown;
  designContent?: string | unknown;
}

interface SchemaResponseData {
  SheetName?: string;
  SheetCode?: string;
  DesignModeContent?: string | unknown;
  sheetName?: string;
  sheetCode?: string;
  designContent?: string | unknown;
  parentCode?: string;
  functionNode?: {
    displayName?: string;
  };
}

type UnknownRecord = Record<string, unknown>;

const MAIN_SYSTEM_FIELDS: FieldInfo[] = [
  { key: 'ObjectId', displayName: '数据 Id', controlType: '系统字段', valueType: 'String', databaseDescription: '主表记录唯一标识' },
  { key: 'Status', displayName: '数据状态', controlType: '系统字段', valueType: 'Int', databaseDescription: '取值：0 草稿，1 生效/流程结束，2 流程进行中，3 作废' },
  { key: 'CreatedBy', displayName: '创建人', controlType: '系统字段', valueType: 'String', databaseDescription: '关联 H_User.ObjectId', mutableName: true },
  { key: 'CreatedTime', displayName: '创建时间', controlType: '系统字段', valueType: 'DateTime', databaseDescription: '记录创建时间', mutableName: true },
  { key: 'ModifiedTime', displayName: '修改时间', controlType: '系统字段', valueType: 'DateTime', databaseDescription: '记录最后修改时间', mutableName: true },
  { key: 'OwnerId', displayName: '拥有者', controlType: '系统字段', valueType: 'String', databaseDescription: '关联 H_User.ObjectId', mutableName: true },
  { key: 'OwnerDeptId', displayName: '所属部门', controlType: '系统字段', valueType: 'String', databaseDescription: '关联 H_OrganizationUnit.ObjectId', mutableName: true }
];

const CHILD_SYSTEM_FIELDS: FieldInfo[] = [
  { key: 'ObjectId', displayName: '数据 Id', controlType: '系统字段', valueType: 'String', databaseDescription: '子表记录唯一标识' },
  { key: 'ParentObjectId', displayName: '主表数据 Id', controlType: '系统字段', valueType: 'String', databaseDescription: '关联主表 ObjectId' }
];

const CONTROL_METADATA: Record<string, { controlType: string; valueType: string }> = {
  FormTextBox: { controlType: '单行文本', valueType: 'String' },
  FormTextArea: { controlType: '多行文本', valueType: 'String' },
  FormDateTime: { controlType: '日期', valueType: 'DateTime' },
  FormNumber: { controlType: '数字', valueType: 'Decimal' },
  FormRadioButtonList: { controlType: '单选框', valueType: 'String' },
  FormCheckboxList: { controlType: '复选框', valueType: 'String' },
  FormDropDownList: { controlType: '下拉框', valueType: 'String' },
  FormCheckbox: { controlType: '是否控件', valueType: 'Boolean' },
  FormAttachment: { controlType: '附件', valueType: '文件存储于 OSS' },
  FormPhoto: { controlType: '图片', valueType: '文件存储于 OSS' },
  FormAreaSelect: { controlType: '地址', valueType: 'JSON 字符串' },
  FormMap: { controlType: '位置', valueType: 'JSON 字符串' },
  FormUser: { controlType: '人员单选', valueType: 'String' },
  FormMultiUser: { controlType: '人员多选', valueType: 'String[]' },
  FormDepartment: { controlType: '部门单选', valueType: 'String（DepartmentId）' },
  FormMultiDepartment: { controlType: '部门多选', valueType: 'String[]' },
  FormSeqNo: { controlType: '流水号', valueType: 'String' },
  FormQuery: { controlType: '关联表单', valueType: 'String' },
  FormMultiQuery: { controlType: '关联表单多选', valueType: 'String[]' },
  FormHandSign: { controlType: '手写签名', valueType: '文件存储于 OSS' },
  FormButton: { controlType: '按钮', valueType: '无' },
  FormRollup: { controlType: '汇总计算', valueType: 'Decimal' },
  FormFormula: { controlType: '公式型', valueType: 'Decimal' }
};

function getRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null ? value as UnknownRecord : undefined;
}

function getString(record: UnknownRecord, key: string): string {
  return typeof record[key] === 'string' ? record[key] as string : '';
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function getCompactDisplayName(displayName: string, key: string): string {
  return displayName
    .replace(new RegExp(`（${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}）$`), '')
    .replace(new RegExp(`\\(${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)$`), '')
    .replace(/^子表内-/, '');
}

function findSystemField(fieldKey: string, systemFields: FieldInfo[]): FieldInfo | undefined {
  return systemFields.find((field) => field.key === fieldKey);
}

/**
 * 合并系统字段与设计内容中实际收集到的字段。
 * 系统字段排在最前,当用户拖入系统控件并改了名称时,以实际控件名称为准;
 * 无对应控件的系统字段(ObjectId、Status、ParentObjectId)始终用默认值。
 * 可改名的系统字段沿用设计内容中收集到的备注(含隐藏条件等),不可改名的系统字段使用默认描述。
 */
function mergeSystemFields(fields: FieldInfo[], systemFields: FieldInfo[]): FieldInfo[] {
  const actualByKey = new Map<string, FieldInfo>();
  fields.forEach((field) => actualByKey.set(field.key, field));

  const merged: FieldInfo[] = [];
  const seen = new Set<string>();
  systemFields.forEach((systemField) => {
    const actualField = systemField.mutableName ? actualByKey.get(systemField.key) : undefined;
    merged.push(actualField || systemField);
    seen.add(systemField.key);
  });
  fields.forEach((field) => {
    if (!seen.has(field.key)) {
      seen.add(field.key);
      merged.push(field);
    }
  });

  return merged;
}

/**
 * 解析接口中以 JSON 字符串形式返回的配置。
 */
function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

/**
 * 去掉字段编码前的当前表编码前缀，与 fields.md 中子表字段的展示方式保持一致。
 */
function stripTablePrefix(fieldKey: string, tableCode: string): string {
  const prefix = `${tableCode}.`;
  return fieldKey.startsWith(prefix) ? fieldKey.substring(prefix.length) : fieldKey;
}

/**
 * 格式化关联表单控件的填充规则（MappingFill）。
 * Map 的结构为 { 当前表单字段: 关联表单字段 }，输出时按“关联字段 → 当前字段”展示；
 * 同一控件的多条规则用分号分隔，带条件的规则在映射前标注条件。
 */
function formatMappingFill(options: UnknownRecord, tableCode: string): string {
  const parsed = parseJsonValue(options.MappingFill);
  if (!Array.isArray(parsed)) {
    return '';
  }

  const rules: string[] = [];
  parsed.forEach((item) => {
    const rule = getRecord(item);
    const map = rule ? getRecord(parseJsonValue(rule.Map)) : undefined;
    if (!map) {
      return;
    }

    const mappings: string[] = [];
    Object.entries(map).forEach(([target, source]) => {
      if (typeof source !== 'string' || source === '' || target === '') {
        return;
      }
      mappings.push(`${source}→${stripTablePrefix(target, tableCode)}`);
    });
    if (mappings.length === 0) {
      return;
    }

    const condition = rule ? getRecord(parseJsonValue(rule.Condition)) : undefined;
    const conditionText = condition
      ? (
        getString(condition, 'FormulaText') ||
        getString(condition, 'Formula') ||
        getString(condition, 'Expression') ||
        getString(condition, 'RuleText')
      )
      : '';
    rules.push(conditionText ? `[条件：${conditionText}] ${mappings.join('、')}` : mappings.join('、'));
  });

  return rules.join('；');
}

/**
 * 读取控件的隐藏条件（DisplayRule）。
 * RuleRecover 是设计器恢复出的可读规则，优先使用；没有时退回 Rule。
 * 空串表示未配置（默认显示）；TRUE 表示始终隐藏。
 */
function getDisplayRule(options: UnknownRecord): string {
  const raw = parseJsonValue(options.DisplayRule);
  const displayRule = Array.isArray(raw) ? undefined : getRecord(raw);
  if (!displayRule) {
    return '';
  }

  const rule = getString(displayRule, 'RuleRecover') || getString(displayRule, 'Rule');
  const normalized = rule.trim().replace(/^\$\.fn\./, '').trim();
  if (!normalized) {
    return '';
  }

  return `隐藏条件：${normalized}`;
}

/**
 * 读取控件的数据过滤条件（AssociationFilter）。
 * 关联表单控件和关联数据源的下拉框都会使用该配置。
 */
function getAssociationFilter(options: UnknownRecord): string {
  const raw = parseJsonValue(options.AssociationFilter);
  const associationFilter = Array.isArray(raw) ? undefined : getRecord(raw);
  if (!associationFilter) {
    return '';
  }

  const rule = getString(associationFilter, 'RuleRecover') || getString(associationFilter, 'Rule');
  const normalized = rule.trim().replace(/^\$\.fn\./, '').trim();
  return normalized ? `数据范围限定：${normalized}` : '';
}

/**
 * 依次拼接非空的备注片段。
 */
function appendDescription(description: string, ...suffixes: string[]): string {
  return [description, ...suffixes]
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .join('；');
}

/**
 * 生成控件计算规则的备注片段。
 * 公式型控件叫“公式”，其他控件的计算规则统一叫“计算规则”。
 */
function getComputationDescription(controlKey: string, options: UnknownRecord): string {
  const computationRule = getRecord(parseJsonValue(options.ComputationRule));
  const formula = computationRule ? getString(computationRule, 'Rule') : '';
  if (!formula) {
    return controlKey === 'FormFormula' ? '公式未配置' : '';
  }
  return controlKey === 'FormFormula' ? `公式：${formula}` : `计算规则：${formula}`;
}

function getDatabaseDescription(
  key: string,
  controlKey: string,
  options: UnknownRecord,
  tableCode: string
): string {
  let description = '';

  if (
    controlKey === 'FormRadioButtonList' ||
    controlKey === 'FormCheckboxList' ||
    controlKey === 'FormDropDownList'
  ) {
    const dataSource = getString(options, 'DataSource');
    if (dataSource.toLowerCase() === 'association') {
      const sourceSchemaCode = getString(options, 'BOSchemaCode');
      const sourceSchemaName = getString(options, 'BOSchemaName');
      const mappingField = getString(options, 'MappingField');
      if (sourceSchemaCode && mappingField) {
        const sourceName = sourceSchemaName ? `（${sourceSchemaName}）` : '';
        description = `选项来源：关联表单 ${sourceSchemaCode}${sourceName} 的 ${mappingField} 字段`;
      } else {
        description = '选项来源：关联表单配置不完整';
      }
    } else {
      const defaultItems = Array.isArray(options.DefaultItems) ? options.DefaultItems : [];
      const items = defaultItems.filter((item): item is string => typeof item === 'string');
      if (items.length > 0) {
        description = `选项：${items.join('、')}`;
        if (controlKey === 'FormCheckboxList') {
          description += '，多值以;分隔';
        }
      }
    }
  } else if (controlKey === 'FormRollup') {
    const rollupSettings = Array.isArray(options.RollupSettings) ? options.RollupSettings : [];
    if (rollupSettings.length === 0) {
      description = '汇总配置未设置';
    } else {
      const rollupSetting = getRecord(rollupSettings[0]);
      const propertyMapping = rollupSetting ? getRecord(rollupSetting.PropertyMapping) : undefined;
      const sourceSchemaCode = rollupSetting ? getString(rollupSetting, 'SourceSchemaCode') : '';
      const sourcePropertyName = propertyMapping ? getString(propertyMapping, 'SourcePropertyName') : '';
      description = sourceSchemaCode && sourcePropertyName
        ? `统计：${sourceSchemaCode}.${sourcePropertyName}`
        : '汇总配置不完整';
    }
  } else if (controlKey === 'FormAttachment' || controlKey === 'FormPhoto' || controlKey === 'FormHandSign') {
    description = '元数据表：H_BizObjectFile';
  } else if (controlKey === 'FormUser') {
    description = '关联 H_User.ObjectId';
  } else if (controlKey === 'FormMultiUser') {
    description = '关联 H_User.ObjectId，数据库存储字符串数组JSON';
  } else if (controlKey === 'FormDepartment') {
    description = '关联 H_OrganizationUnit.ObjectId';
  } else if (controlKey === 'FormMultiDepartment') {
    description = '关联 H_OrganizationUnit.ObjectId，数据库存储字符串数组JSON';
  } else if (controlKey === 'FormQuery') {
    const targetSchemaCode = getString(options, 'BOSchemaCode');
    const schemaName = getString(options, 'BOSchemaName');
    const target = targetSchemaCode
      ? `目标表单：${targetSchemaCode}${schemaName ? `（${schemaName}）` : ''}`
      : '关联目标未配置';
    const mappingFill = formatMappingFill(options, tableCode);
    description = mappingFill ? `${target}；填充：${mappingFill}` : target;
  } else if (controlKey === 'FormMultiQuery') {
    const targetSchemaCode = getString(options, 'BOSchemaCode');
    const targetSchema = targetSchemaCode || '未配置';
    const base = `目标表单：${targetSchema}，数据库中间表：i_${tableCode}_${key}`;
    const mappingFill = formatMappingFill(options, tableCode);
    description = mappingFill ? `${base}；填充：${mappingFill}` : base;
  }

  return appendDescription(description, getComputationDescription(controlKey, options));
}

function createField(record: UnknownRecord, schemaCode: string, childTableCode?: string): FieldInfo | undefined {
  const key = getString(record, 'Key');
  const options = getRecord(record.Options) || {};
  const displayName = getString(options, 'DisplayName');
  const controlKey = getString(options, 'ControlKey');
  if (
    !key ||
    !displayName ||
    controlKey === 'FormGridView' ||
    controlKey === 'FormLayout' ||
    controlKey === 'FormGroupTitle' ||
    controlKey === 'FormDescription' ||
    controlKey === 'FormTab'
  ) {
    return undefined;
  }

  const fieldKey = childTableCode && key.startsWith(`${childTableCode}.`)
    ? key.substring(childTableCode.length + 1)
    : key;
  const displayRule = getDisplayRule(options);
  const associationFilter = getAssociationFilter(options);

  // 系统字段以 key 识别。类型、备注使用系统字段默认值;
  // 只有可拖入设计器并允许改名的系统控件才用设计内容里的名称,其余保持默认名称。
  const systemField = findSystemField(fieldKey, childTableCode ? CHILD_SYSTEM_FIELDS : MAIN_SYSTEM_FIELDS);
  if (systemField) {
    return {
      key: fieldKey,
      displayName: systemField.mutableName
        ? getCompactDisplayName(displayName, fieldKey)
        : systemField.displayName,
      controlType: systemField.controlType,
      valueType: systemField.valueType,
      databaseDescription: appendDescription(systemField.databaseDescription, associationFilter, displayRule)
    };
  }

  if (!controlKey) {
    return undefined;
  }

  const metadata = CONTROL_METADATA[controlKey] || {
    controlType: controlKey,
    valueType: '未识别，请以氚云控件配置为准'
  };

  return {
    key: fieldKey,
    displayName: getCompactDisplayName(displayName, fieldKey),
    controlType: metadata.controlType,
    valueType: metadata.valueType,
    databaseDescription: appendDescription(
      getDatabaseDescription(fieldKey, controlKey, options, childTableCode || schemaCode),
      associationFilter,
      displayRule
    )
  };
}

function collectControls(
  data: unknown,
  mainFields: FieldInfo[],
  childTables: ChildTableInfo[],
  schemaCode: string,
  childTable?: ChildTableInfo
): void {
  if (Array.isArray(data)) {
    data.forEach((item) => collectControls(item, mainFields, childTables, schemaCode, childTable));
    return;
  }

  const record = getRecord(data);
  if (!record) {
    return;
  }

  const options = getRecord(record.Options) || {};
  const controlKey = getString(options, 'ControlKey');
  const childControls = record.ChildControls;
  if (controlKey === 'FormGridView') {
    const childTable: ChildTableInfo = {
      key: getString(record, 'Key'),
      displayName: getCompactDisplayName(getString(options, 'DisplayName'), getString(record, 'Key')),
      fields: []
    };
    if (childTable.key && childTable.displayName) {
      childTables.push(childTable);
      collectControls(childControls, mainFields, childTables, schemaCode, childTable);
    }
    return;
  }

  const field = createField(record, schemaCode, childTable?.key);
  if (field) {
    (childTable ? childTable.fields : mainFields).push(field);
  }
  collectControls(childControls, mainFields, childTables, schemaCode, childTable);
}

function extractSchemaInfo(
  jsonData: SheetDesignerLoadFormResponse,
  fallbackSchemaCode?: string,
  fallbackName?: string
): SchemaInfo {
  const source = (jsonData.ReturnData || jsonData.returnData || jsonData) as SchemaResponseData;
  const schemaName = source.SheetName || source.sheetName || fallbackName || source.functionNode?.displayName || '';
  const schemaCode = source.SheetCode || source.sheetCode || fallbackSchemaCode || '';
  const designContent = source.DesignModeContent || source.designContent || jsonData.DesignModeContent || jsonData.designContent;
  if (!schemaName || !schemaCode) {
    throw new Error('表单设计响应中未找到表单名称或表单编码');
  }
  if (!designContent) {
    throw new Error('表单设计响应中未找到设计内容');
  }

  try {
    const controlsData = typeof designContent === 'string' ? JSON.parse(designContent) : designContent;
    if (!controlsData) {
      throw new Error('表单设计内容为空');
    }

    return {
      schemaName,
      schemaCode,
      controlsData
    };
  } catch (error) {
    throw new Error(`表单设计内容解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

function formatFieldTable(fields: FieldInfo[]): string {
  const header = '| 编码 | 名称 | 类型/值 | 备注 |\n| --- | --- | --- | --- |\n';
  return header + fields.map((field) => (
    `| ${escapeMarkdown(field.key)} | ${escapeMarkdown(field.displayName)} | ${escapeMarkdown(field.controlType)}/${escapeMarkdown(field.valueType)} | ${escapeMarkdown(field.databaseDescription)} |`
  )).join('\n') + '\n';
}

/**
 * 判断 LoadForm 响应是否包含有效表单结构。
 */
export function hasFormSchema(jsonData: SheetDesignerLoadFormResponse): boolean {
  if (jsonData.Successful === false || jsonData.successful === false) {
    return false;
  }

  try {
    const source = (jsonData.ReturnData || jsonData.returnData || jsonData) as SchemaResponseData;
    const schemaName = source.SheetName || source.sheetName || source.functionNode?.displayName || '';
    const designContent = source.DesignModeContent || source.designContent || jsonData.DesignModeContent || jsonData.designContent;
    return Boolean(schemaName && designContent);
  } catch {
    return false;
  }
}

/**
 * 解析表单设计响应，生成包含控件和值类型的 Markdown 字段表。
 */
export function parseSchemaJSON(
  jsonData: SheetDesignerLoadFormResponse,
  formCode?: string,
  formName?: string
): string {
  const { schemaName, schemaCode, controlsData } = extractSchemaInfo(jsonData, formCode, formName);
  const mainFields: FieldInfo[] = [];
  const childTables: ChildTableInfo[] = [];
  collectControls(controlsData, mainFields, childTables, schemaCode);

  const uniqueMainFields = mergeSystemFields(mainFields, MAIN_SYSTEM_FIELDS);

  let output = `# ${schemaName}\n\n`;
  output += `表单编码：${schemaCode}\n`;
  output += `数据库表名：i_${schemaCode}\n\n`;
  output += '## 主表\n\n';
  output += formatFieldTable(uniqueMainFields);

  childTables.forEach((childTable) => {
    output += `\n## ${childTable.displayName}\n\n`;
    output += `子表编码：${childTable.key}\n`;
    output += `数据库表名：i_${childTable.key}\n\n`;
    output += formatFieldTable(mergeSystemFields(childTable.fields, CHILD_SYSTEM_FIELDS));
  });

  return output;
}
