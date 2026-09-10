import { H3YunLegacyApiService } from './h3yunApiLegacy';
import { ListViewCode } from '../parsers/listViewDesignerParser';
import { get, parseJsonResponse } from '../utils/httpUtils';
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
 * 氚云新版本 API 服务类。
 * 当前先复用老版本能力,新版本接口差异集中在本文件内迭代。
 */
export class H3YunNewApiService extends H3YunLegacyApiService {
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

    if (apiResponse.successful === false || !apiResponse.returnData || apiResponse.returnData.length === 0) {
      throw new Error('获取列表代码失败: 返回数据为空');
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
