# H3Yun CMax 开发手册

本文档面向插件维护者和二次开发者，用于说明项目目录结构、核心流程和关键代码文件职责。本文档仅用于开发协作，不需要随 VSIX 插件包发布。

## 项目概览

H3Yun CMax 是一个 VSCode 插件，用于从氚云平台拉取应用、表单、字段和自定义代码到本地目录，并提供后续同步、冲突处理和 Git 初始化提交能力。

插件主要提供以下命令：

- `h3yun-cmax.buildProject`：从氚云构建本地项目。
- `h3yun-cmax.syncProject`：从氚云同步已有本地项目，同步表单设计与代码。
- `h3yun-cmax.syncFormDesign`：分项同步，仅同步表单设计（`fields.md`）。
- `h3yun-cmax.syncCode`：分项同步，仅同步表单与列表的前后端代码。
- `h3yun-cmax.syncAutomation`：分项同步，仅同步自动化配置（`automation.md`）。
- `h3yun-cmax.updateProjectToken`：更新“氚云代码”目录共用的 Token。
- `h3yun-cmax.queryFormName`：根据表单或子表编码查询所属表单名称。

其中 `h3yun-cmax.syncFormDesign`、`h3yun-cmax.syncCode`、`h3yun-cmax.syncAutomation` 三项通过 `contributes.submenus` 组合为“从氚云分项同步”子菜单，在资源管理器选中文件夹时可用（右键菜单与命令面板均会显示）。

运行入口由 `package.json` 指向编译后的 `dist/extension.js`。源码位于 `src/`，通过 Webpack 打包到 `dist/`。

## 目录结构

```text
h3yun-cmax/
├── assets/                 # Webview 使用的静态资源
├── default-code/           # 氚云未配置代码时使用的默认代码模板
├── dist/                   # Webpack 编译输出目录，VSCode 实际加载这里的 extension.js
├── src/                    # 插件 TypeScript 源码
│   ├── commands/           # VSCode 命令处理逻辑
│   ├── parsers/            # 氚云接口响应解析逻辑
│   ├── services/           # 文件、API、Git 等服务封装
│   ├── types/              # 项目共享类型定义
│   ├── ui/                 # Webview、冲突弹窗、差异预览等 UI 逻辑
│   └── utils/              # 通用工具函数
├── .vscodeignore           # VSIX 打包排除规则
├── package.json            # 插件清单、命令贡献点和 npm 脚本
├── tsconfig.json           # TypeScript 配置
└── webpack.config.js       # Webpack 打包配置
```

## 核心运行流程

### 插件激活

入口文件：`src/extension.ts`

职责：

- 注册 `从氚云构建项目` 命令。
- 注册 `从氚云同步` 命令。
- 注册 `从氚云分项同步` 子菜单下的 `同步表单设计`、`同步代码`、`同步自动化` 命令,分别以 `formDesign`、`code`、`automation` 范围调用同一个同步处理器。
- 将命令订阅加入 VSCode 扩展上下文。
- 捕获命令执行异常并通过 VSCode 消息提示用户。

### 从氚云构建项目

主文件：`src/commands/buildProject.ts`

核心流程：

1. 获取当前 VSCode 工作区根目录。
2. 打开构建表单，让用户输入应用编码、企业引擎编码 `enginecode` 和 `h3_token`。
3. 调用氚云接口获取应用信息。
4. 在工作区下创建“氚云代码”目录，并在其下创建应用文件夹。应用后缀为 `a` 加应用编码 MD5 前 6 位,冲突时逐步增加 MD5 前缀长度。
5. 获取应用下的表单列表。
6. 为每个表单创建表单文件夹。表单后缀为 `f` 加表单编码 MD5 前 6 位,冲突时逐步增加 MD5 前缀长度。
7. 拉取表单字段、表单前端、表单后端、列表前端、列表后端代码。
8. 更新“氚云代码”目录下统一的 `cmax.json`,写入根级共享的 `engineCode`、接口版本和 `systemUserId`,以及当前应用的应用编码和表单映射。表单映射按氚云应用菜单顺序写入,并记录表单所属分组 `groupPath`。
9. 保存统一的 `.h3token` 到“氚云代码”目录。
10. 在“氚云代码”目录创建或更新 `.gitignore`，避免提交 Token 和常见 AI 工具缓存目录。
11. 在“氚云代码”根目录保存节点获取失败报告 `failed-nodes(应用名称).md`。
12. 根据最新 `cmax.json` 重写“氚云代码”根目录的 `README.md`,按“应用 → 分组 → 表单”展示项目结构。
13. 询问用户是否提交本次添加应用的构建文件;如果尚未初始化 Git,提交时由工具在后台自动初始化,不在弹窗中单独提示。

