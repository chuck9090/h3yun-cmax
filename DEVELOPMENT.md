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
2. 打开构建表单，让用户输入应用编码和 `h3_token`。
3. 调用氚云接口获取应用信息。
4. 在工作区下创建应用文件夹，文件夹名包含随机后缀。
5. 获取应用下的表单列表。
6. 为每个表单创建表单文件夹。
7. 拉取表单字段、表单前端、表单后端、列表前端、列表后端代码。
8. 生成 `cmax.json` 配置文件。
9. 保存 `.h3token` 到应用文件夹。
10. 创建或更新 `.gitignore`，避免提交 Token 和常见 AI 工具缓存目录。
11. 保存节点获取失败报告 `failed-nodes.md`。
12. 询问用户是否自动执行 `git init`、`git add` 和首次提交。

构建命令是本插件最重要的入口之一。涉及文件夹创建、API 调用、代码写入、配置生成和 Git 初始化。

### 从氚云同步项目

主文件：`src/commands/syncProject.ts`

核心流程：

1. 从右键菜单传入的文件夹或当前编辑器推断应用目录。
2. 检查目录下是否存在 `cmax.json`。
3. 读取 `cmax.json` 和 `.h3token`。
4. Token 缺失或失效时提示用户重新输入。
5. 拉取氚云最新应用名和表单列表。
6. 同步应用文件夹名和表单文件夹名。
7. 获取远端表单代码。
8. 检测本地文件与远端文件是否存在差异。
9. 出现冲突时提供批量处理或差异预览。
10. 写入用户确认后的远端内容。
11. 更新 `cmax.json` 的同步时间。
12. 保存节点获取失败报告。
13. 询问用户是否自动提交本次同步变更。

同步命令需要特别注意本地修改保护，不能无提示覆盖用户本地编辑。

## 关键代码文件说明

### `src/services/fileService.ts`

文件管理服务，负责本地项目文件和配置文件读写。

主要职责：

- 创建应用文件夹和表单文件夹。
- 保存表单代码文件。
- 创建和读取 `cmax.json`。
- 保存和读取 `.h3token`。
- 迁移旧版本保存在 `cmax.json` 中的 Token。
- 创建或更新 `.gitignore`。
- 保存 `failed-nodes.md` 失败报告。
- 重命名带随机后缀的文件夹。

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
  '.tabnine/'
];
```

后续如果需要新增默认忽略项，只需要维护 `GITIGNORE_ENTRIES`。

### `src/services/h3yunApi.ts`

氚云接口服务，负责和氚云平台交互。

主要职责：

- 设置和缓存全局 Token。
- 获取应用信息。
- 获取应用下的功能节点和表单列表。
- 判断功能节点是否是表单。
- 获取字段设计数据。
- 获取表单自定义代码。
- 获取列表设计器代码。
- 在远端代码为空时使用 `default-code/` 中的默认模板。
- 记录部分节点请求失败信息，供构建或同步后生成报告。

此文件聚合了多个 parser 的解析结果，是氚云 API 调用的主要入口。

### `src/services/gitService.ts`

Git 操作服务，当前封装了初始化和提交逻辑。

主要职责：

- 执行 `git init`。
- 执行 `git add .`。
- 执行 `git commit -m <message>`。
- 捕获 Git 命令错误并返回可读错误信息。

当前实现使用 `execFile`，避免拼接 shell 命令带来的转义问题。

### `src/ui/buildProjectForm.ts`

构建项目输入表单 Webview。

主要职责：

- 展示应用编码和 Token 输入界面。
- 读取 `assets/token-guide.html` 作为 Token 获取说明。
- 校验用户输入是否为空。
- 调用氚云接口验证 Token 和应用编码。
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
- 生成随机后缀。
- 拼接包含后缀的文件夹名。

应用和表单文件夹都使用随机后缀避免同名冲突，并通过 `cmax.json` 维护后缀和氚云编码之间的映射关系。

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
- `CmaxConfig`：本地 `cmax.json` 配置结构。
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

用户执行构建后，插件会在当前工作区下创建一个应用目录。典型结构如下：

```text
应用名称(a12345)/
├── .gitignore
├── .h3token
├── cmax.json
├── failed-nodes.md
├── 表单A(f12345)/
│   ├── fields.md
│   ├── form-frontend.js
│   ├── form-backend.cs
│   ├── list-frontend.js
│   └── list-backend.cs
└── 表单B(f67890)/
    ├── fields.md
    ├── form-frontend.js
    ├── form-backend.cs
    ├── list-frontend.js
    └── list-backend.cs
```

说明：

- 应用目录后缀形如 `a12345`。
- 表单目录后缀形如 `f12345`。
- `cmax.json` 用于记录应用编码、应用名称、表单编码、表单名称和随机后缀映射。
- `.h3token` 保存本地 Token，不应提交到 Git。
- `.gitignore` 由插件自动创建或更新。
- `failed-nodes.md` 记录本次构建或同步中无法读取的节点。

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
- 修改本地项目结构时，需要同步调整 `CmaxConfig` 类型、`fileService.ts` 读写逻辑和同步流程。
- 新增需要忽略的本地文件或目录时，维护 `fileService.ts` 中的 `GITIGNORE_ENTRIES`。
- 每次提交前建议至少运行 `npm run compile`。

## 常见扩展点

- 新增氚云接口：在 `h3yunApi.ts` 中添加 API 方法，并在 `src/parsers/` 中新增或复用 parser。
- 新增生成文件：扩展 `FileContentMap`，调整 `h3yunApi.ts` 的获取逻辑和 `fileService.ts` 的保存逻辑。
- 新增同步冲突策略：调整 `syncProject.ts` 的冲突处理流程，并扩展 `conflictDialog.ts` 或 `diffPreview.ts`。
- 新增默认忽略项：调整 `fileService.ts` 中的 `GITIGNORE_ENTRIES`。
- 新增命令：在 `package.json` 的 `contributes.commands` 中声明，并在 `src/extension.ts` 中注册。
