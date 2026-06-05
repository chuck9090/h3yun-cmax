import { H3Application } from '../types';
import { H3FunctionNode } from './functionNodeTypes';

export interface FunctionNodeAppListResponse {
  returnData?: H3FunctionNode[];
  successful: boolean;
  errorMessage?: string;
}

/**
 * 解析应用列表接口响应,并按应用编码匹配应用信息
 */
export function parseApplication(response: FunctionNodeAppListResponse, appCode: string): H3Application {
  if (!response.successful) {
    throw new Error(`获取应用列表失败: ${response.errorMessage || '未知错误'}`);
  }

  const application = (response.returnData || []).find((item) => item.appCode === appCode || item.code === appCode);

  if (!application) {
    throw new Error(`未找到应用编码: ${appCode}`);
  }

  return {
    appCode: application.appCode || application.code,
    appName: application.displayName,
    description: application.summary || undefined
  };
}