构建命令如果发现当前工作区就是“氚云代码”目录,会从根 `cmax.json` 和 `.h3token` 预填根级共享的企业引擎编码与 Token。一个“氚云代码”工作区只使用一个根级企业引擎编码。Token 保持可编辑;Token 验证失败时构建表单不关闭,用户可替换 Token 后重试。`systemUserId` 仅在根配置首次缺失时查询,后续新增应用和同步直接复用根级值。

构建命令是本插件最重要的入口之一。涉及文件夹创建、API 调用、代码写入、配置生成和 Git 初始化。

### 从氚云同步项目

主文件：`src/commands/syncProject.ts`

`handleSyncProject(uri?, scope)` 的 `scope` 参数控制本次同步范围：`all`（默认，表单设计与代码）、`formDesign`（仅 `fields.md`）、`code`（仅 4 个前后端代码文件）、`automation`（仅 `automation.md`）。右键菜单“从氚云同步”传默认值，“从氚云分项同步”下的子项分别传 `formDesign`、`code`、`automation`；前三种范围共用同一套流程，只在拉取和写入文件时按范围过滤，范围外的本地文件不会被读取或覆盖。

`automation` 范围在主流程前置步骤之后、`getForms()` **之前**插入一个独立分支并直接返回。原因：

- 写 `automation.md` 用不到表单列表和表单结构；`getForms()` 会为应用下每个表单各发一次 LoadForm 请求（并发 `FORM_REQUEST_CONCURRENCY = 10`），表单多的应用会瞬间产生几十个并发请求。
- 自动化数据由 `LoadTriggersByAppCode` 一次返回整个应用，因此同步自动化除了前置的应用信息请求外不再发其他请求，**完全不发 LoadForm**。

改动这一部分时不要把 automation 分支移回 `getForms()` 之后，否则同步自动化会重新产生大量无谓的并发请求。

范围还决定是否处理“应用下表单增减”（`handlesStructure = scope !== 'code' && scope !== 'automation'`）：

- `all`、`formDesign`：按最新表单列表新建表单目录、重命名改名表单目录、清理已删除表单目录，并把最新表单列表写回 `cmax.json`。
- `code`、`automation`：只处理本地已有表单目录。氚云侧新增的表单、以及 `cmax.json` 有记录但本地目录已不存在的表单都跳过并计入“跳过”数量；不重命名、不删除任何目录。

`automation` 范围在该分支内拉取应用下全部自动化后，直接按表单写入 `automation.md`，不涉及字段表与代码的拉取和冲突检测。

核心流程：

