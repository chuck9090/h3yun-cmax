import { H3FunctionNode } from './functionNodeTypes';

export interface FunctionNodeChildrenResponse {
  returnData?: H3FunctionNode[];
  successful: boolean;
  errorMessage?: string;
}

/**
 * 解析应用下节点列表接口响应
 */
export function parseFunctionNodes(response: FunctionNodeChildrenResponse): H3FunctionNode[] {
  if (!response.successful) {
    throw new Error(`获取应用节点失败: ${response.errorMessage || '未知错误'}`);
  }

  return response.returnData || [];
}
