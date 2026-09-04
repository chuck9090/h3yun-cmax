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
  formCode: string;     // 表单编码
  formName: string;     // 表单名称
  description?: string; // 表单描述
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
  appSuffix?: string;                   // 应用文件夹编码后缀 (a+MD5前缀)
  forms: Record<string, CmaxFormEntry>; // 表单配置, key 为编码后缀 (f+MD5前缀)
  lastSyncTime?: string;                // 最后同步时间
}

/**
 * 氚云代码目录级配置文件结构。
 */
export interface CmaxWorkspaceConfig {
  version: 2;
  engineCode?: string;                  // 企业引擎编码
  h3yunApiVersion?: H3YunApiVersion;    // 氚云接口版本,缺省使用老版本
  systemUserId?: string;                // System 用户的 ObjectId,用于 MCP 执行 SQL 查询
  apps: Record<string, CmaxConfig>;
}

/**
 * CMax 表单配置条目
 */
export interface CmaxFormEntry {
  formCode: string;  // 表单编码
  formName: string;  // 表单名称
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
