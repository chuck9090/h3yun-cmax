import { get, post, parseJsonResponse } from '../utils/httpUtils';
import {
  H3Application,
  H3Form,
  H3FormField,
  ApiResponse,
  FileContentMap
} from '../types';

/**
 * 氚云 API 基础配置
 * TODO: 根据实际平台配置修改这些值
 */
const API_BASE_URL = 'https://api.h3yun.com'; // 占位符,待用户提供实际地址
const API_TIMEOUT = 30000; // 30秒超时

/**
 * 全局 Token 存储
 */
let globalToken: string = '';

/**
 * 设置认证 Token
 * @param token h3_token
 */
export function setToken(token: string): void {
  globalToken = token;
}

/**
 * 获取请求头(包含认证信息)
 */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
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
  }

  /**
   * 获取应用信息
   * @param appCode 应用编码
   * @returns 应用信息
   */
  async getApplication(appCode: string): Promise<H3Application> {
    const url = buildUrl(`/api/applications/${appCode}`);
    const headers = getAuthHeaders();

    try {
      const response = await get(url, headers);
      const apiResponse = parseJsonResponse<ApiResponse<H3Application>>(response);
      if (!apiResponse.success) {
        throw new Error(`获取应用信息失败: ${apiResponse.errorMessage || '未知错误'}`);
      }
      return apiResponse.data!;
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
    const url = buildUrl(`/api/applications/${appCode}/forms`);
    const headers = getAuthHeaders();

    try {
      const response = await get(url, headers);
      const apiResponse = parseJsonResponse<ApiResponse<H3Form[]>>(response);
      if (!apiResponse.success) {
        throw new Error(`获取表单列表失败: ${apiResponse.errorMessage || '未知错误'}`);
      }
      return apiResponse.data!;
    } catch (error) {
      throw new Error(`获取表单列表失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取表单字段表
   * @param formCode 表单编码
   * @returns 字段列表
   */
  async getFormFields(formCode: string): Promise<H3FormField[]> {
    const url = buildUrl(`/api/forms/${formCode}/fields`);
    const headers = getAuthHeaders();

    try {
      const response = await get(url, headers);
      const apiResponse = parseJsonResponse<ApiResponse<H3FormField[]>>(response);
      if (!apiResponse.success) {
        throw new Error(`获取表单字段失败: ${apiResponse.errorMessage || '未知错误'}`);
      }
      return apiResponse.data!;
    } catch (error) {
      throw new Error(`获取表单字段失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取表单前端代码
   * @param formCode 表单编码
   * @returns 前端代码内容
   */
  async getFormFrontendCode(formCode: string): Promise<string> {
    const url = buildUrl(`/api/forms/${formCode}/frontend-code`);
    const headers = getAuthHeaders();

    try {
      const response = await get(url, headers);
      const apiResponse = parseJsonResponse<ApiResponse<{ code: string }>>(response);
      if (!apiResponse.success) {
        throw new Error(`获取表单前端代码失败: ${apiResponse.errorMessage || '未知错误'}`);
      }
      return apiResponse.data?.code || '';
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
    const url = buildUrl(`/api/forms/${formCode}/backend-code`);
    const headers = getAuthHeaders();

    try {
      const response = await get(url, headers);
      const apiResponse = parseJsonResponse<ApiResponse<{ code: string }>>(response);
      if (!apiResponse.success) {
        throw new Error(`获取表单后端代码失败: ${apiResponse.errorMessage || '未知错误'}`);
      }
      return apiResponse.data?.code || '';
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
    const url = buildUrl(`/api/forms/${formCode}/list-frontend-code`);
    const headers = getAuthHeaders();

    try {
      const response = await get(url, headers);
      const apiResponse = parseJsonResponse<ApiResponse<{ code: string }>>(response);
      if (!apiResponse.success) {
        throw new Error(`获取列表前端代码失败: ${apiResponse.errorMessage || '未知错误'}`);
      }
      return apiResponse.data?.code || '';
    } catch (error) {
      console.warn(`获取列表前端代码失败: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }

  /**
   * 获取列表后端代码
   * @param formCode 表单编码
   * @returns 列表后端代码内容
   */
  async getListBackendCode(formCode: string): Promise<string> {
    const url = buildUrl(`/api/forms/${formCode}/list-backend-code`);
    const headers = getAuthHeaders();

    try {
      const response = await get(url, headers);
      const apiResponse = parseJsonResponse<ApiResponse<{ code: string }>>(response);
      if (!apiResponse.success) {
        throw new Error(`获取列表后端代码失败: ${apiResponse.errorMessage || '未知错误'}`);
      }
      return apiResponse.data?.code || '';
    } catch (error) {
      console.warn(`获取列表后端代码失败: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
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
      'fields.json': JSON.stringify(fields, null, 2),
      'form-frontend.ts': formFrontend,
      'form-backend.cs': formBackend,
      'list-frontend.ts': listFrontend,
      'list-backend.cs': listBackend
    };
  }
}

// 导出单例实例
export const h3yunApi = new H3YunApiService();
