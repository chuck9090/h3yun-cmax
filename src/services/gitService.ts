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
}

// 导出单例实例
export const gitService = new GitService();
