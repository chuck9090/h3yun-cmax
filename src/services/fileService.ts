import * as fs from 'fs';
import * as path from 'path';
import { folderExists, createFolder, generateUniqueSuffix, buildFolderName } from '../utils/folderUtils';
import { CmaxConfig, CmaxFormEntry, FileContentMap } from '../types';

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

interface LegacyCmaxConfig extends CmaxConfig {
  h3Token?: string;
}

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
  readJsonFile<T = any>(filePath: string): T {
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
   * @returns 应用文件夹路径和随机后缀
   */
  createAppFolder(workspaceRoot: string, appName: string): { folderPath: string; suffix: string } {
    const usedSuffixes = new Set<string>();
    let suffix: string;
    let folderPath: string;

    do {
      suffix = generateUniqueSuffix('a', usedSuffixes);
      folderPath = path.join(workspaceRoot, buildFolderName(appName, suffix));
    } while (folderExists(folderPath));

    createFolder(folderPath);
    return { folderPath, suffix };
  }

  /**
   * 创建表单文件夹
   * @param appFolderPath 应用文件夹路径
   * @param formName 表单名称
   * @param existingSuffixes 已使用的表单后缀集合
   * @returns 表单文件夹路径和随机后缀
   */
  createFormFolder(
    appFolderPath: string,
    formName: string,
    existingSuffixes: Set<string>
  ): { folderPath: string; suffix: string } {
    const suffix = generateUniqueSuffix('f', existingSuffixes);
    const folderPath = path.join(appFolderPath, buildFolderName(formName, suffix));
    createFolder(folderPath);
    return { folderPath, suffix };
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
   * 使用同一个随机后缀重命名文件夹
   * @param currentFolderPath 当前文件夹路径
   * @param newName 新显示名称
   * @param suffix 随机后缀
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
   * @param appFolderPath 应用文件夹路径
   * @param failures 失败节点列表
   */
  saveFailedNodesReport(
    appFolderPath: string,
    failures: Array<{ code: string; name: string; error: string }>
  ): void {
    const reportPath = path.join(appFolderPath, FAILED_NODES_REPORT_FILENAME);

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
   * 创建 cmax.json 配置文件
   * @param appFolderPath 应用文件夹路径
   * @param appCode 应用编码
   * @param appName 应用名称
   * @param appSuffix 应用文件夹随机后缀
   * @param forms 表单配置记录, key 为随机后缀
   */
  createCmaxConfig(
    appFolderPath: string,
    appCode: string,
    appName: string,
    appSuffix: string,
    forms: Record<string, CmaxFormEntry>
  ): void {
    const config: CmaxConfig = {
      appCode,
      appName,
      appSuffix,
      forms,
      lastSyncTime: new Date().toISOString()
    };

    const configPath = path.join(appFolderPath, CMAX_CONFIG_FILENAME);
    this.saveFile(configPath, JSON.stringify(config, null, 2));
  }

  /**
   * 保存氚云认证 Token
   * @param appFolderPath 应用文件夹路径
   * @param token 氚云认证 Token
   */
  saveToken(appFolderPath: string, token: string): void {
    const tokenPath = path.join(appFolderPath, H3_TOKEN_FILENAME);
    this.saveFile(tokenPath, `${token.trim()}\n`);
  }

  /**
   * 读取氚云认证 Token
   * @param appFolderPath 应用文件夹路径
   * @returns 氚云认证 Token
   */
  readToken(appFolderPath: string): string {
    const tokenPath = path.join(appFolderPath, H3_TOKEN_FILENAME);

    if (!fs.existsSync(tokenPath)) {
      return this.migrateLegacyToken(appFolderPath);
    }

    const token = this.readFile(tokenPath).trim();

    if (!token) {
      throw new Error(`${H3_TOKEN_FILENAME} 内容为空`);
    }

    return token;
  }

  private migrateLegacyToken(appFolderPath: string): string {
    const configPath = path.join(appFolderPath, CMAX_CONFIG_FILENAME);
    const config = this.readJsonFile<LegacyCmaxConfig>(configPath);
    const token = config.h3Token?.trim();

    if (!token) {
      throw new Error(`缺少 ${H3_TOKEN_FILENAME},请重新构建项目或重新输入 Token`);
    }

    delete config.h3Token;
    this.saveToken(appFolderPath, token);
    this.ensureGitIgnore(appFolderPath);
    this.saveFile(configPath, JSON.stringify(config, null, 2));

    return token;
  }

  /**
   * 创建或更新 .gitignore,写入需要忽略的本地文件
   * @param appFolderPath 应用文件夹路径
   */
  ensureGitIgnore(appFolderPath: string): void {
    const gitIgnorePath = path.join(appFolderPath, GITIGNORE_FILENAME);
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
   * 读取 cmax.json 配置文件
   * @param appFolderPath 应用文件夹路径
   * @returns 配置对象
   */
  readCmaxConfig(appFolderPath: string): CmaxConfig {
    const configPath = path.join(appFolderPath, CMAX_CONFIG_FILENAME);
    return this.readJsonFile<CmaxConfig>(configPath);
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
   * 检查文件夹是否包含 cmax.json
   * @param folderPath 文件夹路径
   * @returns 是否包含配置文件
   */
  hasCmaxConfig(folderPath: string): boolean {
    const configPath = path.join(folderPath, CMAX_CONFIG_FILENAME);
    return fs.existsSync(configPath);
  }

  /**
   * 更新 cmax.json 的最后同步时间
   * @param appFolderPath 应用文件夹路径
   */
  updateLastSyncTime(appFolderPath: string): void {
    try {
      const config = this.readCmaxConfig(appFolderPath);
      config.lastSyncTime = new Date().toISOString();
      const configPath = path.join(appFolderPath, CMAX_CONFIG_FILENAME);
      this.saveFile(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.warn('更新同步时间失败:', error);
    }
  }
}

// 导出单例实例
export const fileService = new FileService();
