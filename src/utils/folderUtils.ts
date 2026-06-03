import * as fs from 'fs';
import * as path from 'path';

const SUFFIX_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';
const SUFFIX_LEN = 5;

/**
 * 生成随机后缀字符串
 * @param prefix 固定前缀 (如 'a' 或 'f')
 */
export function generateRandomSuffix(prefix: string): string {
  let result = prefix;
  for (let i = 0; i < SUFFIX_LEN; i++) {
    result += SUFFIX_CHARS[Math.floor(Math.random() * SUFFIX_CHARS.length)];
  }
  return result;
}

/**
 * 生成唯一的随机后缀,确保不与已有后缀重复
 * @param prefix 固定前缀
 * @param existingSuffixes 已使用的后缀集合
 */
export function generateUniqueSuffix(prefix: string, existingSuffixes: Set<string>): string {
  let suffix = generateRandomSuffix(prefix);
  while (existingSuffixes.has(suffix)) {
    suffix = generateRandomSuffix(prefix);
  }
  existingSuffixes.add(suffix);
  return suffix;
}

/**
 * 根据名称和后缀生成文件夹名称
 * @param name 显示名称
 * @param suffix 随机后缀
 */
export function buildFolderName(name: string, suffix: string): string {
  return `${name}(${suffix})`;
}

/**
 * 检查路径是否存在
 * @param folderPath 文件夹路径
 * @returns 是否存在
 */
export function folderExists(folderPath: string): boolean {
  try {
    return fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory();
  } catch (error) {
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
