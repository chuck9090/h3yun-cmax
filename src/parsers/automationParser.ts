import {
  Automation,
  AutomationAction,
  AutomationCondition,
  AutomationFieldMapping,
  FormAutomations
} from '../types';
import { FieldLabelIndex } from '../services/fieldLabelService';

/**
 * 自动化列表接口响应结构。
 * 接口按表单分组返回,每组包含该表单下的全部自动化。
 */
export interface AutomaticTriggersResponse {
  Successful?: boolean;
  successful?: boolean;
  ErrorMessage?: string;
  errorMessage?: string;
  ReturnData?: {
    Triggers?: Array<{
      SchemaCode?: string;
      SchemaDisplayName?: string;
      TriggerModels?: unknown[];
    }>;
  };
}

/**
 * 触发类型原始值到名称、说明的映射。
 * 数值与氚云自动化设计器中的触发事件一致。
 */
const TRIGGER_TYPES: Record<number, { label: string; description: string }> = {
  10: { label: '数据发生变化时', description: '数据新增、更新或删除时触发' },
  60: { label: '日期字段触发', description: '按指定日期字段的取值触发' },
  100: { label: '定时触发', description: '指定时间触发,支持按周期重复' },
  111: { label: '数据生效时', description: '流程审批通过,或无流程的表单数据提交时' },
  112: { label: '数据更新时', description: '生效数据被更新' },
  113: { label: '数据失效时', description: '生效数据被删除,或激活流程' },
  114: { label: '数据生效或更新时', description: '数据生效或更新时均会触发' },
  401: { label: '自定义触发', description: '通过自定义按钮或代码调用触发' }
};

/**
 * 执行动作编码到动作名称的映射。
 */
const ACTION_TYPES: Record<string, string> = {
  notice: '新建提醒事项',
  querydata: '查找数据',
  updatedata: '更新数据',
  insertdata: '新增数据',
  removedata: '删除数据',
  ApiConnection: '第三方连接',
  sms: '发送短信',
  email: '发送邮件',
  payment: '在线支付',
  dingtalkattendance: '钉钉考勤',
  dingtalkrobot: '钉钉机器人',
  robotnotification: '钉钉群消息',
  notification: '发送消息通知',
  dingtalkconnect: '钉钉连接器',
  specifiedDate: '按指定日期'
};

/**
 * 条件操作符到中文说明的映射。
 */
const OPERATORS: Record<string, string> = {
  Equal: '等于',
  NotEqual: '不等于',
  Above: '大于',
  AboveOrEqual: '大于等于',
  Below: '小于',
  BelowOrEqual: '小于等于',
  In: '属于',
  NotIn: '不属于',
  IsBlank: '为空',
  NotBlank: '不为空',
  Contains: '包含',
  NotContains: '不包含'
};

/**
 * 字段赋值取值方式的映射。
 * 接口用 SourceType 区分：1 字段引用、2 公式计算、3 固定值。
 */
const SOURCE_TYPES: Record<number, string> = {
  1: '字段',
  2: '公式计算',
  3: '固定值'
};

/**
 * 新增数据时的数据状态，对应设计器中“新增数据方式”的三个选项。
 * 该值由用户在动作配置的齿轮菜单中显式选择，属于真实配置，需要输出。
 */
const INSERT_STATE_LABELS: Record<number, string> = {
  0: '暂存草稿',
  1: '新增生效数据',
  2: '发起流程'
};

/**
 * 定时触发的频率。
 */
const SCHEDULE_FREQUENCIES: Record<number, string> = {
  0: '仅触发一次',
  1: '每天',
  2: '每周',
  3: '每月',
  4: '每年',
  5: '自定义'
};

/**
 * 每周重复时的星期取值。
 */
const WEEKDAY_LABELS: Record<string, string> = {
  '1': '周一',
  '2': '周二',
  '3': '周三',
  '4': '周四',
  '5': '周五',
  '6': '周六',
  '7': '周日'
};

/**
 * 查找结果排序方向。
 */
const SORT_DIRECTIONS: Record<number, string> = {
  0: '升序',
  1: '降序'
};

/**
 * 读取对象字段,兼容不同大小写的返回键名。
 */