1. 从右键菜单传入的文件夹或当前编辑器推断应用目录。
2. 检查“氚云代码”目录下是否存在根 `cmax.json`,并从应用目录后缀定位当前应用配置。
3. 读取根 `cmax.json` 中的共享配置和当前应用配置,并根据根级 `h3yunApiVersion` 选择氚云接口版本。
4. 根级 `engineCode` 缺失时提示用户补充并写回根 `cmax.json`;Token 缺失或失效时提示用户重新输入。
5. 拉取氚云最新应用名和表单列表（`automation` 范围跳过表单列表）。表单列表来自一次 `children` 接口调用,按节点之间的 `parentCode` 关系还原菜单树,再按接口返回顺序深度优先展开,每条表单记录其 `groupPath`。
6. 同步应用文件夹名；处理结构的范围还会同步表单文件夹名。
7. 按 `scope` 获取远端表单设计或代码（`getFormCodes`），不请求范围外的接口；返回值按固定键顺序构造。
8. 检测本次范围内本地文件与远端文件是否存在差异。
9. 出现冲突时提供批量处理或差异预览。
10. 写入用户确认后的远端内容。
11. 处理结构的范围会清理已删除表单目录，并更新根 `cmax.json` 中当前应用的同步时间和表单结构；`code` 范围只刷新同步时间，表单映射保持原样。
12. 保存节点获取失败报告。
13. 根据最新 `cmax.json` 重写“氚云代码”根目录的 `README.md`。
14. 仅当当前应用目录存在代码变更时,询问用户是否自动提交本次同步变更。根 `cmax.json` 的变化不触发提交询问,但提交应用代码时会随配置和 `README.md` 一起暂存。

同步命令需要特别注意本地修改保护，不能无提示覆盖用户本地编辑。

## 关键代码文件说明

### `src/services/fileService.ts`

文件管理服务，负责本地项目文件和配置文件读写。

主要职责：

- 创建应用文件夹和表单文件夹。
- 保存表单代码文件。
- 创建和读取“氚云代码”目录下的统一 `cmax.json`。
- 保存和读取 `.h3token`。
- 在“氚云代码”目录保存和读取统一 `.h3token`。
- 在“氚云代码”目录创建或更新 `.gitignore`。
- 在“氚云代码”根目录保存 `failed-nodes(应用名称).md` 失败报告。
- 使用既有后缀重命名应用和表单文件夹。

重要常量：

```ts
const CMAX_CONFIG_FILENAME = 'cmax.json';
const H3_TOKEN_FILENAME = '.h3token';
const GITIGNORE_FILENAME = '.gitignore';
const FAILED_NODES_REPORT_FILENAME = 'failed-nodes.md';
const GITIGNORE_ENTRIES = [
  H3_TOKEN_FILENAME,
  '.opencode/',
  '.lingma/',
  '.cursor/',
  '.windsurf/',
  '.continue/',
  '.claude/',
  '.gemini/',
  '.codex/',
  '.qwen/',
  '.qoder/',
  '.trae/',
  '.roo/',
  '.cline/',
  '.kilocode/',
  '.augment/',
  '.tabnine/',
  '.codegraph/'
];
```

后续如果需要新增默认忽略项，只需要维护 `GITIGNORE_ENTRIES`。

### 氚云接口版本分层

为兼容氚云平台接口新旧版本差异,项目在根 `cmax.json` 中维护所有应用共用的接口版本:

```json
{
  "h3yunApiVersion": "new"
}
```

取值说明:

- `new`：新版本接口,也是默认值。
- `legacy`：老版本接口。

使用规则:

- 新建工作区时默认写入 `"h3yunApiVersion": "new"`。
- 已有根级配置时,新增应用和同步均保留当前配置值,不会覆盖用户手动改成的 `new`。
- 旧版 `cmax.json` 若缺少 `h3yunApiVersion` 字段,按默认值 `new` 处理,并在下次写回时补全。
- 旧项目需要使用新版工具重新构建项目结构,不会读取旧应用目录中的配置。

相关文件:

- `src/types/index.ts`：定义 `H3YunApiVersion` 和 `CmaxWorkspaceConfig.h3yunApiVersion`。
- `src/services/fileService.ts`：创建、读取和写回 `cmax.json` 时处理接口版本默认值和保留逻辑。
- `src/commands/buildProject.ts`：新建工作区时默认使用 `new`,已有工作区时复用根级配置。
- `src/commands/syncProject.ts`：同步时按根级 `cmax.json` 中的 `h3yunApiVersion` 设置接口版本。
- `src/ui/buildProjectForm.ts`：构建或重新输入 Token 时,使用当前流程指定的接口版本进行验证。

