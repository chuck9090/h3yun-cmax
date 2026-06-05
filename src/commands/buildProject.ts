import * as vscode from 'vscode';
import { h3yunApi } from '../services/h3yunApi';
import { fileService } from '../services/fileService';
import { gitService } from '../services/gitService';
import { showBuildProjectForm } from '../ui/buildProjectForm';
import { CmaxFormEntry } from '../types';

/**
 * 构建项目命令处理器
 */
export async function handleBuildProject(): Promise<void> {
  // 获取工作区根目录
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('请先打开一个工作区文件夹');
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  // 显示输入表单
  const inputData = await showBuildProjectForm();
  
  if (!inputData) {
    return; // 用户取消
  }

  const { appCode, h3Token } = inputData;

  // 设置全局 Token
  h3yunApi.setToken(h3Token);

  let builtAppFolderPath: string | undefined;
  let buildSummary: string | undefined;

  // 显示进度条
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '正在从氚云构建项目',
      cancellable: false
    },
    async (progress) => {
      try {
        // Step 1: 获取应用信息
        progress.report({ message: '正在获取应用信息...', increment: 5 });
        let application;
        try {
          application = await h3yunApi.getApplication(appCode);
        } catch (apiError) {
          const errorMsg = apiError instanceof Error ? apiError.message : String(apiError);
          
          // 检查是否是 Token 失效
          if (errorMsg.includes('401') || errorMsg.includes('认证') || errorMsg.toLowerCase().includes('token')) {
            vscode.window.showErrorMessage(
              'Token 已失效或无效,请重新构建项目并输入新的 Token。\n\n' +
              '获取方法:\n' +
              '1. 在浏览器中登录氚云平台\n' +
              '2. 按 F12 打开开发者工具\n' +
              '3. 切换到 Application/存储 标签\n' +
              '4. 找到 Cookies 中的 h3_token\n' +
              '5. 复制其值并重新运行此命令',
              { modal: true }
            );
            throw new Error('Token 已失效或无效');
          }
          
          throw apiError;
        }

        // Step 2: 创建应用文件夹
        progress.report({ message: `正在创建应用文件夹: ${application.appName}...`, increment: 10 });
        const { folderPath: appFolderPath, suffix: appSuffix } = fileService.createAppFolder(
          workspaceRoot,
          application.appName
        );
        builtAppFolderPath = appFolderPath;

        const appFolderName = `${application.appName}(${appSuffix})`;
        vscode.window.showInformationMessage(`已创建应用文件夹: ${appFolderName}`);

        // Step 3: 获取表单列表
        progress.report({ message: '正在获取表单列表...', increment: 10 });
        const forms = await h3yunApi.getForms(appCode);

        if (forms.length === 0) {
          vscode.window.showWarningMessage('该应用下没有表单');
          fileService.createCmaxConfig(appFolderPath, appCode, application.appName, appSuffix, {});
          fileService.saveToken(appFolderPath, h3Token);
          fileService.ensureGitIgnore(appFolderPath);
          fileService.saveFailedNodesReport(appFolderPath, h3yunApi.consumeLoadFormFailures());
          buildSummary = '项目构建成功! 该应用下没有表单';
          return;
        }

        // Step 4: 循环处理每个表单
        const formsRecord: Record<string, CmaxFormEntry> = {};
        const usedFormSuffixes = new Set<string>();
        const totalForms = forms.length;

        for (let i = 0; i < totalForms; i++) {
          const form = forms[i];

          progress.report({
            message: `正在处理表单 ${i + 1}/${totalForms}: ${form.formName}...`,
            increment: undefined
          });

          try {
            const { folderPath: formFolderPath, suffix: formSuffix } = fileService.createFormFolder(
              appFolderPath,
              form.formName,
              usedFormSuffixes
            );

            const codes = await h3yunApi.getFormAllCodes(form.formCode);
            fileService.saveFormCodes(formFolderPath, codes);

            formsRecord[formSuffix] = {
              formCode: form.formCode,
              formName: form.formName
            };
          } catch (error) {
            console.error(`处理表单 "${form.formName}" 失败:`, error);
            vscode.window.showWarningMessage(`表单 "${form.formName}" 处理失败: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        // Step 5: 创建 cmax.json 配置文件
        progress.report({ message: '正在生成配置文件...', increment: 95 });
        fileService.createCmaxConfig(appFolderPath, appCode, application.appName, appSuffix, formsRecord);
        fileService.saveToken(appFolderPath, h3Token);
        fileService.ensureGitIgnore(appFolderPath);
        fileService.saveFailedNodesReport(appFolderPath, h3yunApi.consumeLoadFormFailures());

        progress.report({ message: '完成!', increment: 100 });

        buildSummary = `项目构建成功! 共处理 ${Object.keys(formsRecord).length}/${totalForms} 个表单`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`构建项目失败: ${errorMessage}`);
        throw error;
      }
    }
  );

  if (!builtAppFolderPath || !buildSummary) {
    return;
  }

  const gitAction = await vscode.window.showInformationMessage(
    `${buildSummary}\n\n是否要自动完成 git init 并提交项目文件?`,
    { modal: true },
    '初始化并提交',
    '跳过'
  );

  if (gitAction !== '初始化并提交') {
    vscode.window.showInformationMessage(buildSummary);
    return;
  }

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '正在初始化 Git 仓库并提交项目文件',
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: '正在执行 git init、git add 和 git commit...' });
        await gitService.initAndCommit(builtAppFolderPath!, '初始化氚云项目');
      }
    );

    vscode.window.showInformationMessage(`${buildSummary}\nGit 仓库已初始化并完成首次提交`);
  } catch (error) {
    vscode.window.showWarningMessage(
      `${buildSummary}\nGit 初始化或提交失败: ${error instanceof Error ? error.message : String(error)}`,
      { modal: true }
    );
  }
}
