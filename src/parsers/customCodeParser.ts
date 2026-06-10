export interface LoadCustomCodeResponse {
  Successful?: boolean;
  ErrorMessage?: string | null;
  ReturnData?: {
    JsCode?: string | null;
    NewJsCode?: string | null;
    CsCode?: string | null;
    DefaultJsCode?: string | null;
    DefaultNewJsCode?: string | null;
    DefaultCsCode?: string | null;
  };
}

export interface FormCustomCode {
  formFrontendCode: string;
  formBackendCode: string;
}

/**
 * 解析表单自定义代码接口响应
 */
export function parseFormCustomCode(response: LoadCustomCodeResponse): FormCustomCode {
  if (response.Successful === false) {
    throw new Error(`获取表单自定义代码失败: ${response.ErrorMessage || '未知错误'}`);
  }

  const returnData = response.ReturnData || {};

  return {
    formFrontendCode: returnData.NewJsCode || '',
    formBackendCode: returnData.CsCode || ''
  };
}