### `src/services/h3yunApi.ts`

氚云接口统一入口,负责按当前接口版本分发到具体实现。

主要职责:

- 维护当前接口版本,缺省为 `new`。
- 对外保持原有 `h3yunApi` 单例入口,避免命令层大面积修改 import。
- 调用 `setApiVersion()` 后,后续应用、表单、代码等请求会分发到对应版本实现。
- 调用 `setToken()` 时同时同步到新旧两个实现,保证切换版本后认证信息可用。

调用关系:

```text
commands/ui
  ↓
src/services/h3yunApi.ts
  ├── legacy → src/services/h3yunApiLegacy.ts
  └── new    → src/services/h3yunApiNew.ts
```

### `src/services/h3yunApiLegacy.ts`

氚云老版本接口服务,由原 `h3yunApi.ts` 迁移而来,负责和老版本氚云接口交互。

主要职责：

- 设置和缓存全局 Token 与 `enginecode`,并在请求 Headers 中携带二者。
- 获取应用信息。
- 获取应用下的功能节点和表单列表,应用菜单只调用一次 `children` 接口,按节点间的 `parentCode` 关系识别分组节点并还原菜单树,再按接口返回顺序深度优先展开,得到与氚云应用菜单一致的表单顺序和分组路径。
- 判断功能节点是否是表单。
- 获取字段设计数据。
- 获取表单自定义代码。
- 获取列表设计器代码。
- 按同步范围获取内容: `getFormCodes(formCode, scope)` 只请求范围内需要的接口,`getFormAllCodes()` 等价于 `scope = 'all'`。
- 获取应用下全部自动化: `getAutomations(appCode, fieldLabelIndex)` 调用 `/Automatic/OnAction` 的 `LoadTriggersByAppCode`,一次取回该应用下所有表单的自动化。
- 在远端代码为空时使用 `default-code/` 中的默认模板。
- 记录部分节点请求失败信息，供构建或同步后生成报告。

此文件聚合了多个 parser 的解析结果,是老版本氚云 API 调用的主要实现。

### `src/services/h3yunApiNew.ts`

氚云新版本接口服务。

当前该文件先继承 `H3YunLegacyApiService`,保持行为一致。后续确认新版本接口差异后,只需要在 `H3YunNewApiService` 中覆盖对应方法,不要把新版本判断散落到命令层或 parser 外层。

### `src/services/automationReport.ts`

`automation.md` 生成器，负责把解析后的自动化数据渲染成便于人工和 AI 阅读的 Markdown。

主要职责：

- 一个表单生成一份 `automation.md`，该表单下的多个自动化都写在同一个文件里，避免表单目录下文件过多。
- 文件头输出表单名称、编码、自动化数量、同步时间和阅读约定。
- 每个自动化输出名称、启用状态、触发事件与说明、重复周期（定时触发）、变更字段（更新触发）、触发条件。
- 执行动作按设计器语义呈现：先给一句摘要（如“在【X】中查找符合条件的数据并更新”），再列具体配置。
- 分开输出“主表筛选条件 / 子表筛选条件”和“更新时赋值 / 新增时赋值”，与设计器的两个独立区域对应。
- 标注动作间的“节点数据”引用，如“第 1 步「查找数据」的结果”，还原自动化的数据流。
- 子表动作以 `1.1`、`1.2` 的编号挂在父动作下，体现父子关系。
- 没有自动化的表单也会生成一份“该表单当前没有配置自动化”的说明，避免残留旧内容。

### `src/services/fieldLabelService.ts`

字段名称索引服务，用于把氚云控件编码翻译成可读名称。

主要职责：

