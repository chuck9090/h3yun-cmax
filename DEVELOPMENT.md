# H3Yun CMax 开发手册

本文档面向插件维护者和二次开发者，用于说明项目目录结构、核心流程和关键代码文件职责。本文档仅用于开发协作，不需要随 VSIX 插件包发布。

## 项目概览

H3Yun CMax 是一个 VSCode 插件，用于从氚云平台拉取应用、表单、字段和自定义代码到本地目录，并提供后续同步、冲突处理和 Git 初始化提交能力。

插件主要提供两个命令：

- `h3yun-cmax.buildProject`：从氚云构建本地项目。
- `h3yun-cmax.syncProject`：从氚云同步已有本地项目。

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
8. 更新“氚云代码”目录下统一的 `cmax.json`,写入根级共享的 `engineCode`、接口版本和 `systemUserId`,以及当前应用的应用编码和表单映射。
9. 保存统一的 `.h3token` 到“氚云代码”目录。
10. 在“氚云代码”目录创建或更新 `.gitignore`，避免提交 Token 和常见 AI 工具缓存目录。
11. 在“氚云代码”根目录保存节点获取失败报告 `failed-nodes(应用名称).md`。
12. 询问用户是否提交本次添加应用的构建文件;如果尚未初始化 Git,提交时由工具在后台自动初始化,不在弹窗中单独提示。

构建命令如果发现当前工作区就是“氚云代码”目录,会从根 `cmax.json` 和 `.h3token` 预填根级共享的企业引擎编码与 Token。一个“氚云代码”工作区只使用一个根级企业引擎编码。Token 保持可编辑;Token 验证失败时构建表单不关闭,用户可替换 Token 后重试。`systemUserId` 仅在根配置首次缺失时查询,后续新增应用和同步直接复用根级值。

构建命令是本插件最重要的入口之一。涉及文件夹创建、API 调用、代码写入、配置生成和 Git 初始化。

### 从氚云同步项目

主文件：`src/commands/syncProject.ts`

核心流程：

1. 从右键菜单传入的文件夹或当前编辑器推断应用目录。
2. 检查“氚云代码”目录下是否存在根 `cmax.json`,并从应用目录后缀定位当前应用配置。
3. 读取根 `cmax.json` 中的共享配置和当前应用配置,并根据根级 `h3yunApiVersion` 选择氚云接口版本。
4. 根级 `engineCode` 缺失时提示用户补充并写回根 `cmax.json`;Token 缺失或失效时提示用户重新输入。
5. 拉取氚云最新应用名和表单列表。
6. 同步应用文件夹名和表单文件夹名。
7. 获取远端表单代码。
8. 检测本地文件与远端文件是否存在差异。
9. 出现冲突时提供批量处理或差异预览。
10. 写入用户确认后的远端内容。
11. 更新根 `cmax.json` 中当前应用的同步时间。
12. 保存节点获取失败报告。
13. 仅当当前应用目录存在代码变更时,询问用户是否自动提交本次同步变更。根 `cmax.json` 的变化不触发提交询问,但提交应用代码时会随配置一起暂存。

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
  "h3yunApiVersion": "legacy"
}
```

取值说明:

- `legacy`：老版本接口,也是默认值。
- `new`：新版本接口。

使用规则:

- 新建工作区时默认写入 `"h3yunApiVersion": "legacy"`。
- 已有根级配置时,新增应用和同步均保留当前配置值,不会覆盖用户手动改成的 `new`。
- 旧项目需要使用新版工具重新构建项目结构,不会读取旧应用目录中的配置。

相关文件:

- `src/types/index.ts`：定义 `H3YunApiVersion` 和 `CmaxWorkspaceConfig.h3yunApiVersion`。
- `src/services/fileService.ts`：创建、读取和写回 `cmax.json` 时处理接口版本默认值和保留逻辑。
- `src/commands/buildProject.ts`：新建工作区时默认使用 `legacy`,已有工作区时复用根级配置。
- `src/commands/syncProject.ts`：同步时按根级 `cmax.json` 中的 `h3yunApiVersion` 设置接口版本。
- `src/ui/buildProjectForm.ts`：构建或重新输入 Token 时,使用当前流程指定的接口版本进行验证。

### `src/services/h3yunApi.ts`

氚云接口统一入口,负责按当前接口版本分发到具体实现。

主要职责:

- 维护当前接口版本,缺省为 `legacy`。
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
- 获取应用下的功能节点和表单列表。
- 判断功能节点是否是表单。
- 获取字段设计数据。
- 获取表单自定义代码。
- 获取列表设计器代码。
- 在远端代码为空时使用 `default-code/` 中的默认模板。
- 记录部分节点请求失败信息，供构建或同步后生成报告。

此文件聚合了多个 parser 的解析结果,是老版本氚云 API 调用的主要实现。

### `src/services/h3yunApiNew.ts`

氚云新版本接口服务。

当前该文件先继承 `H3YunLegacyApiService`,保持行为一致。后续确认新版本接口差异后,只需要在 `H3YunNewApiService` 中覆盖对应方法,不要把新版本判断散落到命令层或 parser 外层。

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
- `CmaxFormEntry`：表单配置条目。
- `FileContentMap`：一个表单下各代码文件的内容映射。

### `src/parsers/`

解析氚云接口响应的目录。各 parser 尽量只负责响应结构解析和数据清洗，不直接进行文件写入或 UI 操作。

主要文件：

- `appListParser.ts`：解析应用列表响应，并根据应用编码找到目标应用。
- `functionNodeChildrenParser.ts`：解析功能节点子节点响应。
- `functionNodeTypes.ts`：定义功能节点相关类型。
- `sheetDesignerParser.ts`：解析表单设计器响应，判断节点是否包含表单结构，并提取字段信息。
- `customCodeParser.ts`：解析表单自定义代码响应。
- `listViewDesignerParser.ts`：解析列表设计器代码响应。

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
│   │   └── list-backend.cs
│   └── 表单B(f4d5e6f)/
│       ├── fields.md
│       ├── form-frontend.js
│       ├── form-backend.cs
│       ├── list-frontend.js
│       └── list-backend.cs
└── 其他应用/
```

