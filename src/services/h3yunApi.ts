import * as fs from 'fs';
import * as path from 'path';
import { get, post, parseJsonResponse } from '../utils/httpUtils';
import {
  H3Application,
  H3Form,
  FileContentMap
} from '../types';
import { parseApplication, FunctionNodeAppListResponse } from '../parsers/appListParser';
import { parseFunctionNodes, FunctionNodeChildrenResponse } from '../parsers/functionNodeChildrenParser';
import {
  hasFormSchema,
  parseSchemaJSON,
  SheetDesignerLoadFormResponse
} from '../parsers/sheetDesignerParser';
import { H3FunctionNode } from '../parsers/functionNodeTypes';
import {
  FormCustomCode,
  LoadCustomCodeResponse,
  parseFormCustomCode
} from '../parsers/customCodeParser';
import {
  ListViewCode,
  ListViewDesignerLoadResponse,
  parseListViewCode
} from '../parsers/listViewDesignerParser';

/**
 * 氚云 API 基础配置
 */
const API_BASE_URL = 'https://www.h3yun.com';

/**
 * 全局 Token 存储
 */
let globalToken: string = '';
const loadFormCache = new Map<string, SheetDesignerLoadFormResponse>();
const customCodeCache = new Map<string, FormCustomCode>();
const listViewCodeCache = new Map<string, ListViewCode>();
const loadFormFailures: Array<{ code: string; name: string; error: string }> = [];

function readDefaultCode(filename: keyof Omit<FileContentMap, 'fields.md'>): string {
  const defaultCodePath = path.resolve(__dirname, '..', 'default-code', filename);

  if (!fs.existsSync(defaultCodePath)) {
    return '';
  }

  return fs.readFileSync(defaultCodePath, 'utf-8');
}

function useDefaultCodeIfEmpty(
  filename: keyof Omit<FileContentMap, 'fields.md'>,
  content: string,
  formCode: string
): string {
  if (content.trim().length > 0) {
    return content;
  }

  const defaultCode = readDefaultCode(filename);

  if (filename === 'form-backend.cs' || filename === 'list-backend.cs') {
    return defaultCode.replace(/\{SchemaCode\}/g, formCode);
  }

  return defaultCode;
}

/**
 * 设置认证 Token
 * @param token h3_token
 */
export function setToken(token: string): void {
  globalToken = token;
  loadFormCache.clear();
  customCodeCache.clear();
  listViewCodeCache.clear();
  loadFormFailures.length = 0;
}

/**
 * 获取请求头(包含认证信息)
 */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json;charset=UTF-8'
  };

  // 如果设置了 Token,添加到请求头
  if (globalToken) {
    headers['Authorization'] = `Bearer ${globalToken}`;
    // 或者根据实际需求使用 Cookie 方式
    // headers['Cookie'] = `h3_token=${globalToken}`;
  }

  return headers;
}

/**
 * 构建完整的 API URL
 * @param endpoint API 端点路径
 * @returns 完整的 URL
 */
function buildUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint}`;
}

function ensureSuccessfulStatus(statusCode: number, action: string): void {
  if (statusCode >= 200 && statusCode < 300) {
    return;
  }

  throw new Error(`${action}失败: HTTP ${statusCode}`);
}

/**
 * 氚云 API 服务类
 */
export class H3YunApiService {
  /**
   * 设置认证 Token
   * @param token h3_token
   */
  setToken(token: string): void {
    globalToken = token;
    loadFormCache.clear();
    customCodeCache.clear();
    listViewCodeCache.clear();
    loadFormFailures.length = 0;
  }

  /**
   * 获取并清空 LoadForm 请求失败节点
   */
  consumeLoadFormFailures(): Array<{ code: string; name: string; error: string }> {
    const failures = [...loadFormFailures];
    loadFormFailures.length = 0;
    return failures;
  }

  /**
   * 获取应用信息
   * @param appCode 应用编码
   * @returns 应用信息
   */
  async getApplication(appCode: string): Promise<H3Application> {
    try {
      return await this.getApplicationFromList(appCode);
    } catch (error) {
      throw new Error(`获取应用信息失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取应用下的所有表单
   * @param appCode 应用编码
   * @returns 表单列表
   */
  async getForms(appCode: string): Promise<H3Form[]> {
    try {
      const nodes = await this.getFunctionNodes(appCode);
      const formEntries: Array<H3Form | null> = await Promise.all(nodes.map(async (node) => {
        let loadFormResponse: SheetDesignerLoadFormResponse;

        try {
          loadFormResponse = await this.loadFormDesign(node.code);
        } catch (error) {
          loadFormFailures.push({
            code: node.code,
            name: node.displayName,
            error: error instanceof Error ? error.message : String(error)
          });
          return null;
        }

        if (!hasFormSchema(loadFormResponse)) {
          return null;
        }

        return {
          formCode: node.code,
          formName: node.displayName,
          description: node.summary || undefined
        };
      }));

      return formEntries.filter((entry): entry is H3Form => entry !== null);
    } catch (error) {
      throw new Error(`获取表单列表失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getFunctionNodes(appCode: string): Promise<H3FunctionNode[]> {
    const url = buildUrl('/v1/functionnode/children');
    const headers = getAuthHeaders();
    const body = JSON.stringify({
      parentCode: appCode,
      checkHasChild: false
    });

    const response = await post(url, body, headers);
    ensureSuccessfulStatus(response.statusCode, '获取应用节点');
    const apiResponse = parseJsonResponse<FunctionNodeChildrenResponse>(response);
    return parseFunctionNodes(apiResponse);
  }

  private async getApplicationFromList(appCode: string): Promise<H3Application> {
    const url = buildUrl('/v1/functionnode/app/list');
    const headers = getAuthHeaders();
    const response = await get(url, headers);

    ensureSuccessfulStatus(response.statusCode, '获取应用列表');
    const apiResponse = parseJsonResponse<FunctionNodeAppListResponse>(response);
    return parseApplication(apiResponse, appCode);
  }

  /**
   * 获取表单字段表
   * @param formCode 表单编码
   * @returns 字段表文本
   */
  async getFormFields(formCode: string): Promise<string> {
    try {
      const apiResponse = await this.loadFormDesign(formCode);
      return parseSchemaJSON(apiResponse);
    } catch (error) {
      throw new Error(`获取表单字段失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async loadFormDesign(formCode: string): Promise<SheetDesignerLoadFormResponse> {
    const cachedResponse = loadFormCache.get(formCode);

    if (cachedResponse) {
      return cachedResponse;
    }

    const url = buildUrl('/Console/SheetDesigner/OnAction');
    const headers = {
      ...getAuthHeaders(),
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    const postData = JSON.stringify({
      ActionName: 'LoadForm',
      id: formCode
    });
    const body = `PostData=${encodeURIComponent(postData)}`;
    const response = await post(url, body, headers);

    ensureSuccessfulStatus(response.statusCode, '获取表单字段');
    const apiResponse = parseJsonResponse<SheetDesignerLoadFormResponse>(response);
    loadFormCache.set(formCode, apiResponse);

    return apiResponse;
  }

  /**
   * 获取表单前端代码
   * @param formCode 表单编码
   * @returns 前端代码内容
   */
  async getFormFrontendCode(formCode: string): Promise<string> {
    try {
      const customCode = await this.loadCustomCode(formCode);
      return customCode.formFrontendCode;
    } catch (error) {
      console.warn(`获取表单前端代码失败: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }

  /**
   * 获取表单后端代码
   * @param formCode 表单编码
   * @returns 后端代码内容
   */
  async getFormBackendCode(formCode: string): Promise<string> {
    try {
      const customCode = await this.loadCustomCode(formCode);
      return customCode.formBackendCode;
    } catch (error) {
      console.warn(`获取表单后端代码失败: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }

  /**
   * 获取列表前端代码
   * @param formCode 表单编码
   * @returns 列表前端代码内容
   */
  async getListFrontendCode(formCode: string): Promise<string> {
    try {
      const listViewCode = await this.loadListViewCode(formCode);
      return listViewCode.listFrontendCode;
    } catch (error) {
      console.warn(`获取列表前端代码失败: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }

  private async loadCustomCode(formCode: string): Promise<FormCustomCode> {
    const cachedCode = customCodeCache.get(formCode);

    if (cachedCode) {
      return cachedCode;
    }

    const url = buildUrl('/Console/SheetDesigner/OnAction');
    const headers = {
      ...getAuthHeaders(),
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded',
      'SchemaCode': formCode
    };
    const postData = JSON.stringify({
      ActionName: 'LoadCustomCode',
      SchemaCode: formCode
    });
    const body = `PostData=${encodeURIComponent(postData)}`;
    const response = await post(url, body, headers);

    ensureSuccessfulStatus(response.statusCode, '获取表单自定义代码');
    const apiResponse = parseJsonResponse<LoadCustomCodeResponse>(response);
    const customCode = parseFormCustomCode(apiResponse);
    customCodeCache.set(formCode, customCode);

    return customCode;
  }

  /**
   * 获取列表后端代码
   * @param formCode 表单编码
   * @returns 列表后端代码内容
   */
  async getListBackendCode(formCode: string): Promise<string> {
    try {
      const listViewCode = await this.loadListViewCode(formCode);
      return listViewCode.listBackendCode;
    } catch (error) {
      console.warn(`获取列表后端代码失败: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }

  private async loadListViewCode(formCode: string): Promise<ListViewCode> {
    const cachedCode = listViewCodeCache.get(formCode);

    if (cachedCode) {
      return cachedCode;
    }

    const url = buildUrl('/ListViewDesigner/OnAction');
    const headers = {
      ...getAuthHeaders(),
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    const postData = JSON.stringify({
      ActionName: 'Load',
      id: formCode
    });
    const body = `PostData=${encodeURIComponent(postData)}`;
    const response = await post(url, body, headers);

    ensureSuccessfulStatus(response.statusCode, '获取列表代码');
    const apiResponse = parseJsonResponse<ListViewDesignerLoadResponse>(response);
    const listViewCode = parseListViewCode(apiResponse);
    listViewCodeCache.set(formCode, listViewCode);

    return listViewCode;
  }

  /**
   * 获取表单的所有代码内容
   * @param formCode 表单编码
   * @returns 所有代码内容的映射
   */
  async getFormAllCodes(formCode: string): Promise<FileContentMap> {
    const [fields, formFrontend, formBackend, listFrontend, listBackend] = await Promise.all([
      this.getFormFields(formCode),
      this.getFormFrontendCode(formCode),
      this.getFormBackendCode(formCode),
      this.getListFrontendCode(formCode),
      this.getListBackendCode(formCode)
    ]);

    return {
      'fields.md': fields,
      'form-frontend.js': useDefaultCodeIfEmpty('form-frontend.js', formFrontend, formCode),
      'form-backend.cs': useDefaultCodeIfEmpty('form-backend.cs', formBackend, formCode),
      'list-frontend.js': useDefaultCodeIfEmpty('list-frontend.js', listFrontend, formCode),
      'list-backend.cs': useDefaultCodeIfEmpty('list-backend.cs', listBackend, formCode)
    };
  }
}

// 导出单例实例
export const h3yunApi = new H3YunApiService();
