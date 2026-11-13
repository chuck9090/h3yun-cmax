import { Automation, AutomationAction, AutomationCondition, FormAutomations } from '../types';

export const AUTOMATION_FILENAME = 'automation.md';

/**
 * 把单个条件渲染成页面上的句式，如“数据状态 等于 已生效”。
 */
function formatCondition(item: AutomationCondition): string {
  return item.value
    ? `${item.propertyLabel} ${item.operatorLabel} ${item.value}`
    : `${item.propertyLabel} ${item.operatorLabel}`;
}

/**
 * 把条件组渲染成列表。
 * 只有一组时直接列出条件；多组时按组展开，避免把“或”和“且”混在一行里产生歧义。
 */
function renderConditionGroups(groups: AutomationCondition[][]): string[] {
  const lines: string[] = [];

  if (groups.length === 1) {
    for (const item of groups[0]) {
      lines.push(`- ${formatCondition(item)}`);
    }
    return lines;
  }

  groups.forEach((group, groupIndex) => {
    const text = group.map(formatCondition).join(' 且 ');
    lines.push(`- 条件组 ${groupIndex + 1}：${text}`);
  });

  return lines;
}

/**
 * 把条件组渲染成触发条件的一句话描述。
 * 单组时展开为“A 且 B”；多组时只说明组数与关系，具体条件交给分组列表，
 * 避免“A 或 B 且 C”这类需要读者自行判断优先级的写法。
 */
function renderTriggerCondition(groups: AutomationCondition[][]): string {
  if (groups.length === 0) {
    return '无（触发后直接执行）';
  }

  if (groups.length === 1) {
    return groups[0].map(formatCondition).join(' 且 ');
  }

  return `满足下列 ${groups.length} 组条件中的任意一组（组内条件需同时满足）`;
}

/**
 * 转义表格单元格内容。
 * 自动化里的固定值、公式、消息内容都可能包含 `|` 或换行，
 * 不转义会直接把 Markdown 表格打断，后续行退化成普通段落。
 */
function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r\n|\r|\n/g, '<br>');
}

/**
 * 转义列表项内容。
 * 多行内容（如消息正文）在列表项里需要用 <br> 换行，否则第二行会脱离列表。
 */
function escapeListItem(text: string): string {
  return text.replace(/\r\n|\r|\n/g, '<br>');
}

/**
 * 生成 automation.md 的文件头。
 * 不输出同步时间：该字段每次同步都会变化，会导致所有 automation.md 每次都被记为已修改，
 * Git 里全是无意义变更。同步时间统一以根 cmax.json 的 lastSyncTime 为准。
 */
function renderHeader(formName: string, schemaCode: string, count: number): string[] {
  const lines: string[] = [];
  lines.push(`# 自动化：${formName || '未命名表单'}`);
  lines.push('');
  lines.push(`> 表单编码：\`${schemaCode}\`　自动化数量：${count}`);
  lines.push('');
  return lines;
}
/**
 * 渲染阅读约定。
 * 只在该文件确实包含自动化时输出，空表单文件保持简短。
 * 开头不再补空行，由调用方保证与文件头之间已有一个空行。
 */
function renderReadingGuide(): string[] {
  return [
    '阅读约定：',
    '',
    '- “触发”是启动时机；“条件”是触发后仍需满足的筛选条件。',
    '- 多个条件组之间是“或”，同一组内的多个条件是“且”。',
    '- 字段用“名称（编码）”表示，括号内为氚云控件编码，与 `fields.md` 一致。',
    '- 执行动作按配置顺序编号（第 1 步、第 2 步…）；动作下挂的子动作编号为 `1.1`、`1.2`，标题层级表示从属关系。',
    '- 字段名称取自本地 `fields.md`。如果显示的是纯编码（如 `F0000012`），说明本地字段表还没有该字段，先对本应用执行一次“同步表单设计”。',
    '- 目标表单显示为编码时，说明该表单所在应用尚未在本地同步过；请对那个应用执行一次“从氚云同步”。',
    '',
    '> 本文件由同步命令生成，手工修改会在下次同步时被整份覆盖；需要保留改动请另存副本或使用 Git 分支。'
  ];
}

/**
 * 渲染“目标表单”一行。
 * 摘要里不再嵌表单名，改由这一行显式给出，跨应用引用时也更容易确认对象。
 */
function renderTargetLine(action: AutomationAction): string | undefined {
  const hasTarget = action.targetFormCode || action.targetFormName;
  if (!hasTarget && !action.targetChildSchemaCode) {
    return undefined;
  }

  const formName = action.targetFormName || action.targetFormCode || '';
  const formText = action.targetFormCode
    ? `${formName}（\`${action.targetFormCode}\`）`
    : formName;

  if (action.targetChildSchemaCode) {
    const childName = action.targetChildSchemaName || '未命名子表';
    return `- 目标表单：${formText} → 子表「${childName}」（\`${action.targetChildSchemaCode}\`）`;
  }

  return `- 目标表单：${formText}`;
}

/**
 * 渲染字段赋值表。
 * 返回段落内容,末尾不带空行,由调用方统一处理段落间距。
 */
function renderMappingTable(title: string, mappings: AutomationAction['updateMappings']): string[] {
  const lines: string[] = [];
  lines.push(`${title}：`);
  lines.push('');
  lines.push('| 目标字段 | 赋值方式 | 取值 |');
  lines.push('| --- | --- | --- |');

  for (const mapping of mappings) {
    // 源字段与目标字段相同时直接标注,避免左右两列重复同一串文本
    const sameField = mapping.source === `${mapping.targetLabel}（${mapping.targetField}）`;
    const value = sameField ? '同名字段' : mapping.source;
    lines.push(
      `| ${escapeCell(mapping.targetLabel)}（\`${mapping.targetField}\`）`
      + ` | ${escapeCell(mapping.sourceType)} | ${escapeCell(value)} |`
    );
  }

  return lines;
}

