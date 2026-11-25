import { BusinessRule, FormBusinessRules } from '../types';

export const BUSINESS_RULE_FILENAME = 'business-rule.md';

/**
 * 业务规则支持的高级函数及说明。
 * 与氚云设计器「函数列表 → 高级函数」一致。
 */
const FUNCTION_GUIDES: Array<[string, string]> = [
  ['INSERT', '向目标表单新增数据'],
  ['UPDATE', '更新目标表单中符合条件的数据'],
  ['UPSERT', '先查找目标表单数据，存在则更新，不存在则新增'],
  ['DELETE', '删除目标表单中符合条件的数据'],
  ['ADDFILE', '向目标表单附件控件添加文件（TRUE 覆盖写入，FALSE 追加写入）；目标表单只能是当前表单中关联表单控件对应的表单'],
  ['REMOVEFILE', '移除目标表单附件控件中与当前表单指定附件相同的文件；目标表单只能是当前表单中关联表单控件对应的表单']
];

/**
 * 渲染业务规则支持的函数说明。
 */
function renderFunctionGuide(): string[] {
  const lines: string[] = ['支持的函数：', ''];
  for (const [name, description] of FUNCTION_GUIDES) {
    lines.push(`- \`${name}\`：${description}`);
  }
  return lines;
}

/**
 * 渲染代码块。
 * 按代码中最长的连续反引号动态选择围栏长度,避免代码里出现 ``` 或 ```` 时提前截断。
 */
function renderCodeBlock(code: string): string[] {
  const backtickRuns: string[] = code.match(/`+/g) || [];
  const longestRun = backtickRuns
    .reduce((max, run) => Math.max(max, run.length), 0);
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  return [`${fence}text`, code, fence];
}

/**
 * 生成 business-rule.md 的文件头。
 * 与 automation.md 一致,不输出同步时间,避免每次同步都被记为已修改。
 */
function renderHeader(form: FormBusinessRules): string[] {
  return [
    `# 业务规则：${form.formName || '未命名表单'}`,
    '',
    `> 表单编码：\`${form.schemaCode}\`　规则数量：${form.rules.length}`,
    ''
  ];
}

/**
 * 渲染阅读约定。
 */
function renderReadingGuide(): string[] {
  return [
    '阅读约定：',
    '',
    '- 业务规则在【表单设置 → 业务规则】中配置，用于在数据生效/作废时对其它表单执行 INSERT、UPDATE、DELETE、UPSERT 等操作。',
    '- “数据生效时”对应表单数据提交或流程审批通过；“数据作废时”对应数据删除、作废或流程重新激活。',
    '- 数据生效时按本文件顺序从上到下执行；数据作废时从下到上执行。',
    '- 编辑并重新提交数据时，先执行数据作废（从下到上），再执行数据生效（从上到下）。',
    '- 每条规则同时给出氚云执行代码和设计器中的可读文本：代码使用 `{表单编码.字段编码}`，可读文本使用表单与字段名称，可互相对照。',
    '- 「规则编号」来自氚云接口，可能重复；执行顺序以本文件中的「第 N 条」为准。',
    '- 「规则状态」分为“已启用”和“已停用”；已停用的规则不会执行。',
    '- 可读文本中的字段名称取自本地 `fields.md`；如果显示为纯编码，请先对本应用执行一次“同步表单设计”。',
    '',
    '> 本文件由同步命令生成，手工修改会在下次同步时被整份覆盖；需要保留改动请另存副本或使用 Git 分支。'
  ];
}

/**
 * 把规则状态转换为可读文本。
 * 氚云接口中 0 表示已启用，3 表示已停用；生成文件时不直接输出数字。
 * 其他值保留原始值，便于排查未知状态。
 */
function formatRuleStatus(status: number): string {
  if (status === 0) {
    return '已启用';
  }
  if (status === 3) {
    return '已停用';
  }
  return `未知状态（${status}）`;
}

/**
 * 渲染单个阶段的规则内容。
 * @param title 阶段标题,如“数据生效时”
 * @param code 执行代码
 * @param text 可读文本
 * @param emptyHint 未配置时的提示
 */
function renderPhase(title: string, code: string, text: string, emptyHint: string): string[] {
  const lines: string[] = [`### ${title}`, ''];

  if (!code.trim()) {
    lines.push(emptyHint);
    return lines;
  }

  lines.push(...renderCodeBlock(code));

  if (text.trim()) {
    lines.push('');
    lines.push('可读文本：');
    lines.push('');
    // 多行文本用 <br> 保持在同一个段落里,避免第二行脱离段落或破坏文档结构。
    lines.push(text.replace(/\r\n|\r|\n/g, '<br>'));
  }

  return lines;
}

/**
 * 渲染单条业务规则。
 * @param rule 规则数据
 * @param index 从 1 开始的执行顺序
 */
function renderRule(rule: BusinessRule, index: number): string[] {
  const sections: string[][] = [];

  const head = [
    `## 第 ${index} 条规则`,
    '',
    `- 规则编号：${rule.ruleNo}`,
    `- 规则状态：${formatRuleStatus(rule.ruleStatus)}`
  ];

  // 备注紧跟在“规则状态”之后,不单独占用小节标题。
  const description = rule.description.trim();
  head.push(`- 备注：${description ? description.replace(/\r\n|\r|\n/g, '<br>') : '无'}`);

  sections.push(head);

  if (rule.ruleStatus === 3) {
    sections.push(['> 该规则已停用，数据生效/作废时都不会执行。']);
  }

  sections.push(renderPhase(
    '数据生效时',
    rule.submitCode,
    rule.submitText,
    '未配置（数据生效时不会执行这条规则）。'
  ));

  sections.push(renderPhase(
    '数据作废时',
    rule.rollbackCode,
    rule.rollbackText,
    '未配置（数据作废时不会回滚这条规则）。'
  ));

  const lines: string[] = [];
  sections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) {
      lines.push('');
    }
    lines.push(...section);
  });

  return lines;
}

/**
 * 生成表单对应的 business-rule.md 内容。
 * @param form 表单业务规则数据
 */
export function buildBusinessRuleMarkdown(form: FormBusinessRules): string {
  // 没有业务规则时只保留一个“无”字,不输出标题和解释。
  if (form.rules.length === 0) {
    return '无\n';
  }

  const lines = renderHeader(form);

  lines.push(...renderReadingGuide());
  lines.push('');
  lines.push(...renderFunctionGuide());
  lines.push('');

  form.rules.forEach((rule, index) => {
    lines.push(...renderRule(rule, index + 1));
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * 为没有业务规则的表单生成内容（只有“无”）。
 */
export function buildEmptyBusinessRuleMarkdown(formName: string, schemaCode: string): string {
  return buildBusinessRuleMarkdown({
    schemaCode,
    formName,
    rules: []
  });
}
