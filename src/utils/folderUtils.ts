import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

const INVALID_FOLDER_NAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;
export const CODE_FOLDER_NAME = '氚云代码';

/**
 * 清理文件夹名称中不支持的字符
 * @param name 原始显示名称
 */
export function sanitizeFolderName(name: string): string {
  const sanitizedName = name.replace(INVALID_FOLDER_NAME_CHARS, '').trim();
  return sanitizedName || '未命名';
}

/**
 * 根据应用或表单编码生成稳定后缀,发生冲突时逐步增加 MD5 前缀长度。
 * @param prefix 类型前缀,应用为 a,表单为 f
 * @param code 应用编码或表单编码
 * @param existingMappings 已使用后缀到编码的映射
 * @param isFolderSuffixAvailable 检查文件夹层面后缀是否可用
 */
export function generateCodeSuffix(
  prefix: string,
  code: string,
  existingMappings: Map<string, string>,
  isFolderSuffixAvailable?: (suffix: string) => boolean
): string {
  const hash = createHash('md5')
    .update(code, 'utf8')
    .digest('hex');

  const existingSuffix = Array.from(existingMappings.entries())
    .find(([, existingCode]) => existingCode === code)?.[0];
  if (existingSuffix) {
    return existingSuffix;
  }

  for (let length = 6; length <= hash.length; length++) {
    const suffix = `${prefix}${hash.substring(0, length)}`;
    const hasSuffixConflict = existingMappings.has(suffix);
    const folderSuffixAvailable = !isFolderSuffixAvailable || isFolderSuffixAvailable(suffix);

    if (!hasSuffixConflict && folderSuffixAvailable) {
      existingMappings.set(suffix, code);
      return suffix;
    }
  }

  throw new Error(`无法为编码 ${code} 生成唯一目录后缀`);
}

/**
 * 根据名称和后缀生成文件夹名称
 * @param name 显示名称
 * @param suffix 目录后缀
 */
export function buildFolderName(name: string, suffix: string): string {
  return `${sanitizeFolderName(name)}(${suffix})`;
}

/**
 * 检查路径是否存在
 * @param folderPath 文件夹路径
 * @returns 是否存在
 */
export function folderExists(folderPath: string): boolean {
  try {
    return fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * 创建文件夹(如果不存在)
 * @param folderPath 文件夹路径
 * @returns 创建的文件夹路径
 */
export function createFolder(folderPath: string): string {
  if (!folderExists(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  return folderPath;
}

/**
 * 处理文件夹名称冲突,生成唯一的文件夹名称
 * @param basePath 基础路径
 * @param folderName 期望的文件夹名称
 * @returns 唯一的文件夹路径
 */
export function resolveFolderConflict(basePath: string, folderName: string): string {
  let targetPath = path.join(basePath, folderName);
  let counter = 1;

  while (folderExists(targetPath)) {
    targetPath = path.join(basePath, `${folderName}-${counter}`);
    counter++;
  }

  return targetPath;
}

/**
 * 创建文件夹并处理同名冲突
 * @param basePath 基础路径
 * @param folderName 文件夹名称
 * @returns 创建的文件夹路径和实际使用的名称
 */
export function createFolderWithConflictHandling(
  basePath: string,
  folderName: string
): { folderPath: string; actualName: string } {
  const resolvedPath = resolveFolderConflict(basePath, folderName);
  createFolder(resolvedPath);
  const actualName = path.basename(resolvedPath);

  return {
    folderPath: resolvedPath,
    actualName
  };
}

/**
 * 获取工作区根目录
 * @param currentPath 当前路径
 * @returns 工作区根目录路径
 */
export function getWorkspaceRoot(currentPath?: string): string | undefined {
  // 优先使用 VSCode API 提供的工作区路径
  if (currentPath) {
    return currentPath;
  }

  // 回退到当前文件所在目录
  return process.cwd();
}

/**
 * 获取并创建统一的氚云代码根目录。
 */
export function getCodeFolderPath(workspaceRoot: string): string {
  return path.basename(workspaceRoot) === CODE_FOLDER_NAME
    ? workspaceRoot
    : path.join(workspaceRoot, CODE_FOLDER_NAME);
}

/**
 * 读取文件夹下的所有子文件夹
 * @param folderPath 文件夹路径
 * @returns 子文件夹名称列表
 */
export function listSubfolders(folderPath: string): string[] {
  if (!folderExists(folderPath)) {
    return [];
  }

  try {
    const items = fs.readdirSync(folderPath);
    return items.filter(item => {
      const itemPath = path.join(folderPath, item);
      return fs.statSync(itemPath).isDirectory();
    });
  } catch (error) {
    console.error(`Failed to list subfolders in ${folderPath}:`, error);
    return [];
  }
}