/**
 * 渲染单个执行动作。
 * 用“段落”组织内容：每个段落内部不留多余空行,段落之间统一用一个空行分隔。
 * @param depth 0 表示顶层动作（渲染为 ####）,每层子动作多一级标题
 */
function renderAction(action: AutomationAction, index: string, depth: number): string[] {
  const chunks: string[][] = [];
  // 深度超过 3 层后标题层级已到底,改用加粗表示,避免全部塌成 ######
  const heading = depth < 3
    ? `${'#'.repeat(depth + 4)} 第 ${index} 步：${action.type}`
    : `**第 ${index} 步：${action.type}**`;

  const head: string[] = [heading];

  // 摘要与动作名称重复时不再单独占一行,减少噪声
  if (action.summary && action.summary !== action.type) {
    head.push('', `> ${action.summary}`);
  }
  chunks.push(head);

  const propertyLines: string[] = [];
  const targetLine = renderTargetLine(action);
  if (targetLine) {
    propertyLines.push(targetLine);
  }
  if (action.dataSource) {
    propertyLines.push(`- 数据来源：${escapeListItem(action.dataSource)}`);
  }
  for (const [label, value] of action.details) {
    propertyLines.push(`- ${label}：${escapeListItem(value)}`);
  }
  if (propertyLines.length > 0) {
    chunks.push(propertyLines);
  }

  if (action.parentConditions.length > 0) {
    chunks.push(['主表筛选条件：', '', ...renderConditionGroups(action.parentConditions)]);
  }

  if (action.childConditions.length > 0) {
    chunks.push(['子表筛选条件：', '', ...renderConditionGroups(action.childConditions)]);
  }

  if (action.updateMappings.length > 0) {
    chunks.push(renderMappingTable('更新时赋值', action.updateMappings));
  }

  if (action.insertMappings.length > 0) {
    chunks.push(renderMappingTable('新增时赋值', action.insertMappings));
  }

  if (chunks.length === 1 && action.children.length === 0) {
    chunks.push(['- 无额外配置']);
  }

  const lines: string[] = [];
  // 统一空行：只在上一行不是空行时补一个,避免出现连续空行
  const pushBlankLine = (): void => {
    if (lines.length > 0 && lines[lines.length - 1] !== '') {
      lines.push('');
    }
  };

  chunks.forEach((chunk, chunkIndex) => {
    if (chunkIndex > 0) {
      pushBlankLine();
    }
    lines.push(...chunk);
  });

  let childIndex = 1;
  for (const child of action.children) {
    pushBlankLine();
    lines.push(...renderAction(child, `${index}.${childIndex}`, depth + 1));
    childIndex++;
  }

  pushBlankLine();
  return lines;
}

/**
 * 渲染单个自动化。
 */
function renderAutomation(automation: Automation, index: number): string[] {
  const lines: string[] = [];
  const name = automation.displayName || `未命名自动化 ${index}`;

  lines.push(`## ${index}. ${name}`);
  lines.push('');
  lines.push(`- 状态：${automation.enabled ? '启用' : '停用'}`);
  lines.push(`- 触发：${automation.triggerType}${automation.triggerDescription ? `（${automation.triggerDescription}）` : ''}`);

  if (automation.schedule) {
    lines.push(`- 重复周期：${automation.schedule}`);
  }

  if (automation.updatedFields.length > 0) {
    lines.push(`- 变更字段：${automation.updatedFields.join('、')}`);
  }

  lines.push(`- 条件：${renderTriggerCondition(automation.conditionGroups)}`);

  // 多组条件时展开成列表，避免与上面那行重复表达同一信息
  if (automation.conditionGroups.length > 1) {
    lines.push('');
    lines.push(...renderConditionGroups(automation.conditionGroups));
  }

  if (automation.modifiedName || automation.modifiedTime) {
    lines.push('');
    const parts: string[] = [];
    if (automation.modifiedName) parts.push(`修改人：${automation.modifiedName}`);
    if (automation.modifiedTime) parts.push(`修改时间：${automation.modifiedTime}`);
    lines.push(`> ${parts.join('　')}`);
  }

  lines.push('');

  if (automation.actions.length === 0) {
    lines.push('### 执行动作');
    lines.push('');
    lines.push('- 未配置执行动作');
    lines.push('');
  } else {
    lines.push('### 执行动作');
    lines.push('');
    automation.actions.forEach((action, actionIndex) => {
      lines.push(...renderAction(action, `${actionIndex + 1}`, 0));
    });
  }

  return lines;
}

/**
 * 生成表单对应的 automation.md 内容。
 * @param form 表单自动化数据
 */
export function buildAutomationMarkdown(form: FormAutomations): string {
  const lines = renderHeader(form.formName, form.schemaCode, form.automations.length);

  if (form.automations.length === 0) {
    lines.push('该表单当前没有配置自动化。');
    lines.push('');
    lines.push('> 如果氚云设计器里确实配置了自动化，说明本地尚未同步到；请先执行一次“同步自动化”。');
    lines.push('');
    return lines.join('\n');
  }

  lines.push(...renderReadingGuide());

  form.automations.forEach((automation, index) => {
    lines.push(...renderAutomation(automation, index + 1));
  });

  return lines.join('\n');
}

/**
 * 为没有自动化的表单生成提示内容。
 * 保留该入口以兼容既有调用方，内部复用统一的生成逻辑。
 */
export function buildEmptyAutomationMarkdown(formName: string, schemaCode: string): string {
  return buildAutomationMarkdown({
    schemaCode,
    formName,
    automations: []
  });
}