function getField(source: Record<string, unknown> | null | undefined, name: string): unknown {
  if (!source) {
    return undefined;
  }
  if (name in source) {
    return source[name];
  }
  const lowerName = name.toLowerCase();
  const matchedKey = Object.keys(source).find((key) => key.toLowerCase() === lowerName);
  return matchedKey ? source[matchedKey] : undefined;
}

function getString(source: Record<string, unknown> | null | undefined, name: string): string {
  const value = getField(source, name);
  return value === undefined || value === null ? '' : String(value);
}

function getArray(source: Record<string, unknown> | null | undefined, name: string): unknown[] {
  const value = getField(source, name);
  return Array.isArray(value) ? value : [];
}

function getRecord(source: unknown): Record<string, unknown> | null {
  return source && typeof source === 'object' && !Array.isArray(source)
    ? source as Record<string, unknown>
    : null;
}

/**
 * 把接口返回的数值字段统一转成 number。
 * 接口有时会用字符串表示数字（如 "2"），直接 `typeof === 'number'` 判断会
 * 让枚举全部走兜底分支，进而把公式/固定值误标成“字段”，需要统一转换。
 * @param source 数据对象
 * @param name 字段名
 * @returns 数字,无法转换时返回 undefined
 */
function getNumber(source: Record<string, unknown> | null | undefined, name: string): number | undefined {
  const value = getField(source, name);
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/**
 * 把接口返回的布尔字段统一转成 boolean。
 * 同样兼容 `1/0`、`"true"/"false"` 等表示法，避免启用状态被误判。
 * @param source 数据对象
 * @param name 字段名
 * @returns 布尔值,无法判断时返回 undefined
 */
function getBoolean(source: Record<string, unknown> | null | undefined, name: string): boolean | undefined {
  const value = getField(source, name);
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 1 || value === '1' || value === 'true') {
    return true;
  }
  if (value === 0 || value === '0' || value === 'false') {
    return false;
  }
  return undefined;
}

/**
 * 把字段引用解析为可读文本。
 * 引用可能逐级包含表单、子表,形式如：
 * - D001@1.F0000001                 表单字段
 * - D001@1.D002@1.F0000002          表单 → 子表字段
 * - D002.F0000003                   子表字段
 * 只取最后两段（所属编码、字段编码）,仅当能查到字段名称时才翻译,其它一律原样返回。
 * @param reference 原始引用
 * @param fieldLabelMap 表单或子表编码到字段编码、名称的映射
 */
function resolveReference(
  reference: string,
  fieldLabelMap: FieldLabelIndex
): string {
  if (!reference) {
    return '';
  }

  const parts = reference.split('.');
  if (parts.length < 2) {
    return reference;
  }

  const fieldCode = parts[parts.length - 1];
  const owner = parts[parts.length - 2].split('@')[0];
  const fieldLabel = fieldLabelMap.labels.get(owner)?.get(fieldCode);

  return fieldLabel ? `${fieldLabel}（${fieldCode}）` : reference;
}

/**
 * 解析字段编码到显示名称。
 * @param fieldCode 字段编码,可能是 `F0000001` 或 `子表编码.F0000001`
 * @param fieldLabelMap 字段名称索引
 * @param defaultSchemaCode 未带前缀时使用的表单或子表编码
 */
function resolveFieldLabel(
  fieldCode: string,
  fieldLabelMap: FieldLabelIndex,
  defaultSchemaCode: string
): string {
  if (!fieldCode) {
    return '';
  }

  const parts = fieldCode.split('.');
  if (parts.length > 1) {
    const field = parts[parts.length - 1];
    const owner = parts[parts.length - 2].split('@')[0];
    const label = fieldLabelMap.labels.get(owner)?.get(field);
    if (label) {
      return label;
    }
    // 查不到时至少显示字段编码本身,不显示冗长的子表编码前缀
    return field;
  }

  const direct = fieldLabelMap.labels.get(defaultSchemaCode)?.get(fieldCode);
  if (direct) {
    return direct;
  }

  // 字段编码不带前缀时,可能属于该表单的某个子表,逐个尝试
  for (const childCode of fieldLabelMap.childrenOf.get(defaultSchemaCode) || []) {
    const label = fieldLabelMap.labels.get(childCode)?.get(fieldCode);
    if (label) {
      return label;
    }
  }

  return fieldCode;
}

/**
 * 解析单个条件节点。
 */