- 解析 `fields.md` 的表格，得到“字段编码 → 字段名称”映射，同时解析子表章节（`## 子表名称` + `子表编码：xxx`），记录子表名称。
- 扫描整个“氚云代码”目录下所有应用的 `fields.md` 与 `cmax.json`，构建全局索引：字段名称、子表名称、表单名称。自动化可以跨应用引用其他表单的字段和目标表单，因此不能只扫描当前应用。
- 维护“表单编码 → 子表编码列表”关系，供字段编码不带前缀时回退查找。
- 同一编码来自多个表单时（复制应用共用子表编码），合并时以先写入的为准并补充缺失项，避免互相覆盖。

字段名称只是展示层优化：查不到时回退显示字段编码，不影响同步结果。

### `src/services/projectReadme.ts`

“氚云代码”根目录 `README.md` 生成器。

主要职责：

- 读取根 `cmax.json`,按应用、分组、表单三级生成项目结构说明。
- 说明本地目录结构、`cmax.json`、`.h3token` 等核心文件的用途。
- 按 `cmax.json` 中记录的顺序展示表单,弥补本地目录按名称排序、且不体现分组层级的问题。
- 构建和同步完成后调用,重写 `README.md`。

### `src/services/gitService.ts`

Git 操作服务，当前封装了初始化和提交逻辑。

主要职责：

- 执行 `git init`。
- 按应用目录范围执行 `git add`，并同步纳入仓库级 `.gitignore`。
- 执行 `git commit -m <message>`。
- 捕获 Git 命令错误并返回可读错误信息。

当前实现使用 `execFile`，避免拼接 shell 命令带来的转义问题。由于根 `cmax.json` 由所有应用共享,同步某个应用时会同时暂存根配置文件,但不会暂存其他应用目录的代码。

### `src/ui/buildProjectForm.ts`

构建项目输入表单 Webview。

主要职责：

- 展示应用编码、`enginecode` 和 Token 输入界面。
- 读取 `assets/token-guide.html` 作为 Token 获取说明。
- 校验用户输入是否为空。
- 调用氚云接口验证 `enginecode`、Token 和应用编码。
- 将校验通过的输入返回给构建命令。

### `src/ui/conflictDialog.ts`

同步冲突批量处理弹窗。

主要职责：

- 展示冲突文件列表。
- 让用户选择批量使用本地、批量使用远端或逐个处理。
- 为同步流程提供冲突处理决策。

### `src/ui/diffPreview.ts`

文件差异预览界面。

主要职责：

- 展示本地内容和远端内容的差异。
- 让用户选择使用本地版本、使用远端版本或跳过。
- 避免同步过程直接覆盖用户本地修改。

### `src/utils/diffUtils.ts`

差异检测工具。

主要职责：

- 判断本地文件和远端内容是否存在差异。
- 生成用于展示的差异报告。

### `src/utils/folderUtils.ts`

文件夹命名工具。

主要职责：

- 判断文件夹是否存在。
- 创建文件夹。
- 根据应用或表单编码生成稳定后缀,并在冲突时增加 MD5 前缀长度。
- 拼接包含后缀的文件夹名。

应用和表单文件夹分别使用 `a`、`f` 类型前缀加编码 MD5 前缀生成稳定后缀。默认哈希部分为 6 位,发生冲突时逐步增加长度,并通过 `cmax.json` 维护后缀和氚云编码之间的映射关系。已有配置中的旧后缀继续保留。

### `src/utils/httpUtils.ts`

HTTP 请求工具。

主要职责：

- 封装 GET 请求。
- 封装 POST 请求。
- 解析 JSON 响应。

### `src/types/index.ts`

共享类型定义。

主要类型：

- `H3Application`：氚云应用信息。
- `H3Form`：氚云表单信息。
- `H3FormField`：表单字段信息。
- `CmaxConfig`：根 `cmax.json` 中的应用配置结构。
- `CmaxWorkspaceConfig`：根 `cmax.json` 的统一工作区配置结构。
- `CmaxFormEntry`：表单配置条目,包含表单编码、名称和可选的分组路径 `groupPath`。
- `FileContentMap`：一个表单下各代码文件的内容映射。
- `SyncScope`：同步范围,取值为 `all`、`formDesign`、`code`、`automation`,用于分项同步时限定拉取与写入的文件。
- `Automation`、`AutomationAction`、`AutomationCondition`、`AutomationFieldMapping`、`FormAutomations`：自动化配置的解析结果结构,字段含义见各类型注释。

