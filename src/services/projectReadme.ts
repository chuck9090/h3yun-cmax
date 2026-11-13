import * as path from 'path';
import { CmaxFormEntry, CmaxWorkspaceConfig } from '../types';
import { buildFolderName } from '../utils/folderUtils';
import { fileService } from './fileService';

export const PROJECT_README_FILENAME = 'README.md';

/**
 * 拼接表单在 README 中的展示行
 */
function renderFormLine(entry: CmaxFormEntry, suffix: string): string {
  const formName = entry.formName || '未命名表单';
  return `- 表单：${formName} —— 目录：\`${buildFolderName(formName, suffix)}\`，编码：\`${entry.formCode}\``;
}

/**
 * 输出单个应用的“应用-分组-表单”层级
 */
function renderAppStructure(
  appName: string,
  appSuffix: string,
  appCode: string,
  forms: Record<string, CmaxFormEntry>
): string[] {
  const displayName = appName || '未命名应用';
  const lines: string[] = [];
  lines.push(`### 应用：${displayName}`);
  lines.push('');
  lines.push(`- 应用目录：\`${buildFolderName(displayName, appSuffix)}\``);
  lines.push(`- 应用编码：\`${appCode}\``);
  lines.push('');

  const entries = Object.entries(forms || {});
  if (entries.length === 0) {
    lines.push('该应用下暂无表单。');
    lines.push('');
    return lines;
  }

  // 同一分组的表单归入同一个小节;小节顺序取该分组首次出现的位置,
  // 表单顺序保持 cmax.json(即氚云应用菜单)中的记录顺序。
  const sections: Array<{
    title: string;
    forms: Array<[string, CmaxFormEntry]>;
  }> = [];
  const sectionIndex = new Map<string, number>();

  for (const [suffix, entry] of entries) {
    const groupPath = entry.groupPath || [];
    const key = groupPath.join('\u0000');
    let index = sectionIndex.get(key);

    if (index === undefined) {
      index = sections.length;
      sectionIndex.set(key, index);
      sections.push({
        title: groupPath.length > 0
          ? `分组：${groupPath.join(' / ')}`
          : '顶层表单（未分组）',
        forms: []
      });
    }

    sections[index].forms.push([suffix, entry]);
  }

  for (const section of sections) {
    if (lines[lines.length - 1] !== '') {
      lines.push('');
    }
    lines.push(`#### ${section.title}`);
    lines.push('');
    for (const [suffix, entry] of section.forms) {
      lines.push(renderFormLine(entry, suffix));
    }
  }
  lines.push('');

  return lines;
}

/**
 * 生成“氚云代码”目录下 README.md 的内容
 */