function parseCondition(
  node: Record<string, unknown>,
  fieldLabelMap: FieldLabelIndex,
  schemaCode: string
): AutomationCondition {
  const propertyName = getString(node, 'PropertyName');
  const operator = getString(node, 'Operator');
  const rawValue = getString(node, 'Value');
  const valueType = getString(node, 'ValueType');

  const propertyLabel = resolveFieldLabel(propertyName, fieldLabelMap, schemaCode);
  const isValueLess = operator === 'IsBlank' || operator === 'NotBlank';

  return {
    propertyName,
    propertyLabel,
    operator,
    operatorLabel: OPERATORS[operator] || operator,
    value: isValueLess
      ? ''
      : (valueType === 'Fixed' ? rawValue : resolveReference(rawValue, fieldLabelMap))
  };
}

/**
 * 解析动作中的字段赋值。
 */
function parseFieldMappings(
  mappings: unknown[],
  targetSchemaCode: string,
  fieldLabelMap: FieldLabelIndex
): AutomationFieldMapping[] {
  const result: AutomationFieldMapping[] = [];

  for (const item of mappings) {
    const mapping = getRecord(item);
    if (!mapping) continue;

    const targetField = getString(mapping, 'TargetField');
    if (!targetField) continue;

    // 目标字段可能带子表编码前缀,展示时只保留字段编码本身
    const targetFieldCode = targetField.split('.').pop() || targetField;

    const sourceTypeCode = getNumber(mapping, 'SourceType');
    const sourceType = sourceTypeCode !== undefined
      ? (SOURCE_TYPES[sourceTypeCode] || `原始值 ${sourceTypeCode}`)
      : '未设置';

    const sourceField = getString(mapping, 'SourceField');

    // 字段引用翻译成“名称（编码）”;公式里的字段占位符同样替换成名称;固定值原样保留
    let source = '';
    if (sourceField) {
      if (sourceTypeCode === 2) {
        source = resolvePlaceholders(sourceField, fieldLabelMap);
      } else if (sourceTypeCode === 1) {
        source = resolveReference(sourceField, fieldLabelMap);
      } else {
        source = sourceField;
      }
    }

    result.push({
      targetField: targetFieldCode,
      targetLabel: resolveFieldLabel(targetField, fieldLabelMap, targetSchemaCode),
      source: source || '未设置',
      sourceType
    });
  }

  return result;
}

/**
 * 把文案中的字段占位符替换为字段名称。
 * 占位符形如 `{表单编码@1.字段编码}`，常见于消息通知的标题和内容。
 * 查不到名称时保留原占位符，避免丢失信息。
 */
function resolvePlaceholders(
  text: string,
  fieldLabelMap: FieldLabelIndex
): string {
  if (!text || !text.includes('{')) {
    return text;
  }

  return text.replace(/\{([^{}]+)\}/g, (matched, inner: string) => {
    const parts = inner.split('.');
    if (parts.length < 2) {
      return matched;
    }

    const fieldCode = parts[parts.length - 1];
    const owner = parts[parts.length - 2].split('@')[0];
    const label = fieldLabelMap.labels.get(owner)?.get(fieldCode);

    return label || matched;
  });
}

/**
 * 从链接配置中取出可读值。
 * 链接结构为 { Type, Value, Name }，Value 为空表示未设置。
 */
function resolveLink(link: unknown): string {
  const record = getRecord(link);
  if (!record) {
    return '';
  }

  const value = getString(record, 'Value');
  if (value) {
    return value;
  }

  const name = getString(record, 'Name');
  // Name 只是占位符名称（如 MessageUrl），没有实际内容时不必展示
  return name && !/^[A-Za-z]+$/.test(name) ? name : '';
}

/**
 * 生成定时触发的周期说明。
 * 结构为 { Frequency, Repeat[], Time, CustomFrequency, CustomFrequencyUnit, TriggerEndTime, SkipHolidays }。
 * 输出与设计器一致,例如“每月 最后一天 23:35”。
 * @param schedule Condition.Schedule
 */
