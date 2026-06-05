export interface ListViewDesignerLoadResponse {
  Successful?: boolean;
  ErrorMessage?: string | null;
  ReturnData?: {
    ListViewSetting?: {
      Javascript?: string | null;
      NewJsCode?: string | null;
      BehindCode?: string | null;
    };
  };
}

export interface ListViewCode {
  listFrontendCode: string;
  listBackendCode: string;
}

/**
 * 解析列表设计器 Load 接口响应
 */
export function parseListViewCode(response: ListViewDesignerLoadResponse): ListViewCode {
  if (response.Successful === false) {
    throw new Error(`获取列表代码失败: ${response.ErrorMessage || '未知错误'}`);
  }

  const listViewSetting = response.ReturnData?.ListViewSetting || {};

  return {
    listFrontendCode: listViewSetting.NewJsCode || listViewSetting.Javascript || '',
    listBackendCode: listViewSetting.BehindCode || ''
  };
}
