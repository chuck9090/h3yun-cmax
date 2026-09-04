import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execFileAsync = promisify(execFile);

/**
 * Git 操作服务类
 */
export class GitService {
  async hasRepository(repositoryPath: string): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], {
        cwd: repositoryPath,
        maxBuffer: 1024 * 1024
      });
      return path.resolve(stdout.trim()) === path.resolve(repositoryPath);
    } catch {
      return false;
    }
  }
  private getRelativePath(repositoryPath: string, targetFolderPath?: string): string {
    const target = targetFolderPath
      ? path.relative(repositoryPath, targetFolderPath) || '.'
      : '.';
    return target.replace(/\\/g, '/');
  }

  private async ensureNoUnrelatedStagedChanges(
    repositoryPath: string,
    targetFolderPath?: string
  ): Promise<void> {
    const target = this.getRelativePath(repositoryPath, targetFolderPath);
    const allowedPaths = target === '.'
      ? new Set(['.gitignore', 'cmax.json'])
      : new Set([target, '.gitignore', 'cmax.json']);
    const { stdout } = await execFileAsync(
      'git',
      ['diff', '--cached', '--name-only'],
      { cwd: repositoryPath, maxBuffer: 1024 * 1024 * 10 }
    );
    const unrelatedPaths = stdout
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => {
        const normalized = item.replace(/\\/g, '/');
        return !Array.from(allowedPaths).some((allowed) => (
          normalized === allowed || (allowed !== '.gitignore' && normalized.startsWith(`${allowed}/`))
        ));
      });

    if (unrelatedPaths.length > 0) {
      throw new Error(
        `检测到其他路径已有暂存变更,为避免误提交已停止本次 Git 提交:\n${unrelatedPaths.join('\n')}`
      );
    }
  }

  private async runGit(args: string[], cwd: string): Promise<void> {
    try {
      await execFileAsync('git', args, {
        cwd,
        maxBuffer: 1024 * 1024 * 10
      });
    } catch (error: unknown) {
      const errorDetails = error as { stderr?: string; stdout?: string; message?: string };
      const details = [errorDetails.stderr, errorDetails.stdout, errorDetails.message]
        .filter(Boolean)
        .join('\n')
        .trim();
      throw new Error(details || `Git 命令执行失败: git ${args.join(' ')}`);
    }
  }

  /**
   * 初始化 Git 仓库并提交当前项目文件
   * @param projectFolderPath 项目文件夹路径
   * @param commitMessage 提交信息
   */
  async initAndCommit(
    repositoryPath: string,
    commitMessage: string,
    targetFolderPath?: string
  ): Promise<void> {
    if (!(await this.hasRepository(repositoryPath))) {
      await this.runGit(['init'], repositoryPath);
    }
    await this.ensureNoUnrelatedStagedChanges(repositoryPath, targetFolderPath);
    const target = this.getRelativePath(repositoryPath, targetFolderPath);
    const addPaths = target === '.' ? ['.gitignore', '.'] : ['.gitignore', 'cmax.json', target];
    await this.runGit(['add', '--', ...addPaths], repositoryPath);
    await this.runGit(['commit', '-m', commitMessage], repositoryPath);
  }

  /**
   * 检查当前应用代码或根 cmax.json 是否存在工作区变更。
   */
  async hasChangesExcludingCmaxConfig(
    repositoryPath: string,
    targetFolderPath?: string
  ): Promise<boolean> {
    const target = this.getRelativePath(repositoryPath, targetFolderPath);
    try {
      const { stdout } = await execFileAsync(
        'git',
        [
          'status',
          '--porcelain',
          '--untracked-files=all',
          '--',
          target,
           '.gitignore',
           'cmax.json'
        ],
        {
          cwd: repositoryPath,
          maxBuffer: 1024 * 1024 * 10
        }
      );

      return stdout.trim().length > 0;
    } catch {
      // 尚未初始化 Git 时仍提示用户，以便保留首次提交能力。
      return true;
    }
  }
}

// 导出单例实例
export const gitService = new GitService();