function buildScheduleText(schedule: Record<string, unknown> | null): string {
  const value = getRecord(getField(schedule, 'Value'));
  if (!value) {
    return '';
  }

    const freqCode = getNumber(value, 'Frequency');
  const parts: string[] = [];

  if (freqCode !== undefined) {
    parts.push(SCHEDULE_FREQUENCIES[freqCode] || `原始值 ${freqCode}`);
  }

  // 每周按星期、每月按日期、每年按“月-日”展开重复项
  const repeat = getArray(value, 'Repeat').map((item) => String(item));
  if (repeat.length > 0) {
    if (freqCode === 2) {
      parts.push(repeat.map((item) => WEEKDAY_LABELS[item] || item).join('、'));
    } else if (freqCode === 3) {
      parts.push(repeat.map((item) => (item === '-1' ? '最后一天' : `${item} 日`)).join('、'));
    } else {
      parts.push(repeat.join('、'));
    }
  }

  const time = getString(value, 'Time');
  if (time) {
    parts.push(time);
  }

  let text = parts.join(' ');
  if (getBoolean(value, 'SkipHolidays') === true) {
    text += '（跳过法定节假日）';
  }

  const endTime = getString(value, 'TriggerEndTime');
  if (endTime) {
    text += `，结束时间 ${endTime}`;
  }

  return text;
}

/**
 * 解析“数据更新时”限定变更字段的列表。
 * Condition.UpdatedFiled.Value 可能是字段编码、子表编码,或“子表编码.字段编码”。
 */
function parseUpdatedFields(
  condition: Record<string, unknown> | null,
  fieldLabelMap: FieldLabelIndex,
  schemaCode: string
): string[] {
  const result: string[] = [];

  for (const item of getArray(getRecord(getField(condition, 'UpdatedFiled')), 'Value')) {
    const code = String(item);
    if (!code) continue;

    const label = resolveFieldLabel(code, fieldLabelMap, schemaCode);
    // 查不到字段名且本身就是子表编码时,标注为“子表「名称」全部字段”,避免只显示一串编码
    const isChildSchema = fieldLabelMap.labels.has(code);
    if (label === code && isChildSchema) {
      const childName = fieldLabelMap.childNames.get(code);
      result.push(childName ? `子表「${childName}」全部字段（${code}）` : `子表全部字段（${code}）`);
    } else {
      result.push(label);
    }
  }

  return result;
}

/**
 * 构造动作的附加说明项。
 * 只输出页面上真实可见、由用户配置的内容。
 *
 * 关于 RequestMapping.State：它是“新增数据方式”，由用户在动作的齿轮菜单里选择
 * （新增生效数据 / 发起流程 / 暂存草稿），属于真实配置；但它只对“新增”这一分支有意义，
 * 所以只在新增数据动作、或更新动作开启了“无可更新数据时新增”时才输出。
 *
 * 关于 Action.DataSetType：完全由触发类型推导（113 数据失效时为变更前数据，其余为最新数据），
 * 页面上没有对应配置项，因此不输出，避免把推导值当成用户配置。
 */
