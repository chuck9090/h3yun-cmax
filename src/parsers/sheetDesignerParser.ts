interface ExtractedField {
  key: string;
  displayName: string;
  isChild: boolean;
}

interface SchemaInfo {
  schemaName: string;
  schemaCode: string;
  controlsData: unknown;
}

export interface SheetDesignerLoadFormResponse {
  Successful?: boolean;
  ErrorMessage?: string | null;
  ReturnData?: {
    SheetName?: string;
    SheetCode?: string;
    DesignModeContent?: string | unknown;
  };
  SheetName?: string;
  SheetCode?: string;
  DesignModeContent?: string | unknown;
}

type UnknownRecord = Record<string, unknown>;

function recursiveExtract(
  data: unknown,
  resultList: ExtractedField[],
  prefix: string = '',
  currentSchemaName: string = ''
): void {
  if (Array.isArray(data)) {
    data.forEach((item) => {
      recursiveExtract(item, resultList, prefix, currentSchemaName);
    });
    return;
  }

  if (typeof data !== 'object' || data === null) {
    return;
  }

  const record = data as UnknownRecord;
  const key = typeof record.Key === 'string' ? record.Key : '';
  const options = typeof record.Options === 'object' && record.Options !== null
    ? record.Options as UnknownRecord
    : {};
  const displayName = typeof options.DisplayName === 'string' ? options.DisplayName : '';
  const controlKey = typeof options.ControlKey === 'string' ? options.ControlKey : '';
  const childControls = record.ChildControls;

  if (controlKey === 'FormGridView' && displayName) {
    const newPrefix = `${displayName}.`;
    resultList.push({
      key: '- ' + key,
      displayName: `子表 [${displayName}] 字段列表：`,
      isChild: false
    });
    resultList.push({
      key: 'ObjectId',
      displayName: `子表 [${displayName}] 数据 Id, 唯一标识`,
      isChild: true
    });
    resultList.push({
      key: 'ParentObjectId',
      displayName: `主表 [${currentSchemaName}] 数据 Id, 跟主表 ObjectId 关联`,
      isChild: true
    });

    if (childControls) {
      recursiveExtract(childControls, resultList, newPrefix, currentSchemaName);
    }
    return;
  }

  if (key && displayName) {
    const fullDisplayName = prefix ? prefix + displayName : displayName;
    const isChild = !!prefix;
    let cleanKey = key;

    if (isChild && key.includes('.')) {
      const index = key.indexOf('.');
      cleanKey = key.substring(index + 1);
    }

    resultList.push({ key: cleanKey, displayName: fullDisplayName, isChild });
  }

  if (childControls) {
    recursiveExtract(childControls, resultList, prefix, currentSchemaName);
  }
}

function extractSchemaInfo(jsonData: SheetDesignerLoadFormResponse): SchemaInfo {
  let schemaName = '';
  let schemaCode = '';
  let designModeContent: string | unknown = null;

  if (jsonData.ReturnData) {
    schemaName = jsonData.ReturnData.SheetName || '';
    schemaCode = jsonData.ReturnData.SheetCode || '';
    designModeContent = jsonData.ReturnData.DesignModeContent;
  } else {
    schemaName = jsonData.SheetName || '';
    schemaCode = jsonData.SheetCode || '';
    designModeContent = jsonData.DesignModeContent;
  }

  if (!schemaName) {
    throw new Error('JSON 中未找到表单名称(SheetName)');
  }

  if (!schemaCode) {
    throw new Error('JSON 中未找到表单编码(SheetCode)');
  }

  let controlsData: unknown;
  try {
    controlsData = typeof designModeContent === 'string'
      ? JSON.parse(designModeContent)
      : designModeContent;
  } catch (error) {
    throw new Error(`DesignModeContent 解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }

  if (!controlsData) {
    throw new Error('JSON 中未找到 DesignModeContent 字段');
  }

  return {
    schemaName,
    schemaCode,
    controlsData
  };
}

/**
 * 判断 LoadForm 响应是否包含有效表单结构
 */
export function hasFormSchema(jsonData: SheetDesignerLoadFormResponse): boolean {
  if (jsonData.Successful === false) {
    return false;
  }

  const source = jsonData.ReturnData || jsonData;
  return Boolean(source.SheetName && source.SheetCode && source.DesignModeContent);
}

/**
 * 解析 LoadForm 响应并生成字段表文本
 */
export function parseSchemaJSON(jsonData: SheetDesignerLoadFormResponse): string {
  const { schemaName, schemaCode, controlsData } = extractSchemaInfo(jsonData);
  const extractedData: ExtractedField[] = [
    { key: 'ObjectId', displayName: '数据 Id, 唯一标识', isChild: false }
  ];

  recursiveExtract(controlsData, extractedData, '', schemaName);

  if (extractedData.length === 0) {
    throw new Error('未找到任何 Key 和 DisplayName 字段');
  }

  let output = `- 表单名称：${schemaName}\n`;
  output += `- 表单编码：${schemaCode}\n`;
  output += `- 数据库表名：i_${schemaCode}\n\n`;
  output += `- ${schemaName} 字段列表：\n`;

  extractedData.forEach((item) => {
    if (item.key.includes('-') && !item.key.startsWith('- ')) {
      return;
    }

    const indent = item.isChild ? '     ' : '';
    output += `   ${indent}${item.key} ${item.displayName}\n`;
  });

  return output;
}
