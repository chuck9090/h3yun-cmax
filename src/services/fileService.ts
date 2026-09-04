import * as fs from 'fs';
import * as path from 'path';
import { folderExists, createFolder, generateCodeSuffix, buildFolderName, sanitizeFolderName } from '../utils/folderUtils';
import { CmaxConfig, CmaxFormEntry, CmaxWorkspaceConfig, FileContentMap, H3YunApiVersion } from '../types';

const CMAX_CONFIG_FILENAME = 'cmax.json';
const H3_TOKEN_FILENAME = '.h3token';
const GITIGNORE_FILENAME = '.gitignore';
const GITIGNORE_ENTRIES = [
  H3_TOKEN_FILENAME,
  'failed-nodes*.md',
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

const DEFAULT_H3YUN_API_VERSION: H3YunApiVersion = 'legacy';

/**
 * 文件管理服务类
 */
export class FileService {
  /**
   * 保存文本文件
   * @param filePath 文件完整路径
   * @param content 文件内容
   */
  saveFile(filePath: string, content: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * 读取文本文件
   * @param filePath 文件完整路径
   * @returns 文件内容
   */
  readFile(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * 读取 JSON 文件并解析
   * @param filePath 文件完整路径
   * @returns 解析后的对象
   */
  readJsonFile<T = unknown>(filePath: string): T {
    const content = this.readFile(filePath);
    try {
      return JSON.parse(content) as T;
    } catch (error) {
      throw new Error(`JSON 解析失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 创建应用文件夹
   * @param workspaceRoot 工作区根目录
   * @param appName 应用名称
   * @param appCode 应用编码
   * @returns 应用文件夹路径和编码后缀
   */
  createAppFolder(codeFolderPath: string, appName: string, appCode: string): { folderPath: string; suffix: string } {
    const existingMappings = new Map<string, string>();
    const workspaceConfig = this.readWorkspaceConfig(codeFolderPath);
    for (const config of Object.values(workspaceConfig.apps)) {
      try {
        if (!config.appSuffix) {
          continue;
        }
        if (config.appSuffix) {
          existingMappings.set(config.appSuffix, config.appCode);
        }
        if (config.appCode === appCode && config.appSuffix) {
          const existingFolderPath = path.join(codeFolderPath, buildFolderName(config.appName, config.appSuffix));
          const folderPath = folderExists(existingFolderPath) && config.appName !== appName
            ? this.renameFolderWithSuffix(existingFolderPath, appName, config.appSuffix)
            : path.join(codeFolderPath, buildFolderName(appName, config.appSuffix));
          createFolder(folderPath);
          return { folderPath, suffix: config.appSuffix };
        }
      } catch {
        // 忽略无法读取的其他应用配置,不影响当前构建。
      }
    }

    const suffix = generateCodeSuffix(
      'a',
      appCode,
      existingMappings,
      (candidate) => !this.hasChildFolderWithSuffix(codeFolderPath, candidate)
    );
    const folderPath = path.join(codeFolderPath, buildFolderName(appName, suffix));

    createFolder(folderPath);
    return { folderPath, suffix };
  }

  /**
   * 创建表单文件夹
   * @param codeFolderPath 氚云代码目录路径
   * @param formName 表单名称
   * @param existingMappings 已使用后缀到表单编码的映射
   * @param formCode 表单编码
   * @returns 表单文件夹路径和编码后缀
   */
  createFormFolder(
    appFolderPath: string,
    formName: string,
    formCode: string,
    existingMappings: Map<string, string>
  ): { folderPath: string; suffix: string } {
    const existingSuffix = Array.from(existingMappings.entries())
      .find(([, existingCode]) => existingCode === formCode)?.[0];
    if (existingSuffix) {
      const existingFolderPath = this.findChildFolderWithSuffix(appFolderPath, existingSuffix);
      if (!existingFolderPath) {
        throw new Error(`表单编码 ${formCode} 的配置后缀 ${existingSuffix} 对应目录不存在`);
      }
      const existingConfig = path.basename(existingFolderPath);
      const expectedFolderName = buildFolderName(formName, existingSuffix);
      const folderPath = existingConfig === expectedFolderName
        ? existingFolderPath
        : this.renameFolderWithSuffix(existingFolderPath, formName, existingSuffix);
      return { folderPath, suffix: existingSuffix };
    }

    const suffix = generateCodeSuffix(
      'f',
      formCode,
      existingMappings,
      (candidate) => !this.hasChildFolderWithSuffix(appFolderPath, candidate)
    );
    const folderPath = path.join(appFolderPath, buildFolderName(formName, suffix));
    createFolder(folderPath);
    return { folderPath, suffix };
  }

  /**
   * 检查目录下是否已有使用指定后缀的子文件夹。
   */
  private hasChildFolderWithSuffix(parentPath: string, suffix: string): boolean {
    return !!this.findChildFolderWithSuffix(parentPath, suffix);
  }

  /**
   * 查找目录下以指定后缀结尾的子文件夹。
   */
  private findChildFolderWithSuffix(parentPath: string, suffix: string): string | undefined {
    if (!folderExists(parentPath)) {
      return undefined;
    }

    const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const suffixPattern = new RegExp(`\\(${escapedSuffix}\\)$`);
    const entry = fs.readdirSync(parentPath, { withFileTypes: true })
      .find((item) => item.isDirectory() && suffixPattern.test(item.name));
    return entry ? path.join(parentPath, entry.name) : undefined;
  }

  /**
   * 保存表单的所有代码文件
   * @param formFolderPath 表单文件夹路径
   * @param codes 代码内容映射
   */
  saveFormCodes(formFolderPath: string, codes: FileContentMap): void {
    for (const [filename, content] of Object.entries(codes)) {
      if (filename === 'fields.md') {
        this.deleteFileIfExists(path.join(formFolderPath, 'fields.json'));
      }

      const filePath = path.join(formFolderPath, filename);
      this.saveFile(filePath, content);
    }
  }

  /**
   * 删除文件(如果存在)
   * @param filePath 文件完整路径
   */
  deleteFileIfExists(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * 删除文件夹(如果存在)
   * @param folderPath 文件夹完整路径
   */
  deleteFolderIfExists(folderPath: string): void {
    if (fs.existsSync(folderPath)) {
      fs.rmSync(folderPath, { recursive: true, force: true });
    }
  }

  /**
   * 使用同一个目录后缀重命名文件夹
   * @param currentFolderPath 当前文件夹路径
   * @param newName 新显示名称
   * @param suffix 目录后缀
   * @returns 重命名后的文件夹路径
   */
  renameFolderWithSuffix(currentFolderPath: string, newName: string, suffix: string): string {
    const parentPath = path.dirname(currentFolderPath);
    const targetFolderPath = path.join(parentPath, buildFolderName(newName, suffix));

    if (currentFolderPath === targetFolderPath) {
      return currentFolderPath;
    }

    if (!fs.existsSync(currentFolderPath)) {
      throw new Error(`待重命名文件夹不存在: ${currentFolderPath}`);
    }

    if (fs.existsSync(targetFolderPath)) {
      throw new Error(`目标文件夹已存在: ${targetFolderPath}`);
    }

    fs.renameSync(currentFolderPath, targetFolderPath);
    return targetFolderPath;
  }

  /**
   * 保存节点获取失败报告
   * @param codeFolderPath 氚云代码目录路径
   * @param appName 应用名称
   * @param failures 失败节点列表
   */
  saveFailedNodesReport(
    codeFolderPath: string,
    appName: string,
    failures: Array<{ code: string; name: string; error: string }>
  ): void {
    const reportPath = path.join(codeFolderPath, `failed-nodes(${sanitizeFolderName(appName)}).md`);

    if (failures.length === 0) {
      if (fs.existsSync(reportPath)) {
        fs.unlinkSync(reportPath);
      }
      return;
    }

    let content = '# 节点获取失败报告\n\n';
    content += `生成时间: ${new Date().toISOString()}\n\n`;
    content += '以下节点在判断是否为表单时发生请求级别失败,未参与本次构建或同步。\n\n';

    failures.forEach((failure, index) => {
      content += `## ${index + 1}. ${failure.name}\n\n`;
      content += `- 节点编码: ${failure.code}\n`;
      content += `- 失败原因: ${failure.error}\n\n`;
    });

    this.saveFile(reportPath, content);
  }

  /**
   * 更新氚云代码目录下的 cmax.json 中的应用配置
   * @param codeFolderPath 氚云代码目录路径
   * @param appSuffixKey 应用配置 key
   * @param appCode 应用编码
   * @param engineCode 企业引擎编码
   * @param appName 应用名称
   * @param appSuffix 应用文件夹编码后缀
   * @param forms 表单配置记录, key 为编码后缀
   * @param h3yunApiVersion 氚云接口版本
   */
  createCmaxConfig(
    codeFolderPath: string,
    appSuffixKey: string,
    appCode: string,
    engineCode: string,
    appName: string,
    appSuffix: string,
    forms: Record<string, CmaxFormEntry>,
    h3yunApiVersion: H3YunApiVersion = DEFAULT_H3YUN_API_VERSION,
    systemUserId?: string
  ): void {
    const config: CmaxConfig = {
      appCode,
      appName,
      appSuffix,
      lastSyncTime: new Date().toISOString(),
      forms,
    };

    const workspaceConfig = this.readWorkspaceConfig(codeFolderPath);
    workspaceConfig.engineCode = engineCode;
    workspaceConfig.h3yunApiVersion = h3yunApiVersion;
    if (systemUserId) {
      workspaceConfig.systemUserId = systemUserId;
    }
    workspaceConfig.apps[appSuffixKey] = config;
    this.saveWorkspaceConfig(codeFolderPath, workspaceConfig);
  }

  /**
   * 保存氚云认证 Token
   * @param codeFolderPath 氚云代码根目录路径
   * @param token 氚云认证 Token
   */
  saveToken(codeFolderPath: string, token: string): void {
    const tokenPath = path.join(codeFolderPath, H3_TOKEN_FILENAME);
    this.saveFile(tokenPath, `${token.trim()}\n`);
  }

  /**
   * 读取氚云认证 Token
   * @param codeFolderPath 氚云代码根目录路径
   * @returns 氚云认证 Token
   */
  readToken(codeFolderPath: string): string {
    const tokenPath = path.join(codeFolderPath, H3_TOKEN_FILENAME);

    if (!fs.existsSync(tokenPath)) {
      throw new Error(`缺少 ${H3_TOKEN_FILENAME},请重新构建项目或重新输入 Token`);
    }

    const token = this.readFile(tokenPath).trim();

    if (!token) {
      throw new Error(`${H3_TOKEN_FILENAME} 内容为空`);
    }

    return token;
  }
  /**
   * 创建或更新 .gitignore,写入需要忽略的本地文件
   * @param codeFolderPath 氚云代码根目录路径
   */
  ensureGitIgnore(codeFolderPath: string): void {
    const gitIgnorePath = path.join(codeFolderPath, GITIGNORE_FILENAME);
    const existingContent = fs.existsSync(gitIgnorePath)
      ? fs.readFileSync(gitIgnorePath, 'utf-8')
      : '';
    const entries = existingContent
      .split(/\r?\n/)
      .map((line) => line.trim());
    const missingEntries = GITIGNORE_ENTRIES.filter((entry) => !entries.includes(entry));

    if (missingEntries.length === 0) {
      return;
    }

    const prefix = existingContent && !existingContent.endsWith('\n') ? '\n' : '';
    this.saveFile(gitIgnorePath, `${existingContent}${prefix}${missingEntries.join('\n')}\n`);
  }

  /**
   * 读取氚云代码目录下指定应用的 cmax.json 配置
   * @param codeFolderPath 氚云代码目录路径
   * @param appSuffix 应用后缀
   * @returns 配置对象
   */
  readCmaxConfig(codeFolderPath: string, appSuffix: string): CmaxConfig {
    const config = this.readWorkspaceConfig(codeFolderPath).apps[appSuffix];
    if (!config) {
      throw new Error(`氚云代码配置中不存在应用后缀: ${appSuffix}`);
    }
    return config;
  }

  /**
   * 读取氚云代码目录级 cmax.json。
   */
  readWorkspaceConfig(codeFolderPath: string): CmaxWorkspaceConfig {
    const configPath = path.join(codeFolderPath, CMAX_CONFIG_FILENAME);
    if (!fs.existsSync(configPath)) {
      return { version: 2, apps: {} };
    }

    const config = this.readJsonFile<Partial<CmaxWorkspaceConfig>>(configPath);
    return {
      version: 2,
      engineCode: config.engineCode,
      h3yunApiVersion: config.h3yunApiVersion === 'new' ? 'new' : DEFAULT_H3YUN_API_VERSION,
      systemUserId: config.systemUserId,
      apps: config.apps || {}
    };
  }

  /**
   * 保存氚云代码目录级 cmax.json。
   */
  saveWorkspaceConfig(codeFolderPath: string, config: CmaxWorkspaceConfig): void {
    this.saveFile(path.join(codeFolderPath, CMAX_CONFIG_FILENAME), JSON.stringify(config, null, 2));
  }

  /**
   * 检查文件是否存在
   * @param filePath 文件完整路径
   * @returns 文件是否存在
   */
  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * 检查氚云代码目录是否包含 cmax.json
   * @param codeFolderPath 氚云代码目录路径
   * @returns 是否包含配置文件
   */
  hasCmaxConfig(codeFolderPath: string): boolean {
    return fs.existsSync(path.join(codeFolderPath, CMAX_CONFIG_FILENAME));
  }

  /**
   * 根据根配置查找项目目录下的所有氚云应用文件夹
   * @param projectFolderPath 氚云代码目录路径
   * @returns 已登记且实际存在的应用文件夹路径
   */
  findAppFolders(projectFolderPath: string): string[] {
    if (!fs.existsSync(projectFolderPath) || !fs.statSync(projectFolderPath).isDirectory()) {
      return [];
    }

    const workspaceConfig = this.readWorkspaceConfig(projectFolderPath);
    return Object.values(workspaceConfig.apps)
      .map((config) => config.appSuffix ? path.join(projectFolderPath, buildFolderName(config.appName, config.appSuffix)) : undefined)
      .filter((folderPath): folderPath is string => !!folderPath && folderExists(folderPath))
      .sort((left, right) => left.localeCompare(right));
  }

  /**
   * 更新 cmax.json 的最后同步时间
   * @param codeFolderPath 氚云代码目录路径
   */
  updateLastSyncTime(codeFolderPath: string, appSuffix: string): void {
    try {
      const config = this.readCmaxConfig(codeFolderPath, appSuffix);
      config.lastSyncTime = new Date().toISOString();
      const workspaceConfig = this.readWorkspaceConfig(codeFolderPath);
      workspaceConfig.apps[appSuffix] = config;
      this.saveWorkspaceConfig(codeFolderPath, workspaceConfig);
    } catch (error) {
      console.warn('更新同步时间失败:', error);
    }
  }
}

// 导出单例实例
export const fileService = new FileService();
