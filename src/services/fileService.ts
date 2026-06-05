import * as fs from 'fs';
import * as path from 'path';
import { folderExists, createFolder, generateUniqueSuffix, buildFolderName } from '../utils/folderUtils';
import { CmaxConfig, CmaxFormEntry, FileContentMap } from '../types';

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
      if (content) { // 只保存非空内容
        const filePath = path.join(formFolderPath, filename);
        this.saveFile(filePath, content);
      }
    }
  }

  /**
   * 创建 cmax.json 配置文件
   * @param appFolderPath 应用文件夹路径
   * @param appCode 应用编码
   * @param appName 应用名称
   * @param appSuffix 应用文件夹随机后缀
   * @param h3Token 氚云认证 Token
   * @param forms 表单配置记录, key 为随机后缀
   */
  createCmaxConfig(
    appFolderPath: string,
    appCode: string,
    appName: string,
    appSuffix: string,
    h3Token: string,
    forms: Record<string, CmaxFormEntry>
  ): void {
    const config: CmaxConfig = {
      appCode,
      appName,
      appSuffix,
      h3Token,
      forms,
      lastSyncTime: new Date().toISOString()
    };

    const configPath = path.join(appFolderPath, 'cmax.json');
    this.saveFile(configPath, JSON.stringify(config, null, 2));
  }

  /**
   * 读取 cmax.json 配置文件
   * @param appFolderPath 应用文件夹路径
   * @returns 配置对象
   */
  readCmaxConfig(appFolderPath: string): CmaxConfig {
    const configPath = path.join(appFolderPath, 'cmax.json');
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
    const configPath = path.join(folderPath, 'cmax.json');
    return fs.existsSync(configPath);
  }

  /**
   * 仅更新 cmax.json 中的 Token
   * @param appFolderPath 应用文件夹路径
   * @param token 新的 Token 值
   */
  updateToken(appFolderPath: string, token: string): void {
    const config = this.readCmaxConfig(appFolderPath);
    config.h3Token = token;
    const configPath = path.join(appFolderPath, 'cmax.json');
    this.saveFile(configPath, JSON.stringify(config, null, 2));
  }

  /**
   * 更新 cmax.json 的最后同步时间
   * @param appFolderPath 应用文件夹路径
   */
  updateLastSyncTime(appFolderPath: string): void {
    try {
      const config = this.readCmaxConfig(appFolderPath);
      config.lastSyncTime = new Date().toISOString();
      const configPath = path.join(appFolderPath, 'cmax.json');
      this.saveFile(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.warn('更新同步时间失败:', error);
    }
  }
}

// 导出单例实例
export const fileService = new FileService();
