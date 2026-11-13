export type H3YunApiVersion = 'legacy' | 'new';

/**
 * 氚云应用信息
 */
export interface H3Application {
  appCode: string;      // 应用编码
  appName: string;      // 应用名称
  description?: string; // 应用描述
}

/**
 * 氚云表单信息
 */
export interface H3Form {
  formCode: string;       // 表单编码
  formName: string;       // 表单名称
  description?: string;   // 表单描述
  groupPath?: string[];   // 表单在应用中的分组路径,为空表示直接位于应用顶层
}

/**
 * 表单字段信息
 */
export interface H3FormField {
  fieldCode: string;    // 字段编码
  fieldName: string;    // 字段名称
  fieldType: string;    // 字段类型
  required?: boolean;   // 是否必填
  defaultValue?: unknown; // 默认值
}

/**
 * CMax 配置文件结构
 */
export interface CmaxConfig {
  appCode: string;                      // 应用编码
  appName: string;                      // 应用名称
  forms: Record<string, CmaxFormEntry>; // 表单配置, key 为编码后缀 (f+MD5前缀)
  lastSyncTime?: string;                // 最后同步时间
}

/**
 * 氚云代码目录级配置文件结构。
 */
export interface CmaxWorkspaceConfig {
  version: 2;
  engineCode?: string;                  // 企业引擎编码
  h3yunApiVersion?: H3YunApiVersion;    // 氚云接口版本,缺省使用新版本
  systemUserId?: string;                // System 用户的 ObjectId,用于 MCP 执行 SQL 查询
  apps: Record<string, CmaxConfig>;
}

/**
 * CMax 表单配置条目
 */
export interface CmaxFormEntry {
  formCode: string;      // 表单编码
  formName: string;      // 表单名称
  groupPath?: string[];  // 表单在应用中的分组路径,为空表示直接位于应用顶层
}

/**
 * API 响应基础结构
 */
export interface ApiResponse<T = unknown> {
  success: boolean;   // 请求是否成功
  data?: T;           // 响应数据
  errorCode?: string; // 错误码
  errorMessage?: string; // 错误消息
}

/**
 * 进度回调函数类型
 */
export type ProgressCallback = (message: string, progress: number) => void;

/**
 * 文件内容映射
 */
export interface FileContentMap {
  'fields.md': string;
  'form-frontend.js': string;
  'form-backend.cs': string;
  'list-frontend.js': string;
  'list-backend.cs': string;
}

/**
 * 同步范围。
 * - all：表单设计与代码（不含自动化；自动化需单独执行“同步自动化”）
 * - formDesign：仅同步表单设计（字段表 fields.md）
 * - code：仅同步表单与列表的前后端代码
 * - automation：仅同步自动化配置（automation.md）
 */
export type SyncScope = 'all' | 'formDesign' | 'code' | 'automation';

/**
 * 自动化条件：组内为“且”，组间为“或”。
 */
export interface AutomationCondition {
  propertyName: string;   // 字段编码
  propertyLabel: string;  // 字段显示名称
  operator: string;       // 操作符原始值，如 Equal
  operatorLabel: string;  // 操作符中文说明
  value: string;          // 比较值（已尽量翻译为可读文本）
}

/**
 * 自动化动作中的字段赋值关系。
 */
export interface AutomationFieldMapping {
  targetField: string;    // 目标字段编码
  targetLabel: string;    // 目标字段名称
  source: string;         // 取值来源（字段引用或固定值）
  sourceType: string;     // 取值方式的中文说明
}

/**
 * 自动化执行动作。
 */
export interface AutomationAction {
  pluginCode: string;                 // 接口原始动作编码,如 insertdata
  type: string;                       // 动作名称,如“新增数据”
  summary: string;                    // 与设计器一致的语义摘要,如“在【X】中查找符合条件的数据”
  targetFormCode?: string;            // 目标表单编码
  targetFormName?: string;            // 目标表单名称
  targetChildSchemaCode?: string;     // 目标子表编码,仅当动作针对子表时有值
  targetChildSchemaName?: string;     // 目标子表名称,取自 fields.md
  dataSource?: string;                // 数据来源节点的说明,如“第 1 步「查找数据」的结果”
  updateMappings: AutomationFieldMapping[]; // 更新已有数据时的字段赋值
  insertMappings: AutomationFieldMapping[]; // 新增数据时的字段赋值
  details: Array<[string, string]>;   // 其余可读属性,如接收人、消息内容
  parentConditions: AutomationCondition[][]; // 主表筛选条件
  childConditions: AutomationCondition[][];  // 子表筛选条件
  hasAnyCondition: boolean;           // 是否存在任一筛选条件
  children: AutomationAction[];       // 子动作(子表动作)
}

/**
 * 单个自动化配置。
 */
export interface Automation {
  objectId: string;
  displayName: string;
  enabled: boolean;
  sortKey: number;              // 在氚云自动化列表中的排序值
  triggerCode: number;          // 触发类型原始值
  triggerType: string;          // 触发类型名称,如“数据生效时”
  triggerDescription: string;   // 触发类型说明
  schedule?: string;            // 定时触发的周期说明,非定时触发时为空
  conditionGroups: AutomationCondition[][]; // 条件组,组间“或”、组内“且”
  conditionText: string;        // 条件的可读文本,无条件时为空
  updatedFields: string[];      // 数据更新时触发的限定字段,为空表示不限定
  actions: AutomationAction[];
  modifiedName?: string;
  modifiedTime?: string;
}

/**
 * 一个表单下的自动化集合。
 */
export interface FormAutomations {
  schemaCode: string;
  formName: string;
  automations: Automation[];
}
