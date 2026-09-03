import * as vscode from 'vscode';
import * as path from 'path';
import { h3yunApi } from '../services/h3yunApi';
import { fileService } from '../services/fileService';
import { gitService } from '../services/gitService';
import { CmaxConfig, CmaxFormEntry, FileContentMap } from '../types';
import { buildFolderName, CODE_FOLDER_NAME, listSubfolders } from '../utils/folderUtils';
import { hasFileConflict, generateDiffReport } from '../utils/diffUtils';
import { showDiffPreview } from '../ui/diffPreview';
import { showBuildProjectForm } from '../ui/buildProjectForm';
import { promptForCommitMessage } from '../ui/gitCommitPrompt';
import { promptForUpdateGuide } from '../ui/updateGuide';
import { 
  showBatchConflictDialog, 
  ConflictResolution, 
  BatchConflictResolution,
  FileConflict 
} from '../ui/conflictDialog';

async function promptForTokenWithProjectInfo(config: CmaxConfig, message: string): Promise<string | undefined> {
  const input = await showBuildProjectForm({
    title: '重新输入 h3_token',
    description: message,
    submitLabel: '继续同步',
    appCode: config.appCode,
    engineCode: config.engineCode,
    apiVersion: config.h3yunApiVersion,
    appCodeReadonly: true,
    engineCodeReadonly: true
  });

  return input?.h3Token;
}

/**
 * 提示用户输入企业引擎编码
 */
async function promptForEngineCode(message: string): Promise<string | undefined> {
  const result = await vscode.window.showWarningMessage(
    message,
    { modal: true },
    '输入企业引擎编码'
  );

  if (result === '输入企业引擎编码') {
    const engineCode = await vscode.window.showInputBox({
      prompt: '请输入氚云企业引擎编码 enginecode',
      placeHolder: '系统管理 > 系统集成中的企业引擎编码',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return '企业引擎编码不能为空';
        }
        return null;
      },
      ignoreFocusOut: true
    });

    return engineCode?.trim();
  }

  return undefined;
}

async function ensureEngineCode(config: CmaxConfig, appFolderPath: string): Promise<string | undefined> {
  if (config.engineCode && config.engineCode.trim()) {
    return config.engineCode.trim();
  }

  const engineCode = await promptForEngineCode('当前项目缺少企业引擎编码 enginecode,请补充后继续同步。');
  if (!engineCode) {
    return undefined;
  }

  config.engineCode = engineCode;
  fileService.createCmaxConfig(
    appFolderPath,
    config.appCode,
    config.engineCode,
    config.appName,
    config.appSuffix || '',
    config.forms,
    config.h3yunApiVersion,
    config.systemUserId
  );

  return engineCode;
}

async function promptAndCommit(codeFolderPath: string, appFolderPath: string, summary: string): Promise<void> {
  const commitMessage = await promptForCommitMessage(summary);
  if (!commitMessage) {
    return;
  }

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '正在提交本次同步变更',
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: '正在执行 git add 和 git commit...' });
        await gitService.initAndCommit(codeFolderPath, commitMessage, appFolderPath);
      }
    );

    vscode.window.showInformationMessage('本次同步变更已提交');
  } catch (error) {
    vscode.window.showWarningMessage(
      `Git 提交失败: ${error instanceof Error ? error.message : String(error)}`,
      { modal: true }
    );
  }
}

/**
 * 处理单个文件的冲突
 * @param localPath 本地文件路径
 * @param remoteContent 远程内容
 * @param formName 表单名称
 * @param filename 文件名
 * @param batchResolution 批量解决方案(如果有)
 * @returns 最终使用的内容,null 表示跳过
 */
async function handleFileConflict(
  localPath: string,
  remoteContent: string,
  formName: string,
  filename: string,
  batchResolution: BatchConflictResolution | null
): Promise<string | null> {
  // 读取本地文件
  let localContent: string;
  try {
    localContent = fileService.readFile(localPath);
  } catch {
    // 文件不存在,直接使用远程版本
    return remoteContent;
  }

  // 检查是否有差异
  if (!hasFileConflict(localContent, remoteContent)) {
    // 没有差异,无需处理
    return null; // null 表示不需要更新
  }

  // 有冲突,根据批量策略处理
  if (batchResolution === BatchConflictResolution.USE_LOCAL_ALL) {
    return null; // 使用本地版本,不更新
  }

  if (batchResolution === BatchConflictResolution.USE_REMOTE_ALL) {
    return remoteContent; // 使用远程版本
  }

  // 逐个询问
  const diffReport = generateDiffReport(localContent, remoteContent, filename);
  const conflict: FileConflict = {
    formName,
    filename,
    localPath,
    diffReport
  };

  const resolution = await showDiffPreview({
    ...conflict,
    localContent,
    remoteContent
  });

  if (resolution === ConflictResolution.USE_LOCAL || resolution === null) {
    return null; // 使用本地版本或取消
  } else if (resolution === ConflictResolution.USE_REMOTE) {
    return remoteContent; // 使用远程版本
  } else {
    return null; // 跳过
  }
}

