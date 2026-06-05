import * as crypto from 'crypto';

/**
 * 计算字符串的 MD5 哈希值
 * @param content 字符串内容
 * @returns MD5 哈希值
 */
export function calculateMD5(content: string): string {
  return crypto.createHash('md5').update(content, 'utf-8').digest('hex');
}

/**
 * 比较两个字符串是否相同
 * @param content1 第一个字符串
 * @param content2 第二个字符串
 * @returns 是否相同
 */
export function isContentDifferent(content1: string, content2: string): boolean {
  // 去除首尾空白后比较
  const normalized1 = content1.trim();
  const normalized2 = content2.trim();
  
  return normalized1 !== normalized2;
}

/**
 * 比较两个文件的差异
 * @param localContent 本地文件内容
 * @param remoteContent 远程文件内容
 * @returns 是否有差异
 */
export function hasFileConflict(localContent: string, remoteContent: string): boolean {
  return isContentDifferent(localContent, remoteContent);
}

/**
 * 计算两个数组的 LCS（最长公共子序列）长度表
 */
function buildLCSTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

/**
 * 基于 LCS 计算实际的新增行数和删除行数
 * @param localLines 本地行数组
 * @param remoteLines 远程行数组
 * @returns { added: 远程新增行数, removed: 本地删除行数 }
 */
function diffLines(localLines: string[], remoteLines: string[]): { added: number; removed: number } {
  const dp = buildLCSTable(localLines, remoteLines);
  const lcsLength = dp[localLines.length][remoteLines.length];

  return {
    added: remoteLines.length - lcsLength,
    removed: localLines.length - lcsLength
  };
}

/**
 * 生成差异报告
 * @param localContent 本地内容
 * @param remoteContent 远程内容
 * @param filename 文件名
 * @returns 差异报告
 */
export function generateDiffReport(
  localContent: string,
  remoteContent: string,
  filename: string
): DiffReport {
  const localLines = localContent.split('\n');
  const remoteLines = remoteContent.split('\n');

  const { added, removed } = diffLines(localLines, remoteLines);

  return {
    filename,
    hasConflict: hasFileConflict(localContent, remoteContent),
    localSize: localContent.length,
    remoteSize: remoteContent.length,
    localLines: localLines.length,
    remoteLines: remoteLines.length,
    addedLines: added,
    removedLines: removed,
    localMD5: calculateMD5(localContent),
    remoteMD5: calculateMD5(remoteContent)
  };
}

/**
 * 差异报告
 */
export interface DiffReport {
  filename: string;
  hasConflict: boolean;
  localSize: number;
  remoteSize: number;
  localLines: number;
  remoteLines: number;
  addedLines: number;
  removedLines: number;
  localMD5: string;
  remoteMD5: string;
}