function buildActionDetails(
  requestMapping: Record<string, unknown> | null,
  pluginCode: string,
  fieldLabelMap: FieldLabelIndex
): Array<[string, string]> {
  const details: Array<[string, string]> = [];
  if (!requestMapping) {
    return details;
  }

  const pushIfPresent = (label: string, value: string): void => {
    if (value && value.trim().length > 0) {
      details.push([label, value]);
    }
  };

  // 消息类动作
  pushIfPresent('接收人', resolvePlaceholders(getString(requestMapping, 'Receivers'), fieldLabelMap));
  pushIfPresent('消息类型', getString(requestMapping, 'MessageType'));
  pushIfPresent('标题', resolvePlaceholders(getString(requestMapping, 'Title'), fieldLabelMap));
  pushIfPresent('内容', resolvePlaceholders(getString(requestMapping, 'Content'), fieldLabelMap));
  pushIfPresent('链接', resolveLink(getField(requestMapping, 'Link')));
  pushIfPresent('机器人类型', getString(requestMapping, 'RobotType'));
  pushIfPresent('消息格式', getString(requestMapping, 'MsgType'));
  pushIfPresent('手机号', resolvePlaceholders(getString(requestMapping, 'Mobiles'), fieldLabelMap));

  if (pluginCode === 'robotnotification') {
    pushIfPresent('Webhook', getString(requestMapping, 'Webhook'));
    pushIfPresent('加签密钥', getString(requestMapping, 'EncryKey'));
  }

  // “无可更新数据时新增”与“新增数据方式”对应页面上同一处齿轮配置
  const stateValue = getNumber(requestMapping, 'State');
  const canInsert = pluginCode === 'updatedata' && getBoolean(requestMapping, 'IsInsert') === true;

  if (canInsert) {
    details.push(['无可更新数据时', '新增一条数据']);
    if (stateValue !== undefined) {
      details.push(['新增数据方式', INSERT_STATE_LABELS[stateValue] || `原始值 ${stateValue}`]);
    }
  } else if (pluginCode === 'insertdata' && stateValue !== undefined) {
    // 新增数据动作自身的数据状态
    details.push(['新增数据方式', INSERT_STATE_LABELS[stateValue] || `原始值 ${stateValue}`]);
  }

  if (pluginCode === 'querydata') {
    const limit = getNumber(requestMapping, 'Limit');
    if (limit !== undefined && limit > 0) {
      // 与页面一致：“查找数量上限为 10000 条，超出上限时取前 10000 条数据并继续执行”
      const overLimitText = getBoolean(requestMapping, 'IgnoreOverLimit') === true
        ? `，超出上限时取前 ${limit} 条数据并继续执行`
        : '，超出上限时停止执行';
      details.push(['查找数据量', `上限为 ${limit} 条${overLimitText}`]);
    }

    const sortBys = getArray(requestMapping, 'SortBys');
    if (sortBys.length > 0) {
      const sortText = sortBys
        .map((item) => {
          const record = getRecord(item);
          if (!record) return '';
          const itemName = getString(record, 'ItemName');
          const directionCode = getNumber(record, 'Direction');
          const direction = directionCode !== undefined
            ? (SORT_DIRECTIONS[directionCode] || `原始值 ${directionCode}`)
            : '';

          // 页面上排序字段显示为“表单名.字段名”,这里保持一致
          const parts = itemName.split('.');
          const ownerCode = parts.length > 1 ? parts[parts.length - 2].split('@')[0] : '';
          const ownerName = ownerCode
            ? (fieldLabelMap.formNames.get(ownerCode) || fieldLabelMap.childNames.get(ownerCode))
            : '';
          const fieldLabel = resolveFieldLabel(itemName, fieldLabelMap, '');

          return [`${ownerName ? `${ownerName}.` : ''}${fieldLabel}`, direction]
            .filter(Boolean)
            .join(' ');
        })
        .filter((item) => item.length > 0)
        .join('、');
      pushIfPresent('排序规则', `按 ${sortText}`);
    }
  }

  return details;
}

/**
 * 解析条件组列表。
 * 入参为“组数组”,每个组是若干条件节点,组间为“或”、组内为“且”。
 */
function parseConditionGroups(
  groups: unknown[],
  fieldLabelMap: FieldLabelIndex,
  schemaCode: string
): AutomationCondition[][] {
  const result: AutomationCondition[][] = [];

  for (const group of groups) {
    if (!Array.isArray(group)) continue;

    const parsedGroup: AutomationCondition[] = [];
    for (const node of group) {
      const record = getRecord(node);
      if (record) {
        parsedGroup.push(parseCondition(record, fieldLabelMap, schemaCode));
      }
    }

    if (parsedGroup.length > 0) {
      result.push(parsedGroup);
    }
  }

  return result;
}

/**
 * 把条件组渲染成可读文本,组间用“或”、组内用“且”。
 */
function buildConditionText(groups: AutomationCondition[][]): string {
  return groups
    .map((group) => group
      .map((item) => (item.value
        ? `${item.propertyLabel} ${item.operatorLabel} ${item.value}`
        : `${item.propertyLabel} ${item.operatorLabel}`))
      .join(' 且 '))
    .join(' 或 ');
}

/**
 * 解析动作的目标表单与目标子表。
 * 数据类动作（查找/新增/更新/删除）的目标表单存放位置不同：
 * - 查找数据：TargetSchemaConfigs[0] 中的 TargetSchemaCode / TargetChildSchemaCode
 * - 其余：TargetSchemaValue = [应用编码, 目标表单编码, 目标子表或主表编码]
 * action.SchemaCode 是动作所在（源）表单，不能当目标表单用。
 */