/**
 * 在表单记录中根据 formCode 查找条目
 */
function findFormByCode(
  forms: Record<string, CmaxFormEntry>,
  formCode: string
): { suffix: string; entry: CmaxFormEntry } | undefined {
  for (const [suffix, entry] of Object.entries(forms)) {
    if (entry.formCode === formCode) {
      return { suffix, entry };
    }
  }
  return undefined;
}

async function syncAppFolderName(appFolderPath: string, config: CmaxConfig): Promise<string> {
  const latestApplication = await h3yunApi.getApplication(config.appCode);

  if (config.appSuffix && latestApplication.appName !== config.appName) {
    const renamedFolderPath = fileService.renameFolderWithSuffix(appFolderPath, latestApplication.appName, config.appSuffix);
    config.appName = latestApplication.appName;
    return renamedFolderPath;
  }

  config.appName = latestApplication.appName;
  return appFolderPath;
}

/**
 * 同步项目命令处理器
 * @param uri 选中的文件夹 URI(从右键菜单传入)
 */
export async function handleSyncProject(uri?: vscode.Uri): Promise<void> {
  let appFolderPath: string;
  let codeFolderPath: string;
  let syncSummary: string | undefined;

  // 获取应用文件夹路径
  if (uri) {
    appFolderPath = uri.fsPath;
  } else {
    // 如果没有传入 URI,尝试从活动编辑器或工作区推断
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      appFolderPath = activeEditor.document.uri.fsPath;
    } else {
      vscode.window.showErrorMessage('请右键点击应用文件夹执行同步操作');
      return;
    }
  }

  // 检查是否包含 cmax.json
  if (!fileService.hasCmaxConfig(appFolderPath)) {
    vscode.window.showErrorMessage('所选文件夹不是有效的氚云应用文件夹(缺少 cmax.json)');
    return;
  }

  // 读取配置
  let config: CmaxConfig;
  try {
    config = fileService.readCmaxConfig(appFolderPath);
  } catch (error) {
    vscode.window.showErrorMessage(`读取配置文件失败: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  if (path.basename(path.dirname(appFolderPath)) !== CODE_FOLDER_NAME) {
    await promptForUpdateGuide(
      '当前应用不在“氚云代码”目录下，可能仍在使用旧版目录方案。请查看更新指南，并重新构建一次项目。'
    );
    return;
  }
  codeFolderPath = path.dirname(appFolderPath);
  fileService.ensureGitIgnore(codeFolderPath);

  // 每次同步开始时清理上一次同步留下的失败报告,本次如有异常会重新生成。
  fileService.deleteFileIfExists(path.join(appFolderPath, 'failed-nodes.md'));

  const engineCode = await ensureEngineCode(config, appFolderPath);
  if (!engineCode) {
    vscode.window.showInformationMessage('已取消同步');
    return;
  }

  let h3Token: string;
  try {
    h3Token = fileService.readToken(codeFolderPath);
  } catch (error) {
    await promptForUpdateGuide(
      '“氚云代码”目录下没有可用的 .h3token 文件，可能仍在使用旧版目录方案。请查看更新指南，并重新构建一次项目。'
    );
    const token = await promptForTokenWithProjectInfo(
      config,
      `当前项目缺少可用的 .h3token 文件,请重新输入 Token。\n\n${error instanceof Error ? error.message : String(error)}`
    );

    if (!token) {
      vscode.window.showInformationMessage('已取消同步');
      return;
    }

    fileService.saveToken(codeFolderPath, token);
    fileService.ensureGitIgnore(codeFolderPath);
    h3Token = token;
  }

  // 设置认证信息
  h3yunApi.setApiVersion(config.h3yunApiVersion);
  h3yunApi.setToken(h3Token, engineCode);

  // 如果 cmax.json 中没有 systemUserId,尝试查询并保存
  if (!config.systemUserId) {
    try {
      const systemUserId = await h3yunApi.getSystemUserId();
      if (systemUserId) {
        config.systemUserId = systemUserId;
        fileService.createCmaxConfig(
          appFolderPath,
          config.appCode,
          config.engineCode,
          config.appName,
          config.appSuffix || '',
          config.forms,
          config.h3yunApiVersion,
          config.systemUserId
        );
      }
    } catch {
      // 查询失败不影响同步流程
    }
  }

  try {
    appFolderPath = await syncAppFolderName(appFolderPath, config);
  } catch (error) {
    vscode.window.showWarningMessage(`获取或更新应用名称失败: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 显示进度条
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `正在同步应用: ${config.appName}`,
      cancellable: false
    },
    async (progress) => {
      try {
        progress.report({ message: '正在验证 Token 并获取最新数据...', increment: 5 });

        // Step 1: 获取最新的表单列表
        let forms;
        const knownFormCodes = new Set(
          Object.values(config.forms).map((form) => form.formCode)
        );
        try {
          forms = await h3yunApi.getForms(config.appCode, knownFormCodes);
        } catch (apiError) {
          const errorMsg = apiError instanceof Error ? apiError.message : String(apiError);
          
          // 检查是否是 Token 失效
          if (errorMsg.includes('401') || errorMsg.includes('认证') || errorMsg.includes('token') || errorMsg.includes('Token')) {
            // 提示用户重新输入 Token
            const newToken = await promptForTokenWithProjectInfo(config, 'Token 已失效,请重新输入 h3_token 后继续同步');
            
            if (!newToken) {
              throw new Error('已取消同步');
            }

            // 更新 Token 并重试
            h3yunApi.setToken(newToken, engineCode);
            fileService.saveToken(codeFolderPath, newToken);
            fileService.ensureGitIgnore(codeFolderPath);
            
            progress.report({ message: '正在使用新 Token 重新获取数据...', increment: 5 });
            forms = await h3yunApi.getForms(config.appCode, knownFormCodes);
          } else {
            throw apiError;
          }
        }

        appFolderPath = await syncAppFolderName(appFolderPath, config);
        const loadFormFailures = h3yunApi.consumeLoadFormFailures();

        if (loadFormFailures.length > 0) {
          const failureNames = loadFormFailures.map((failure) => failure.name).join('、');
          fileService.saveFailedNodesReport(appFolderPath, loadFormFailures);
          vscode.window.showWarningMessage(
            `本次同步无法确认以下表单的最新结构: ${failureNames}\n请重试同步,本次不会删除任何表单文件夹。`,
            { modal: true }
          );
          throw new Error('表单列表获取异常,已取消本次同步');
        }

        if (forms.length === 0) {
          vscode.window.showWarningMessage('该应用下没有表单');
          fileService.createCmaxConfig(
            appFolderPath,
            config.appCode,
            config.engineCode,
            config.appName,
            config.appSuffix || '',
            config.forms,
            config.h3yunApiVersion,
            config.systemUserId
          );
          fileService.updateLastSyncTime(appFolderPath);
          fileService.saveFailedNodesReport(appFolderPath, loadFormFailures);
          syncSummary = '同步完成! 该应用下没有表单';
          return;
        }

        // Step 2: 预先检测所有冲突
        progress.report({ message: '正在检测文件差异...', increment: 10 });

        for (const form of forms) {
          const existingEntry = findFormByCode(config.forms, form.formCode);
          if (!existingEntry || existingEntry.entry.formName === form.formName) continue;

          const currentFormFolderPath = path.join(
            appFolderPath,
            buildFolderName(existingEntry.entry.formName, existingEntry.suffix)
          );
          fileService.renameFolderWithSuffix(currentFormFolderPath, form.formName, existingEntry.suffix);
          existingEntry.entry.formName = form.formName;
        }
        
        // 首先获取所有表单的代码以便检测冲突
        const formCodesMap = new Map<string, FileContentMap>();
        for (const form of forms) {
          try {
            const codes = await h3yunApi.getFormAllCodes(form.formCode);
            formCodesMap.set(form.formCode, codes);
          } catch (error) {
            console.error(`获取表单 "${form.formName}" 代码失败:`, error);
          }
        }

        // 检测冲突数量
        let conflictCount = 0;
        for (const form of forms) {
          const existingEntry = findFormByCode(config.forms, form.formCode);
          if (!existingEntry) continue;

          const formFolderPath = path.join(appFolderPath, buildFolderName(existingEntry.entry.formName, existingEntry.suffix));
          const codes = formCodesMap.get(form.formCode);
          if (!codes) continue;

          for (const [filename, remoteContent] of Object.entries(codes)) {
            if (filename === 'fields.md') continue;

            const localPath = path.join(formFolderPath, filename);
            try {
              const localContent = fileService.readFile(localPath);
              if (hasFileConflict(localContent, remoteContent)) {
                conflictCount++;
              }
            } catch {
              // 文件不存在,不算冲突
            }
          }
        }

        // 如果有冲突,询问用户如何处理
        let batchResolution: BatchConflictResolution | null = null;
        if (conflictCount > 0) {
          batchResolution = await showBatchConflictDialog(conflictCount);
          
          if (batchResolution === null) {
            // 用户取消
            vscode.window.showInformationMessage('已取消同步');
            return;
          }
        }

        // Step 3: 循环处理每个表单
        const updatedFormsRecord: Record<string, CmaxFormEntry> = {};
        const usedFormSuffixes = new Set(Object.keys(config.forms));
        const totalForms = forms.length;
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < totalForms; i++) {
          const form = forms[i];

          progress.report({
            message: `正在同步表单 ${i + 1}/${totalForms}: ${form.formName}...`,
            increment: undefined
          });

          try {
            let formFolderPath: string;
            let formSuffix: string;
            const existingEntry = findFormByCode(config.forms, form.formCode);

            if (existingEntry) {
              formSuffix = existingEntry.suffix;
              formFolderPath = path.join(appFolderPath, buildFolderName(existingEntry.entry.formName, formSuffix));
            } else {
              const result = fileService.createFormFolder(appFolderPath, form.formName, usedFormSuffixes);
              formFolderPath = result.folderPath;
              formSuffix = result.suffix;
            }

            const codes = formCodesMap.get(form.formCode);
            if (!codes) {
              throw new Error('无法获取表单代码');
            }

            for (const [filename, remoteContent] of Object.entries(codes)) {
              const localPath = path.join(formFolderPath, filename);

              if (filename === 'fields.md') {
                fileService.deleteFileIfExists(path.join(formFolderPath, 'fields.json'));
                fileService.saveFile(localPath, remoteContent);
              } else {
                const finalContent = await handleFileConflict(
                  localPath,
                  remoteContent,
                  form.formName,
                  filename,
                  batchResolution
                );

                if (finalContent !== null && finalContent !== undefined) {
                  fileService.saveFile(localPath, finalContent);
                } else if (finalContent === null && !fileService.fileExists(localPath)) {
                  fileService.saveFile(localPath, remoteContent);
                }
              }
            }

            updatedFormsRecord[formSuffix] = {
              formCode: form.formCode,
              formName: form.formName
            };

            successCount++;
          } catch (error) {
            console.error(`同步表单 "${form.formName}" 失败:`, error);
            const existingEntry = findFormByCode(config.forms, form.formCode);
            if (existingEntry) {
              // 同步失败时保留既有映射，避免下次同步把该目录当成已删除表单。
              updatedFormsRecord[existingEntry.suffix] = existingEntry.entry;
            }
            failCount++;
            vscode.window.showWarningMessage(
              `表单 "${form.formName}" 同步失败: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }

        let deletedFormCount = 0;
        if (failCount === 0) {
          // 已知表单的 LoadForm 异常会提前终止同步,这里仅清理明确不在节点列表中的旧目录。
          const latestFormCodes = new Set(forms.map((form) => form.formCode));
          const deletedFormSuffixes = new Set(
            Object.entries(config.forms)
              .filter(([, entry]) => !latestFormCodes.has(entry.formCode))
              .map(([suffix]) => suffix)
          );

          for (const folderName of listSubfolders(appFolderPath)) {
            const suffixMatch = folderName.match(/\((f[0-9a-z]{5})\)$/);
            if (!suffixMatch || !deletedFormSuffixes.has(suffixMatch[1])) continue;

            fileService.deleteFolderIfExists(path.join(appFolderPath, folderName));
            deletedFormCount++;
          }
        }

        // Step 4: 更新 cmax.json 配置文件
        progress.report({ message: '正在更新配置文件...', increment: 95 });
        fileService.createCmaxConfig(
          appFolderPath,
          config.appCode,
          config.engineCode,
          config.appName,
          config.appSuffix || '',
          updatedFormsRecord,
          config.h3yunApiVersion,
          config.systemUserId
        );
        fileService.updateLastSyncTime(appFolderPath);
        fileService.saveFailedNodesReport(appFolderPath, loadFormFailures);

        progress.report({ message: '完成!', increment: 100 });

        // 显示同步结果
        const deletedSummary = deletedFormCount > 0 ? `, 删除表单: ${deletedFormCount}` : '';
        const summary = `同步完成! 成功: ${successCount}, 失败: ${failCount}, 总计: ${totalForms}${deletedSummary}`;
        syncSummary = summary;
        
        if (failCount === 0) {
          vscode.window.showInformationMessage(summary);
        } else {
          vscode.window.showWarningMessage(summary);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`同步失败: ${errorMessage}`);
        throw error;
      }
    }
  );

  if (syncSummary && await gitService.hasChangesExcludingCmaxConfig(codeFolderPath, appFolderPath)) {
    await promptAndCommit(codeFolderPath, appFolderPath, syncSummary);
  }
}