说明：

- 应用目录后缀默认形如 `a1a2b3c`,由 `a` 加应用编码 MD5 的前 6 位组成。
- 表单目录后缀默认形如 `f1a2b3c`,由 `f` 加表单编码 MD5 的前 6 位组成。
- 发生冲突时依次使用 MD5 前 7 位、前 8 位等更长前缀,直到生成唯一后缀。
- 根目录 `cmax.json` 按 `version`、`engineCode`、`h3yunApiVersion`、`systemUserId`、`apps` 顺序记录配置;其中 `apps` 的 key 即应用目录后缀,应用对象记录应用编码、应用名称、表单编码、表单名称和同步时间,不再重复保存 `appSuffix`。应用目录下不再保存独立的 `cmax.json`。
- “氚云代码”目录下的 `.h3token` 保存本地 Token，不应提交到 Git。
- “氚云代码”目录下的 `.gitignore` 由插件自动创建或更新。
- `failed-nodes(应用名称).md` 记录本次构建或同步中无法读取的节点,并由根目录 `.gitignore` 中的 `failed-nodes*.md` 忽略。
- 报表等 `LoadForm` 响应不包含有效表单结构的非表单节点会直接跳过,不会写入失败报告。

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
- 新增需要忽略的本地文件或目录时，维护 `fileService.ts` 中的 `GITIGNORE_ENTRIES`。
- 每次提交前建议至少运行 `npm run compile`。

## 常见扩展点

- 新增氚云接口：先在 `h3yunApi.ts` 门面中添加方法,再在 `h3yunApiLegacy.ts` 和 `h3yunApiNew.ts` 中实现对应版本逻辑,并在 `src/parsers/` 中新增或复用 parser。
- 新增生成文件：扩展 `FileContentMap`，调整 `h3yunApi.ts` 的获取逻辑和 `fileService.ts` 的保存逻辑。
- 新增同步冲突策略：调整 `syncProject.ts` 的冲突处理流程，并扩展 `conflictDialog.ts` 或 `diffPreview.ts`。
- 新增默认忽略项：调整 `fileService.ts` 中的 `GITIGNORE_ENTRIES`。
- 新增命令：在 `package.json` 的 `contributes.commands` 中声明，并在 `src/extension.ts` 中注册。
