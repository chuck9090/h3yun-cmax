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
 * 类型、备注列始终使用系统字段默认值,其余字段保持原顺序。
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

function getDatabaseDescription(
  key: string,
  controlKey: string,
  options: UnknownRecord,
  schemaCode: string
): string {
  if (
    controlKey === 'FormRadioButtonList' ||
    controlKey === 'FormCheckboxList' ||
    controlKey === 'FormDropDownList'
  ) {
    const defaultItems = Array.isArray(options.DefaultItems) ? options.DefaultItems : [];
    const items = defaultItems.filter((item): item is string => typeof item === 'string');
    if (items.length === 0) {
      return '';
    }

    const itemDescription = `选项：${items.join('、')}`;
    return controlKey === 'FormCheckboxList' ? `${itemDescription}，多值以;分隔` : itemDescription;
  }

  if (controlKey === 'FormFormula') {
    const computationRule = getRecord(options.ComputationRule);
    const formula = computationRule ? getString(computationRule, 'Rule') : '';
    return formula ? `公式：${formula}` : '公式未配置';
  }

  if (controlKey === 'FormRollup') {
    const rollupSettings = Array.isArray(options.RollupSettings) ? options.RollupSettings : [];
    if (rollupSettings.length === 0) {
      return '汇总配置未设置';
    }

    const rollupSetting = getRecord(rollupSettings[0]);
    const propertyMapping = rollupSetting ? getRecord(rollupSetting.PropertyMapping) : undefined;
    const sourceSchemaCode = rollupSetting ? getString(rollupSetting, 'SourceSchemaCode') : '';
    const sourcePropertyName = propertyMapping ? getString(propertyMapping, 'SourcePropertyName') : '';
    if (sourceSchemaCode && sourcePropertyName) {
      return `统计：${sourceSchemaCode}.${sourcePropertyName}`;
    }

    return '汇总配置不完整';
  }

  if (controlKey === 'FormAttachment' || controlKey === 'FormPhoto' || controlKey === 'FormHandSign') {
    return '元数据表：H_BizObjectFile';
  }

  if (controlKey === 'FormUser') {
    return '关联 H_User.ObjectId';
  }

  if (controlKey === 'FormMultiUser') {
    return '关联 H_User.ObjectId，数据库存储字符串数组JSON';
  }

  if (controlKey === 'FormDepartment') {
    return '关联 H_OrganizationUnit.ObjectId';
  }

  if (controlKey === 'FormMultiDepartment') {
    return '关联 H_OrganizationUnit.ObjectId，数据库存储字符串数组JSON';
  }

  if (controlKey === 'FormQuery') {
    const schemaCode = getString(options, 'BOSchemaCode');
    const schemaName = getString(options, 'BOSchemaName');
    return schemaCode ? `目标表单：${schemaCode}${schemaName ? `（${schemaName}）` : ''}` : '关联目标未配置';
  }

  if (controlKey === 'FormMultiQuery') {
    const targetSchemaCode = getString(options, 'BOSchemaCode');
    const targetSchema = targetSchemaCode || '未配置';
    return `目标表单：${targetSchema}，数据库中间表：i_${schemaCode}_${key}`;
  }

  return '';
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
      databaseDescription: systemField.databaseDescription
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
    databaseDescription: getDatabaseDescription(fieldKey, controlKey, options, childTableCode || schemaCode)
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

function extractSchemaInfo(jsonData: SheetDesignerLoadFormResponse, fallbackSchemaCode?: string): SchemaInfo {
  const source = (jsonData.ReturnData || jsonData.returnData || jsonData) as SchemaResponseData;
  const schemaName = source.SheetName || source.sheetName || source.functionNode?.displayName || '';
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
export function parseSchemaJSON(jsonData: SheetDesignerLoadFormResponse, formCode?: string): string {
  const { schemaName, schemaCode, controlsData } = extractSchemaInfo(jsonData, formCode);
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