### `src/parsers/`

解析氚云接口响应的目录。各 parser 尽量只负责响应结构解析和数据清洗，不直接进行文件写入或 UI 操作。

主要文件：

- `appListParser.ts`：解析应用列表响应，并根据应用编码找到目标应用。
- `functionNodeChildrenParser.ts`：解析功能节点子节点响应。
- `functionNodeTypes.ts`：定义功能节点相关类型。
- `sheetDesignerParser.ts`：解析表单设计器响应，判断节点是否包含表单结构，并提取字段信息。
- `customCodeParser.ts`：解析表单自定义代码响应。
- `listViewDesignerParser.ts`：解析列表设计器代码响应。
- `automationParser.ts`：解析自动化列表响应，把触发类型、条件、执行动作翻译成可读结构，并解析字段赋值与消息内容中的字段占位符。

### `default-code/`

默认代码模板目录。

当氚云远端某类代码为空时，`h3yunApi.ts` 会读取这里的模板作为本地生成文件内容。

文件说明：

- `form-frontend.js`：表单前端默认代码。
- `form-backend.cs`：表单后端默认代码。
- `list-frontend.js`：列表前端默认代码。
- `list-backend.cs`：列表后端默认代码。

后端模板中可使用 `{SchemaCode}` 占位符，生成时会替换为表单编码。

## 本地生成的氚云项目结构

用户执行构建后，插件会在当前工作区下创建“氚云代码”目录，并在其下创建应用目录。典型结构如下：

```text
氚云代码/
├── README.md                    # 自动生成的项目结构说明
├── .gitignore
├── .h3token
├── cmax.json
├── failed-nodes(应用名称).md
├── 应用名称(a1a2b3c)/
│   ├── 表单A(f1a2b3c)/
│   │   ├── fields.md
│   │   ├── form-frontend.js
│   │   ├── form-backend.cs
│   │   ├── list-frontend.js
│   │   ├── list-backend.cs
│   │   └── automation.md
│   └── 表单B(f4d5e6f)/
│       ├── fields.md
│       ├── form-frontend.js
│       ├── form-backend.cs
│       ├── list-frontend.js
│       ├── list-backend.cs
│       └── automation.md
└── 其他应用/
```

说明：

- 应用目录后缀默认形如 `a1a2b3c`,由 `a` 加应用编码 MD5 的前 6 位组成。
- 表单目录后缀默认形如 `f1a2b3c`,由 `f` 加表单编码 MD5 的前 6 位组成。
- 发生冲突时依次使用 MD5 前 7 位、前 8 位等更长前缀,直到生成唯一后缀。
- 根目录 `cmax.json` 按 `version`、`engineCode`、`h3yunApiVersion`、`systemUserId`、`apps` 顺序记录配置;其中 `apps` 的 key 即应用目录后缀,应用对象记录应用编码、应用名称、表单编码、表单名称和同步时间,不再重复保存 `appSuffix`。应用目录下不再保存独立的 `cmax.json`。
- 表单条目可带 `groupPath` 数组,记录该表单在氚云应用菜单中的分组路径;没有该字段表示表单直接位于应用顶层。`forms` 中条目的书写顺序即氚云应用菜单顺序。
- 本地目录只保留“应用 → 表单”两层,氚云分组不生成目录;根目录 `README.md` 负责呈现完整的三级结构。
- `automation.md` 只在执行“同步自动化”后生成,一个表单的多个自动化记录在同一个文件里,不按自动化数量拆分文件。
- 根目录 `README.md` 由 `projectReadme.ts` 自动生成,构建或同步后重写,并随应用代码一起提交 Git。
- “氚云代码”目录下的 `.h3token` 保存本地 Token，不应提交到 Git。
- “氚云代码”目录下的 `.gitignore` 由插件自动创建或更新。
- `failed-nodes(应用名称).md` 记录本次构建或同步中无法读取的节点,并由根目录 `.gitignore` 中的 `failed-nodes*.md` 忽略。
- 报表等 `LoadForm` 响应不包含有效表单结构的非表单节点会直接跳过,不会写入失败报告。