function resolveActionTarget(
  pluginCode: string,
  requestMapping: Record<string, unknown> | null
): { formCode?: string; childSchemaCode?: string } {
  if (pluginCode === 'querydata') {
    const config = getRecord(getArray(requestMapping, 'TargetSchemaConfigs')[0]);
    const formCode = getString(config, 'TargetSchemaCode');
    const childCode = getString(config, 'TargetChildSchemaCode');
    return {
      formCode: formCode || undefined,
      childSchemaCode: childCode && childCode !== formCode ? childCode : undefined
    };
  }

  const values = getArray(requestMapping, 'TargetSchemaValue')
    .map((item) => (item === null || item === undefined ? '' : String(item)))
    .filter((item) => item.length > 0);

  // 缺失目标表单时返回 undefined,绝不回退到 action.SchemaCode：
  // SchemaCode 是动作所在的源表单,当成目标会静默产出错误的目标表单信息。
  const formCode = values.length >= 2 ? values[1] : undefined;
  const childCode = values.length >= 3 && values[2] !== values[1] ? values[2] : undefined;

  return { formCode: formCode || undefined, childSchemaCode: childCode };
}

/**
 * 生成动作的语义摘要,句式和设计器一致,便于对照阅读。
 * 目标表单由报告单独用“目标表单”一行给出,这里只描述动作语义,
 * 避免摘要与目标表单行重复、也便于跨应用引用时看清对象。
 */
function buildActionSummary(
  pluginCode: string,
  requestMapping: Record<string, unknown> | null
): string {
  switch (pluginCode) {
    case 'querydata': {
      const limit = getNumber(requestMapping, 'Limit');
      const limitText = limit !== undefined && limit > 0 ? `，最多 ${limit} 条` : '';
      return `依次查找符合条件的数据${limitText}`;
    }
    case 'updatedata': {
      const canInsert = getBoolean(requestMapping, 'IsInsert') === true;
      return `查找符合条件的数据并更新${canInsert ? '，无可更新数据时新增' : ''}`;
    }
    case 'insertdata':
      return '新增数据';
    case 'removedata':
      return '查找符合条件的数据并删除';
    case 'notification':
      return '发送消息通知';
    case 'robotnotification':
      return '发送钉钉群消息';
    case 'sms':
      return '发送短信';
    case 'email':
      return '发送邮件';
    default:
      return ACTION_TYPES[pluginCode] || pluginCode || '未知动作';
  }
}

/**
 * 递归解析单个执行动作。
 * @param stepIndexMap 动作 ObjectId 到“第几步”的映射,用于解析“节点数据”引用
 */
