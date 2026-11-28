import { H3YunLegacyApiService, H3YunLoadFormError } from './h3yunApiLegacy';
import { ListViewCode } from '../parsers/listViewDesignerParser';
import { SheetDesignerLoadFormResponse } from '../parsers/sheetDesignerParser';
import { FormCustomCode } from '../parsers/customCodeParser';
import { get, post, parseJsonResponse } from '../utils/httpUtils';
import { buildUrl, getAuthHeaders, ensureSuccessfulStatus } from './h3yunApiLegacy';

/**
 * 新版本列表设计器接口响应
 */
interface NewListViewDesignerResponse {
  successful?: boolean;
  returnData?: Array<{
    javascript?: string | null;
    behindCode?: string | null;
    [key: string]: unknown;
  }>;
}

/**
 * 新版本表单代码编辑器接口响应
 */
interface NewCodeEditorResponse {
  successful?: boolean;
  errorMessage?: string | null;
  returnData?: {
    jsCode?: string | null;
    behindCode?: string | null;
  };
}

/**
 * 新版代码编辑器接口的代码类型：1 表示表单代码。
 * 列表代码走 /v1/view/designer/load，不使用该接口。
 */
const NEW_CODE_EDITOR_TYPE_FORM = 1;

/**
 * 氚云新版本 API 服务类。
 * 新版本的表单设计、表单代码、列表设计接口与老版本不同，集中在本文件内实现。
 */
export class H3YunNewApiService extends H3YunLegacyApiService {
  private readonly newLoadFormCache = new Map<string, SheetDesignerLoadFormResponse>();
  private readonly newCustomCodeCache = new Map<string, FormCustomCode>();

  setToken(token: string, engineCode: string): void {
    super.setToken(token, engineCode);
    this.newLoadFormCache.clear();
    this.newCustomCodeCache.clear();
  }

  clearCaches(): void {
    super.clearCaches();
    this.newLoadFormCache.clear();
    this.newCustomCodeCache.clear();
  }

  /**
   * 新版表单设计接口：GET /v1/formdesign/load?schemaCode=...
   * 返回结构中的 returnData.designContent 与老版一致，继续交给 parseSchemaJSON 解析。
   */
  protected async loadFormDesign(formCode: string): Promise<SheetDesignerLoadFormResponse> {
    const cachedResponse = this.newLoadFormCache.get(formCode);
    if (cachedResponse) {
      return cachedResponse;
    }

    const url = buildUrl('/v1/formdesign/load');
    const headers = {
      ...getAuthHeaders(),
      'Accept': 'application/json'
    };
    const fullUrl = `${url}?schemaCode=${encodeURIComponent(formCode)}`;
    const response = await get(fullUrl, headers);

    let apiResponse: SheetDesignerLoadFormResponse;
    try {
      ensureSuccessfulStatus(response.statusCode, '获取表单字段');
      apiResponse = parseJsonResponse<SheetDesignerLoadFormResponse>(response);
    } catch (error) {
      throw new H3YunLoadFormError(error instanceof Error ? error.message : String(error));
    }

    const errorCode = (apiResponse as { errorCode?: string }).errorCode || '';
    const errorMessage = apiResponse.ErrorMessage
      || (apiResponse as { errorMessage?: string | null }).errorMessage
      || '接口返回失败';
    if (apiResponse.successful === false || apiResponse.Successful === false) {
      // 新版接口对报表、看板等非表单编码返回 form.designer.notExist / form.designer.type.failed。
      // 这不是接口故障，而是“该编码不是表单”，交给 hasFormSchema 跳过，不记失败。
      const normalizedErrorMessage = errorMessage.trim();
      if (
        errorCode === 'form.designer.notExist' ||
        errorCode === 'form.designer.type.failed' ||
        normalizedErrorMessage === '表单不存在' ||
        normalizedErrorMessage === '不是正确的表单'
      ) {
        return apiResponse;
      }
      throw new H3YunLoadFormError(errorMessage);
    }
    if (!apiResponse.returnData && !apiResponse.ReturnData) {
      throw new H3YunLoadFormError('表单设计接口返回数据为空');
    }

    this.newLoadFormCache.set(formCode, apiResponse);
    return apiResponse;
  }

  /**
   * 新版表单代码编辑器接口：POST /v1/codeeditor/loadcode
   * type=1 表示表单代码，返回 returnData.jsCode（前端）/ behindCode（后端）。
   */
  protected async loadCustomCode(formCode: string): Promise<FormCustomCode> {
    const cachedCode = this.newCustomCodeCache.get(formCode);
    if (cachedCode) {
      return cachedCode;
    }

    const url = buildUrl('/v1/codeeditor/loadcode');
    const headers = {
      ...getAuthHeaders(),
      'Accept': 'application/json',
      'Content-Type': 'application/json;charset=UTF-8'
    };
    const body = JSON.stringify({
      schemaCode: formCode,
      type: NEW_CODE_EDITOR_TYPE_FORM
    });
    const response = await post(url, body, headers);

    ensureSuccessfulStatus(response.statusCode, '获取表单自定义代码');
    const apiResponse = parseJsonResponse<NewCodeEditorResponse>(response);
    if (apiResponse.successful === false) {
      throw new Error(apiResponse.errorMessage || '接口返回失败');
    }
    if (!apiResponse.returnData) {
      throw new Error('表单代码接口返回数据为空');
    }

    const data = apiResponse.returnData;
    const customCode: FormCustomCode = {
      formFrontendCode: data.jsCode || '',
      formBackendCode: data.behindCode || ''
    };
    this.newCustomCodeCache.set(formCode, customCode);
    return customCode;
  }

  protected async loadListViewCode(formCode: string): Promise<ListViewCode> {
    const url = buildUrl('/v1/view/designer/load');
    const headers = {
      ...getAuthHeaders(),
      'Accept': 'application/json'
    };
    const fullUrl = `${url}?schemaCode=${encodeURIComponent(formCode)}`;
    const response = await get(fullUrl, headers);

    ensureSuccessfulStatus(response.statusCode, '获取列表代码');
    const apiResponse = parseJsonResponse<NewListViewDesignerResponse>(response);

    if (apiResponse.successful === false) {
      throw new Error('获取列表代码失败: 接口返回失败');
    }
    if (!apiResponse.returnData || apiResponse.returnData.length === 0) {
      // 没有列表设计配置时返回空代码，交由 useDefaultCodeIfEmpty 生成默认模板。
      return {
        listFrontendCode: '',
        listBackendCode: ''
      };
    }

    const data = apiResponse.returnData[0];
    return {
      listFrontendCode: data.javascript || '',
      listBackendCode: data.behindCode || ''
    };
  }
}

// 导出新版本 API 单例实例
export const h3yunNewApi = new H3YunNewApiService();