## 自动化配置的接口与数据结构

自动化同步使用氚云设计器接口：

```text
POST /Automatic/OnAction
Content-Type: application/x-www-form-urlencoded
Body: PostData={"ActionName":"LoadTriggersByAppCode","AppCode":"<应用编码>"}
```

该接口一次返回整个应用下的自动化，按表单分组：

```text
ReturnData.Triggers[]           每个元素是一个表单
  ├── SchemaCode                表单编码
  ├── SchemaDisplayName         表单名称
  └── TriggerModels[]           该表单下的自动化
        ├── ObjectId
        ├── DisplayName         自动化名称
        ├── State               是否启用
        ├── ExcuteType          触发类型
        ├── Condition           触发条件
        ├── Action[]            执行动作
        └── ModifiedTime
```

解析时需要注意的几处结构：

- `ExcuteType`：`111` 数据生效时、`112` 数据更新时、`113` 数据失效时、`114` 数据生效或更新时、`100` 定时触发、`401` 自定义触发、`60` 日期字段触发、`10` 数据发生变化时。
- `Condition.Expression`：二维数组，外层是条件组、内层是条件，**组间为“或”、组内为“且”**。条件节点字段为 `PropertyName`、`Operator`、`ValueType`、`Value`。
- `Condition.Schedule.Value`：定时触发配置，`Frequency`（0 仅一次、1 每天、2 每周、3 每月、4 每年、5 自定义）、`Repeat`（每周为星期 1-7，每月为日期、`-1` 表示最后一天）、`Time`、`TriggerEndTime`、`SkipHolidays`。
- `Condition.UpdatedFiled.Value`：数据更新时触发的限定字段列表，元素可能是字段编码、子表编码或“子表编码.字段编码”。
- `Action[].PluginCode`：`insertdata` 新增数据、`updatedata` 更新数据、`removedata` 删除数据、`querydata` 查找数据、`notification` 发送消息通知、`robotnotification` 钉钉群消息、`sms`、`email` 等。
- 目标表单的取法**按动作类型不同而不同**：
  - `querydata`：`RequestMapping.TargetSchemaConfigs[0].TargetSchemaCode`，其 `TargetChildSchemaCode` 与主表编码不同时表示针对子表。
  - 其余数据类动作：`RequestMapping.TargetSchemaValue`，形如 `[应用编码, 目标表单编码, 目标子表或主表编码]`。
  - **`Action.SchemaCode` 是动作所在（源）表单，不是目标表单**。用错会导致不同表单的相同字段编码张冠李戴。