function parseAction(
  rawAction: unknown,
  modelSchemaCode: string,
  formNameByCode: Map<string, string>,
  fieldLabelMap: FieldLabelIndex,
  stepIndexMap: Map<string, { index: number; type: string }>
): AutomationAction | null {
  const action = getRecord(rawAction);
  if (!action) {
    return null;
  }

  const pluginCode = getString(action, 'PluginCode');
  const requestMapping = getRecord(getField(action, 'RequestMapping'));
  const { formCode: targetSchemaCode, childSchemaCode: targetChildSchemaCode } =
    resolveActionTarget(pluginCode, requestMapping);

  const isDataAction = pluginCode === 'querydata' || pluginCode === 'insertdata'
    || pluginCode === 'updatedata' || pluginCode === 'removedata';
  const resolvedTargetCode = targetSchemaCode || modelSchemaCode;

  // 更新时赋值与新增时赋值在页面上是两组独立配置，分别解析
  const updateMappings = parseFieldMappings(
    getArray(requestMapping, 'UpdateFieldMappings'),
    targetChildSchemaCode || resolvedTargetCode,
    fieldLabelMap
  );
  const insertMappings = parseFieldMappings(
    getArray(requestMapping, 'InsertFieldMappings'),
    targetChildSchemaCode || resolvedTargetCode,
    fieldLabelMap
  );

  const children: AutomationAction[] = [];
  for (const child of getArray(action, 'ChildrenTriggerAction')) {
    const parsedChild = parseAction(child, modelSchemaCode, formNameByCode, fieldLabelMap, stepIndexMap);
    if (parsedChild) {
      children.push(parsedChild);
    }
  }

  // 主表筛选条件与子表筛选条件分别存放,页面上也是两个独立区域
  const parentConditions = parseConditionGroups(
    getArray(requestMapping, 'ParentCondition'),
    fieldLabelMap,
    resolvedTargetCode
  );
  const childConditions = parseConditionGroups(
    getArray(requestMapping, 'ChildCondition'),
    fieldLabelMap,
    targetChildSchemaCode || resolvedTargetCode
  );

  // 查找动作的筛选条件单独存放在 RequestMapping.Condition.Expression
  const queryConditions = parentConditions.length === 0
    ? parseConditionGroups(
      getArray(getRecord(getField(requestMapping, 'Condition')), 'Expression'),
      fieldLabelMap,
      resolvedTargetCode
    )
    : [];

  const effectiveParentConditions = parentConditions.length > 0 ? parentConditions : queryConditions;

  // SourceId 指向本次自动化中前面某个动作时,表示使用该动作的“节点数据”。
  // 排除指向自身的情况,否则会输出“第 3 步的数据来源是第 3 步”这种自指废话。
  const sourceId = getString(action, 'SourceId');
  const selfObjectId = getString(action, 'ObjectId');
  const sourceStep = sourceId && sourceId !== selfObjectId
    ? stepIndexMap.get(sourceId)
    : undefined;

  const targetFormName = targetSchemaCode ? (formNameByCode.get(targetSchemaCode) || '') : '';
  const childSchemaName = targetChildSchemaCode
    ? fieldLabelMap.childNames.get(targetChildSchemaCode)
    : undefined;

  return {
    pluginCode,
    type: ACTION_TYPES[pluginCode] || pluginCode || '未知动作',
    summary: buildActionSummary(pluginCode, requestMapping),
    targetFormCode: isDataAction ? targetSchemaCode : undefined,
    targetFormName: isDataAction ? targetFormName : undefined,
    targetChildSchemaCode: isDataAction ? targetChildSchemaCode : undefined,
    targetChildSchemaName: childSchemaName,
    dataSource: sourceStep
      ? `第 ${sourceStep.index} 步「${sourceStep.type}」的结果`
      : undefined,
    updateMappings,
    insertMappings,
    details: buildActionDetails(requestMapping, pluginCode, fieldLabelMap),
    parentConditions: effectiveParentConditions,
    childConditions,
    hasAnyCondition: effectiveParentConditions.length > 0 || childConditions.length > 0,
    children
  };
}

/**
 * 解析单个自动化配置。
 */
function parseAutomation(
  rawModel: unknown,
  schemaCode: string,
  formNameByCode: Map<string, string>,
  fieldLabelMap: FieldLabelIndex
): Automation | null {
  const model = getRecord(rawModel);
  if (!model) {
    return null;
  }

  const triggerCodeValue = getField(model, 'ExcuteType');
  const triggerCode = typeof triggerCodeValue === 'number' ? triggerCodeValue : Number(triggerCodeValue) || 0;
  const trigger = TRIGGER_TYPES[triggerCode];

  const condition = getRecord(getField(model, 'Condition'));
  const conditionGroups = parseConditionGroups(
    getArray(condition, 'Expression'),
    fieldLabelMap,
    schemaCode
  );

  // 条件可读文本:组间用“或”连接,组内用“且”连接
  const conditionText = buildConditionText(conditionGroups);

  // 定时触发的周期说明
  const schedule = buildScheduleText(getRecord(getField(condition, 'Schedule')));

  // “数据更新时”可限定只在特定字段变更时才触发
  const updatedFields = parseUpdatedFields(condition, fieldLabelMap, schemaCode);

  // 先建立“动作 ObjectId → 第几步”的索引,后续动作通过 SourceId 引用时才能标注节点数据来源。
  // 索引需要递归覆盖子动作,否则子动作之间互相引用时会丢失“数据来源”；编号仍沿用顶层序号。
  const stepIndexMap = new Map<string, { index: number; type: string }>();
  const topActions = getArray(model, 'Action');

  const indexAction = (rawAction: unknown, label: string): void => {
    const action = getRecord(rawAction);
    const objectId = getString(action, 'ObjectId');
    if (objectId) {
      const pluginCode = getString(action, 'PluginCode');
      stepIndexMap.set(objectId, {
        index: Number(label.split('.')[0]) || 0,
        type: ACTION_TYPES[pluginCode] || pluginCode || '未知动作'
      });
    }

    getArray(action, 'ChildrenTriggerAction').forEach((child, childIdx) => {
      indexAction(child, `${label}.${childIdx + 1}`);
    });
  };

  topActions.forEach((rawAction, index) => {
    indexAction(rawAction, `${index + 1}`);
  });

  const actions: AutomationAction[] = [];
  for (const rawAction of topActions) {
    const parsedAction = parseAction(rawAction, schemaCode, formNameByCode, fieldLabelMap, stepIndexMap);
    if (parsedAction) {
      actions.push(parsedAction);
    }
  }

  const modifiedTimeValue = getField(model, 'ModifiedTime');

  // 启用状态兼容 true/1/"1" 等表示法；无法判断时按启用处理，避免把在用配置误标为停用
  const enabledValue = getBoolean(model, 'State');
  const sortKeyValue = getNumber(model, 'SortKey');

  return {
    objectId: getString(model, 'ObjectId'),
    displayName: getString(model, 'DisplayName'),
    enabled: enabledValue !== false,
    sortKey: sortKeyValue ?? 0,
    triggerCode,
    triggerType: trigger?.label || `未知触发(${triggerCode})`,
    triggerDescription: trigger?.description || '',
    schedule: schedule || undefined,
    conditionGroups,
    conditionText,
    updatedFields,
    actions,
    modifiedName: getString(model, 'ModifiedName') || undefined,
    modifiedTime: modifiedTimeValue ? String(modifiedTimeValue) : undefined
  };
}

