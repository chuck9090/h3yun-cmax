interface FieldInfo {
  key: string;
  displayName: string;
  controlType: string;
  valueType: string;
  databaseDescription: string;
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

const SYSTEM_FIELDS: FieldInfo[] = [
  { key: 'ObjectId', displayName: '数据 Id', controlType: '系统字段', valueType: 'String', databaseDescription: '主表记录唯一标识' },
  { key: 'CreatedBy', displayName: '创建人', controlType: '系统字段', valueType: 'String', databaseDescription: '关联 H_User.ObjectId' },
  { key: 'CreatedTime', displayName: '创建时间', controlType: '系统字段', valueType: 'DateTime', databaseDescription: '记录创建时间' },
  { key: 'ModifiedTime', displayName: '修改时间', controlType: '系统字段', valueType: 'DateTime', databaseDescription: '记录最后修改时间' },
  { key: 'OwnerId', displayName: '拥有者', controlType: '系统字段', valueType: 'String', databaseDescription: '关联 H_User.ObjectId' },
  { key: 'OwnerDeptId', displayName: '所属部门', controlType: '系统字段', valueType: 'String', databaseDescription: '关联 H_OrganizationUnit.ObjectId' }
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
    !controlKey ||
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
      fields: [
        { key: 'ObjectId', displayName: '数据 Id', controlType: '系统字段', valueType: 'String', databaseDescription: '子表记录唯一标识' },
        { key: 'ParentObjectId', displayName: '主表数据 Id', controlType: '系统字段', valueType: 'String', databaseDescription: '关联主表 ObjectId' }
      ]
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
  const mainFields = [...SYSTEM_FIELDS];
  const childTables: ChildTableInfo[] = [];
  collectControls(controlsData, mainFields, childTables, schemaCode);

  const existingFieldKeys = new Set<string>();
  const uniqueMainFields = mainFields.filter((field) => {
    if (existingFieldKeys.has(field.key)) {
      return false;
    }
    existingFieldKeys.add(field.key);
    return true;
  });

  let output = `# ${schemaName}\n\n`;
  output += `表单编码：${schemaCode}\n`;
  output += `数据库表名：i_${schemaCode}\n\n`;
  output += '## 主表\n\n';
  output += formatFieldTable(uniqueMainFields);

  childTables.forEach((childTable) => {
    output += `\n## ${childTable.displayName}\n\n`;
    output += `子表编码：${childTable.key}\n`;
    output += `数据库表名：i_${childTable.key}\n\n`;
    output += formatFieldTable(childTable.fields);
  });

  return output;
}
