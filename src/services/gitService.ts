import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Git 操作服务类
 */
export class GitService {
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
  async initAndCommit(projectFolderPath: string, commitMessage: string): Promise<void> {
    await this.runGit(['init'], projectFolderPath);
    await this.runGit(['add', '.'], projectFolderPath);
    await this.runGit(['commit', '-m', commitMessage], projectFolderPath);
  }

  /**
   * 检查是否存在 cmax.json 以外的工作区变更。
   */
  async hasChangesExcludingCmaxConfig(projectFolderPath: string): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['status', '--porcelain', '--untracked-files=all', '--', '.', ':(exclude)cmax.json'],
        {
          cwd: projectFolderPath,
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