/**
 * 解析应用下全部表单的自动化配置。
 * @param response 自动化列表接口响应
 * @param fieldLabelMap 表单编码到“字段编码→字段名称”的映射,用于把编码翻译为可读名称
 * @returns 按表单分组的自动化列表,并附带接口返回的表单名称映射
 */
export function parseAutomations(
  response: AutomaticTriggersResponse,
  fieldLabelMap: FieldLabelIndex
): {
  formAutomations: FormAutomations[];
  formNameByCode: Map<string, string>;
} {
  const successful = response.Successful ?? response.successful;
  if (successful === false) {
    const message = response.ErrorMessage || response.errorMessage || '未知错误';
    throw new Error(`获取自动化配置失败: ${message}`);
  }

  const triggers = response.ReturnData?.Triggers || [];

  // 表单名称索引：先用本地 cmax.json 的全局表单名,再用接口返回的名称覆盖。
  // 这样即使目标表单自身没有自动化、或位于其他应用,也能显示名称而不是编码。
  const formNameByCode = new Map<string, string>(fieldLabelMap.formNames || []);
  for (const group of triggers) {
    if (group?.SchemaCode && group.SchemaDisplayName) {
      formNameByCode.set(group.SchemaCode, group.SchemaDisplayName);
    }
  }

  const formAutomations: FormAutomations[] = [];
  for (const group of triggers) {
    const schemaCode = group?.SchemaCode || '';
    if (!schemaCode) continue;

    const automations: Automation[] = [];
    for (const rawModel of group.TriggerModels || []) {
      const parsed = parseAutomation(rawModel, schemaCode, formNameByCode, fieldLabelMap);
      if (parsed) {
        automations.push(parsed);
      }
    }

    // 保持氚云自动化列表中的顺序,用 SortKey 排序,不按名称重排
    automations.sort((left, right) => left.sortKey - right.sortKey);

    formAutomations.push({
      schemaCode,
      formName: group.SchemaDisplayName || formNameByCode.get(schemaCode) || schemaCode,
      automations
    });
  }

  return { formAutomations, formNameByCode };
}

/**
 * 获取触发类型的名称与说明,供外部复用。
 */
export function getTriggerTypeInfo(triggerCode: number): { label: string; description: string } {
  return TRIGGER_TYPES[triggerCode] || { label: `未知触发(${triggerCode})`, description: '' };
}

/**
 * 获取执行动作编码对应的动作名称。
 */
export function getActionTypeLabel(pluginCode: string): string {
  return ACTION_TYPES[pluginCode] || pluginCode;
}

/**
 * 导出条件操作符的中文映射,便于文档与报告保持一致。
 */
export function getOperatorLabel(operator: string): string {
  return OPERATORS[operator] || operator;
}

