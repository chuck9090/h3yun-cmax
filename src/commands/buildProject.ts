import * as vscode from 'vscode';
import * as path from 'path';
import { h3yunApi } from '../services/h3yunApi';
import { fileService } from '../services/fileService';
import { gitService } from '../services/gitService';
import { showBuildProjectForm } from '../ui/buildProjectForm';
import { CmaxFormEntry } from '../types';
import { buildFolderName, CODE_FOLDER_NAME, createFolder, getCodeFolderPath } from '../utils/folderUtils';

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
  const codeFolderPath = getCodeFolderPath(workspaceRoot);
  createFolder(codeFolderPath);

  let presetEngineCode: string | undefined;
  let presetToken: string | undefined;
  if (path.basename(workspaceRoot) === CODE_FOLDER_NAME) {
    let hasWorkspaceConfig = false;
    try {
      const workspaceConfig = fileService.readWorkspaceConfig(codeFolderPath);
      hasWorkspaceConfig = fileService.hasCmaxConfig(codeFolderPath);
      if (hasWorkspaceConfig) {
        const appConfigs = Object.values(workspaceConfig.apps);
        const engineCode = workspaceConfig.engineCode?.trim();
        if (appConfigs.length > 0 && engineCode) {
          presetEngineCode = engineCode;
        }
      }
    } catch {
      // 根配置不存在或无法读取时,继续使用空白构建表单。
    }

    try {
      presetToken = fileService.readToken(codeFolderPath);
    } catch {
      // Token 不存在时由用户在构建表单中输入。
    }

    if (!hasWorkspaceConfig) {
      presetEngineCode = undefined;
      presetToken = undefined;
    }
  }

  // 显示输入表单
  const inputData = await showBuildProjectForm({
    engineCode: presetEngineCode,
    engineCodeReadonly: !!presetEngineCode,
    h3Token: presetToken
  });
  
  if (!inputData) {
    return; // 用户取消
  }

  const { appCode, engineCode, h3Token } = inputData;
  const workspaceConfig = fileService.readWorkspaceConfig(codeFolderPath);
  const hasWorkspaceConfig = fileService.hasCmaxConfig(codeFolderPath);

  // 设置全局认证信息
  h3yunApi.setApiVersion(workspaceConfig.h3yunApiVersion);
  h3yunApi.setToken(h3Token, engineCode);

  let builtAppFolderPath: string | undefined;
  let builtAppName: string | undefined;
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
          codeFolderPath,
          application.appName,
          application.appCode
        );
        builtAppFolderPath = appFolderPath;
        builtAppName = application.appName;

        const appFolderName = `${application.appName}(${appSuffix})`;
        vscode.window.showInformationMessage(`已创建应用文件夹: ${appFolderName}`);

        // Step 3: 获取表单列表
        progress.report({ message: '正在获取表单列表...', increment: 10 });
        const forms = await h3yunApi.getForms(appCode);
        const loadFormFailures = h3yunApi.consumeLoadFormFailures();
        if (loadFormFailures.length > 0) {
          const failureNames = loadFormFailures.map((failure) => failure.name).join('、');
          fileService.saveFailedNodesReport(codeFolderPath, application.appName, loadFormFailures);
          throw new Error(`无法确认以下表单的最新结构: ${failureNames},已取消本次构建`);
        }

        const existingConfig = fileService.readWorkspaceConfig(codeFolderPath).apps[appSuffix];
        if (existingConfig) {
          if (existingConfig.appName !== application.appName) {
            fileService.saveFailedNodesReport(codeFolderPath, existingConfig.appName, []);
          }
          const currentFormCodes = new Set(forms.map((form) => form.formCode));
          for (const [suffix, form] of Object.entries(existingConfig.forms || {})) {
            if (currentFormCodes.has(form.formCode)) continue;
            fileService.deleteFolderIfExists(path.join(appFolderPath, buildFolderName(form.formName, suffix)));
          }
        }

        // 首次构建时查询 System 用户 ID,后续应用复用根配置中的值。
        let systemUserId = workspaceConfig.systemUserId;
        if (!hasWorkspaceConfig && !systemUserId) {
          progress.report({ message: '正在查询 System 用户 ID...', increment: 5 });
          systemUserId = await h3yunApi.getSystemUserId();
          if (!systemUserId) {
            vscode.window.showWarningMessage(
              '无法获取 System 用户 ID,cmax.json 中将不包含 systemUserId 字段。'
            );
          }
        }

        if (forms.length === 0) {
          vscode.window.showWarningMessage('该应用下没有表单');
          fileService.createCmaxConfig(
            codeFolderPath, appSuffix, appCode, engineCode, application.appName, {},
            workspaceConfig.h3yunApiVersion, systemUserId || undefined
          );
          fileService.saveToken(codeFolderPath, h3Token);
          fileService.ensureGitIgnore(codeFolderPath);
           fileService.saveFailedNodesReport(codeFolderPath, application.appName, []);
          buildSummary = '项目构建成功! 该应用下没有表单';
          return;
        }

        // Step 4: 循环处理每个表单
        const formsRecord: Record<string, CmaxFormEntry> = {};
        let existingFormConfig: Record<string, CmaxFormEntry> = {};
        try {
          existingFormConfig = fileService.readCmaxConfig(codeFolderPath, appSuffix).forms || {};
        } catch {
          // 新应用没有既有配置时从空映射开始。
        }
        const usedFormMappings = new Map(
          Object.entries(existingFormConfig)
            .map(([suffix, entry]) => [suffix, entry.formCode] as [string, string])
        );
        const totalForms = forms.length;

        for (let i = 0; i < totalForms; i++) {
          const form = forms[i];

          progress.report({
            message: `正在处理表单 ${i + 1}/${totalForms}: ${form.formName}...`,
            increment: undefined
          });

          try {
            const codes = await h3yunApi.getFormAllCodes(form.formCode);
            const { folderPath: formFolderPath, suffix: formSuffix } = fileService.createFormFolder(
              appFolderPath,
              form.formName,
              form.formCode,
              usedFormMappings
            );
            fileService.saveFormCodes(formFolderPath, codes);

            formsRecord[formSuffix] = {
              formCode: form.formCode,
              formName: form.formName
            };
          } catch (error) {
            console.error(`处理表单 "${form.formName}" 失败:`, error);
            const existingEntry = Object.entries(existingFormConfig)
              .find(([, entry]) => entry.formCode === form.formCode);
            if (existingEntry) {
              formsRecord[existingEntry[0]] = existingEntry[1];
            }
            vscode.window.showWarningMessage(`表单 "${form.formName}" 处理失败: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        // Step 6: 创建 cmax.json 配置文件
        progress.report({ message: '正在生成配置文件...', increment: 90 });
        fileService.createCmaxConfig(
          codeFolderPath, appSuffix, appCode, engineCode, application.appName, formsRecord,
          workspaceConfig.h3yunApiVersion, systemUserId || undefined
        );
        fileService.saveToken(codeFolderPath, h3Token);
        fileService.ensureGitIgnore(codeFolderPath);
         fileService.saveFailedNodesReport(codeFolderPath, application.appName, []);

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

  const repositoryExists = await gitService.hasRepository(codeFolderPath);
  const gitAction = await vscode.window.showInformationMessage(
    `${buildSummary}\n\n是否要提交添加 ${builtAppName} 应用的构建文件?`,
    { modal: true },
    '提交',
    '跳过'
  );

  if (gitAction !== '提交') {
    vscode.window.showInformationMessage(buildSummary);
    return;
  }

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '正在提交应用构建文件',
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: repositoryExists ? '正在执行 git add 和 git commit...' : '正在初始化 Git 仓库并提交...' });
        await gitService.initAndCommit(codeFolderPath, `添加${builtAppName}应用`, builtAppFolderPath!);
      }
    );

    vscode.window.showInformationMessage(
      `${buildSummary}\n应用文件已提交，提交信息：添加${builtAppName}应用`
    );
  } catch (error) {
    vscode.window.showWarningMessage(
      `${buildSummary}\nGit 初始化或提交失败: ${error instanceof Error ? error.message : String(error)}`,
      { modal: true }
    );
  }
}
