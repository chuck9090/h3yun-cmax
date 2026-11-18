/**
 * 日期时间格式化工具。
 */

/**
 * .NET JSON 日期格式：`/Date(1794284420000)/`，可能带时区偏移 `/Date(1794284420000+0800)/`。
 */
const DOTNET_DATE_PATTERN = /^\/Date\((-?\d+)([+-]\d{4})?\)\/$/;

/**
 * 补零到两位。
 */
function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * 把各种来源的日期时间值统一格式化为 `yyyy-MM-dd HH:mm:ss`。
 *
 * 支持的输入：
 * - `/Date(1794284420000)/` —— 氚云接口返回的 .NET JSON 日期，毫秒时间戳（UTC）
 * - `/Date(1794284420000+0800)/` —— 带时区偏移的 .NET 日期
 * - ISO 字符串 `2026-11-12T10:28:06Z`
 * - 毫秒时间戳 number
 * - `Date` 实例
 *
 * 输出使用运行环境的本地时区，便于阅读。
 * 无法识别的值返回 undefined，由调用方决定是否展示。
 * @param value 原始日期时间值
 * @returns 格式化后的字符串，无法识别时返回 undefined
 */
export function formatDateTime(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  let date: Date | undefined;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    date = new Date(value);
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const dotNetMatch = DOTNET_DATE_PATTERN.exec(trimmed);
    if (dotNetMatch) {
      // .NET 的 /Date(...) 里毫秒始终是 UTC 毫秒，末尾的 +0800 这类偏移只是随行信息，
      // 不参与换算；按毫秒直接构造再以本地时区展示即可。
      date = new Date(Number(dotNetMatch[1]));
    } else {
      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) {
        date = new Date(parsed);
      }
    }
  }

  if (!date || Number.isNaN(date.getTime())) {
    return undefined;
  }

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} `
    + `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}