export function buildProjectReadmeContent(config: CmaxWorkspaceConfig): string {
  const appEntries = Object.entries(config.apps || {});
  const lines: string[] = [];

  lines.push('# 氚云代码项目说明');
  lines.push('');
  lines.push('本目录由 H3Yun CMax 插件从氚云平台构建或同步生成，包含项目中所有氚云应用的字段表与前后端代码，可作为 Git 仓库和 AI 辅助开发的统一代码视图。');
  lines.push('本文件由插件自动生成，每次执行“从氚云构建项目”或“从氚云同步”后都会按最新结构重写，请勿手工修改。');
  lines.push('');

  lines.push('## 一、目录结构');
  lines.push('');
  lines.push('```text');
  lines.push('氚云代码/');
  lines.push('├── README.md                     # 本文件：项目结构说明（自动生成）');
  lines.push('├── cmax.json                     # 项目结构配置：应用、分组、表单与编码的对应关系');
  lines.push('├── .h3token                      # 本地氚云认证 Token（已被 .gitignore 忽略，不提交）');
  lines.push('├── .gitignore                    # 忽略 Token、失败报告和常见 AI 工具本地目录');
  lines.push('├── failed-nodes(应用名称).md     # 节点获取失败报告（仅在出现失败时生成）');
  lines.push('├── 应用名称(a1b2c3)/             # 一个氚云应用一个目录');
  lines.push('│   ├── 表单名称(f1a2b3)/         # 一个表单一个目录，直接平铺在应用目录下');
  lines.push('│   │   ├── fields.md             # 字段表');
  lines.push('│   │   ├── form-frontend.js      # 表单前端代码');
  lines.push('│   │   ├── form-backend.cs       # 表单后端代码');
  lines.push('│   │   ├── list-frontend.js      # 列表前端代码');
  lines.push('│   │   ├── list-backend.cs       # 列表后端代码');
  lines.push('│   │   └── automation.md         # 自动化配置（执行“同步自动化”后生成）');
  lines.push('│   └── ...');
  lines.push('└── ...');
  lines.push('```');
  lines.push('');
  lines.push('- 应用目录、表单目录名称后面的 `(a1b2c3)`、`(f1a2b3)` 是由氚云编码计算出的稳定后缀，用于避免同名目录冲突；完整对应关系记录在 `cmax.json` 中。');
  lines.push('- 本地目录只保留“应用 → 表单”两层：氚云系统中的“分组”不会生成文件夹，同一应用下的所有表单目录都直接放在应用目录下。');
  lines.push('- `automation.md` 只在执行“从氚云分项同步 → 同步自动化”后生成；一个表单的多个自动化都记录在同一个文件里，不会为每个自动化单独建文件。');
  lines.push('- 资源管理器按文件夹名称排序，与氚云系统中应用菜单的实际顺序不同。查找表单时，请以本文档“系统结构”章节或 `cmax.json` 中的记录顺序为准。');
  lines.push('');

  lines.push('## 二、核心文件说明');
  lines.push('');
  lines.push('### cmax.json');
  lines.push('');
  lines.push('插件自动生成的统一项目配置，记录所有应用、分组和表单的对应关系，供增量同步定位目录，也用于生成本文档。');
  lines.push('');
  lines.push('```json');
  lines.push('{');
  lines.push('  "version": 2,');
  lines.push('  "engineCode": "企业引擎编码",');
  lines.push('  "h3yunApiVersion": "new",');
  lines.push('  "systemUserId": "System 用户的 ObjectId",');
  lines.push('  "apps": {');
  lines.push('    "a1b2c3": {');
  lines.push('      "appCode": "应用编码",');
  lines.push('      "appName": "应用名称",');
  lines.push('      "lastSyncTime": "最后同步时间（ISO 格式）",');
  lines.push('      "forms": {');
  lines.push('        "f1a2b3": {');
  lines.push('          "formCode": "表单编码",');
  lines.push('          "formName": "表单名称",');
  lines.push('          "groupPath": ["分组名称"]');
  lines.push('        }');
  lines.push('      }');
  lines.push('    }');
  lines.push('  }');
  lines.push('}');
  lines.push('```');
  lines.push('');
  lines.push('- `version`：根配置格式版本，当前为 `2`。');
  lines.push('- `engineCode`：企业引擎编码，同一“氚云代码”目录下的所有应用共用。');
  lines.push('- `h3yunApiVersion`：氚云接口版本，`new` 为新版接口，`legacy` 为老版接口。');
  lines.push('- `systemUserId`：System 用户的 ObjectId，供 MCP 等工具执行 SQL 查询时使用。');
  lines.push('- `apps`：以应用目录后缀（如 `a1b2c3`）为 key 的应用配置映射。');
  lines.push('- `forms`：以表单目录后缀（如 `f1a2b3`）为 key 的表单配置映射；对象的书写顺序即氚云应用菜单中的表单顺序。');
  lines.push('- `groupPath`：表单在应用菜单中的分组路径；没有该字段表示表单直接位于应用顶层。');
  lines.push('');
  lines.push('`cmax.json` 不包含 Token，可以提交到 Git，供团队共享项目结构。修改目录或表单结构后，插件会在下次同步时自动更新。');
  lines.push('');
  lines.push('### .h3token');
  lines.push('');
  lines.push('保存当前氚云账号的 `h3_token`，构建和同步时用于调用氚云接口。');
  lines.push('');
  lines.push('- 以明文保存，已被 `.gitignore` 忽略，不要提交到公开仓库。');
  lines.push('- Token 有有效期，失效时插件会提示重新输入，并自动覆盖该文件。');
  lines.push('- 团队成员 clone 项目后，首次同步按提示输入自己的 Token 即可，无需共享 Token。');
  lines.push('');

  lines.push('## 三、系统结构（应用 → 分组 → 表单）');
  lines.push('');
  lines.push(`> 以下顺序与氚云应用菜单一致；表单条目中的“目录”即本地实际文件夹名称。共 ${appEntries.length} 个应用。`);
  lines.push('');
  if (appEntries.length === 0) {
    lines.push('当前项目中还没有应用。');
    lines.push('');
  } else {
    for (const [appSuffix, appConfig] of appEntries) {
      lines.push(...renderAppStructure(appConfig.appName, appSuffix, appConfig.appCode, appConfig.forms));
    }
  }

  lines.push('## 四、如何更新本目录');
  lines.push('');
  lines.push('- 更新单个应用：在资源管理器中右键点击应用目录，选择“从氚云同步”。');
  lines.push('- 只更新部分内容：右键点击应用目录，选择“从氚云分项同步”，可分别同步“表单设计”“代码”“自动化”。');
  lines.push('- 新增应用：按 `Ctrl+Shift+P` 打开命令面板，执行“从氚云构建项目”。');
  lines.push('- Token 失效：按提示重新输入 Token，或右键点击“氚云代码”目录，选择“更新氚云 Token”。');
  lines.push('');

  return lines.join('\n');
}

/**
 * 读取根 cmax.json 并生成“氚云代码”目录下的 README.md
 */
export function saveProjectReadme(codeFolderPath: string): void {
  try {
    const config = fileService.readWorkspaceConfig(codeFolderPath);
    const content = buildProjectReadmeContent(config);
    fileService.saveFile(path.join(codeFolderPath, PROJECT_README_FILENAME), content);
  } catch (error) {
    // README 只是辅助文档,生成失败不应影响构建或同步结果。
    console.warn('生成 README.md 失败:', error);
  }
}
