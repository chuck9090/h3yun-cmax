import { BusinessRule } from '../types';

/**
 * 业务规则接口返回的单条规则。
 * 氚云接口中 String 字段可能为 null,这里统一按可空处理。
 */
export interface FormulaEventHandler {
  RuleNo?: number | null;
  SubmitCode?: string | null;
  SubmitText?: string | null;
  RollbackCode?: string | null;
  RollbackText?: string | null;
  Description?: string | null;
  RuleStatus?: number | null;
}

/**
 * `/Console/FormulaEventHandler/OnAction` 的响应结构。
 * ActionName 为 `LoadFormulaEventHandlers` 时,规则位于 `ReturnData.FormulaEventHandlers`。
 */
export interface FormulaEventHandlersResponse {
  Successful?: boolean;
  successful?: boolean;
  ErrorMessage?: string | null;
  ReturnData?: {
    IsSuccess?: boolean;
    ErrorMessage?: string | null;
    FormulaEventHandlers?: FormulaEventHandler[] | null;
  } | null;
}

function toText(value: string | null | undefined): string {
  return typeof value === 'string' ? value : '';
}

/**
 * 解析业务规则响应。
 *
 * 氚云对“该表单没有业务规则”的返回是顶层 `Successful: true`、`ReturnData.IsSuccess: false`，
 * 且不带 `FormulaEventHandlers`，因此这种响应按空规则处理，不能算失败。
 *
 * 其他无法确认的情况（`ReturnData` 为空、结构损坏、`IsSuccess=false` 且带错误信息等）
 * 一律抛错，由同步层计入失败并保留本地旧文件，避免用空内容覆盖本地唯一的规则记录。
 *
 * @param response 原始响应
 * @returns 按接口返回顺序排列的规则列表
 */
export function parseBusinessRules(response: FormulaEventHandlersResponse): BusinessRule[] {
  const successful = response.Successful ?? response.successful;
  if (successful === false) {
    throw new Error(`获取业务规则失败: ${response.ErrorMessage || '氚云返回失败'}`);
  }

  const returnData = response.ReturnData;
  if (!returnData || typeof returnData !== 'object') {
    throw new Error('获取业务规则失败: 返回数据为空');
  }

  const rawRules = returnData.FormulaEventHandlers;
  if (Array.isArray(rawRules)) {
    return rawRules.map((rule) => ({
      ruleNo: typeof rule.RuleNo === 'number' ? rule.RuleNo : 0,
      description: toText(rule.Description),
      ruleStatus: typeof rule.RuleStatus === 'number' ? rule.RuleStatus : 0,
      submitCode: toText(rule.SubmitCode),
      submitText: toText(rule.SubmitText),
      rollbackCode: toText(rule.RollbackCode),
      rollbackText: toText(rule.RollbackText)
    }));
  }

  // null 是接口明确表示“没有规则”。
  if (rawRules === null) {
    return [];
  }

  // 没有规则数组、顶层成功、但 ReturnData.IsSuccess=false:氚云对“该表单无业务规则”的正常返回。
  if (returnData.IsSuccess === false) {
    if (returnData.ErrorMessage) {
      throw new Error(`获取业务规则失败: ${returnData.ErrorMessage}`);
    }
    return [];
  }

  throw new Error('获取业务规则失败: 返回结构无法识别');
}