- 字段赋值：新增用 `InsertFieldMappings`、更新用 `UpdateFieldMappings`，两者对应设计器中两个独立页签，**不可合并**。元素为 `{ TargetField, ValueSetType, SourceType, SourceField }`，其中 `SourceType` 才是取值方式：`1` 字段、`2` 公式计算、`3` 固定值。
- 字段引用格式：`表单编码@序号.字段编码`，子表引用会出现多级形式 `表单编码@1.子表编码@1.字段编码`，统一取最后两段（所属编码、字段编码）解析。
- 动作筛选条件分三处：子表动作用 `RequestMapping.ChildCondition`，主表动作用 `RequestMapping.ParentCondition`，查找动作用 `RequestMapping.Condition.Expression`，结构与触发条件相同。
- **节点数据引用**：某动作的 `SourceId` 指向同一自动化中前面某个动作的 `ObjectId` 时，表示使用该动作的结果（设计器中的“可使用的查找数据的执行节点数据”）。这是自动化的数据流，必须还原，否则看不出数据从哪来。
- `RequestMapping.State`：**新增数据方式**，`0` 暂存草稿、`1` 新增生效数据、`2` 发起流程。该值由用户在动作的齿轮菜单中显式选择，属于真实配置；但它只对“新增”分支有意义，因此只在新增数据动作、或更新动作开启了“无可更新数据时新增”时才需要输出。
- `RequestMapping.IsInsert`：更新数据时“无可更新数据时新增”，开启后才有上面的新增分支。
- `Action.DataSetType`：取数数据集版本（`1` 最新数据、`2` 变更前数据 …）。实测**完全由触发类型推导**（`113` 数据失效时为 `2`，其余为 `1`），页面上没有对应配置项，因此不输出，避免把推导值当成用户配置。
- `RequestMapping.SortBys`、`Limit`、`IgnoreOverLimit`：查找结果的排序、数量上限，以及超限时是取前 N 条继续还是停止。
- 消息通知的 `Title`、`Content`、`Receivers` 中会内嵌 `{表单编码@1.字段编码}` 占位符，需要替换成字段名称才可读。
- 子动作在 `Action[].ChildrenTriggerAction`，与父动作结构相同，需要递归解析。

## 打包与发布

常用脚本定义在 `package.json`：

```bash
npm run compile
npm run watch
npm run package
npm run lint
```

脚本说明：

- `npm run compile`：使用 Webpack 生产模式编译插件。
- `npm run watch`：使用 Webpack 开发模式监听编译。
- `npm run package`：使用 `vsce package` 生成 VSIX。
- `npm run lint`：运行 ESLint 检查源码。

`.vscodeignore` 控制 VSIX 打包时排除的文件。开发文档、源码、构建配置、依赖目录和本地包文件应尽量排除，避免 VSIX 体积过大或包含不必要信息。

## 开发注意事项

- 修改命令入口时，先检查 `src/extension.ts` 和 `package.json` 中的命令贡献点是否一致。
- 修改构建流程时，重点检查 `buildProject.ts`、`fileService.ts` 和 `h3yunApi.ts`。
- 修改同步流程时，重点检查 `syncProject.ts`、`diffUtils.ts`、`conflictDialog.ts` 和 `diffPreview.ts`。
- 修改氚云接口字段时，优先调整 `src/parsers/` 下对应 parser，不要把响应解析逻辑散落到命令处理器中。
- 修改氚云接口版本差异时,优先在 `h3yunApiLegacy.ts` 或 `h3yunApiNew.ts` 中调整具体实现,通过 `h3yunApi.ts` 统一分发。
- 修改本地项目结构时，需要同步调整 `CmaxConfig` 类型、`fileService.ts` 读写逻辑和同步流程。
- 修改 `cmax.json` 结构或表单排序方式时,同步检查 `projectReadme.ts` 生成的项目结构说明是否需要调整。
- 新增需要忽略的本地文件或目录时，维护 `fileService.ts` 中的 `GITIGNORE_ENTRIES`。
- 每次提交前建议至少运行 `npm run compile`。

## 常见扩展点

- 新增氚云接口：先在 `h3yunApi.ts` 门面中添加方法,再在 `h3yunApiLegacy.ts` 和 `h3yunApiNew.ts` 中实现对应版本逻辑,并在 `src/parsers/` 中新增或复用 parser。
- 新增生成文件：扩展 `FileContentMap`，调整 `h3yunApi.ts` 的获取逻辑和 `fileService.ts` 的保存逻辑。
- 新增同步冲突策略：调整 `syncProject.ts` 的冲突处理流程，并扩展 `conflictDialog.ts` 或 `diffPreview.ts`。
- 新增默认忽略项：调整 `fileService.ts` 中的 `GITIGNORE_ENTRIES`。
- 新增命令：在 `package.json` 的 `contributes.commands` 中声明，并在 `src/extension.ts` 中注册。
