import * as vscode from 'vscode';
import * as path from 'path';
import { h3yunApi } from '../services/h3yunApi';
import { fileService } from '../services/fileService';
import { gitService } from '../services/gitService';
import { saveProjectReadme } from '../services/projectReadme';
import { CmaxConfig, CmaxFormEntry, CmaxWorkspaceConfig, FileContentMap, SyncScope } from '../types';
import { collectAllFieldLabels } from '../services/fieldLabelService';
import {
  AUTOMATION_FILENAME,
  buildAutomationMarkdown,
  buildEmptyAutomationMarkdown
} from '../services/automationReport';
import { buildFolderName, CODE_FOLDER_NAME, listSubfolders } from '../utils/folderUtils';
import { mapWithConcurrency } from '../utils/promiseUtils';
import { FORM_REQUEST_CONCURRENCY } from '../constants/concurrency';
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

async function promptForTokenWithProjectInfo(config: CmaxConfig, workspaceConfig: CmaxWorkspaceConfig, message: string): Promise<string | undefined> {
  const input = await showBuildProjectForm({
    title: '重新输入 h3_token',
    description: message,
    submitLabel: '继续同步',
    appCode: config.appCode,
    engineCode: workspaceConfig.engineCode,
    apiVersion: workspaceConfig.h3yunApiVersion,
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

async function ensureEngineCode(workspaceConfig: CmaxWorkspaceConfig, codeFolderPath: string): Promise<string | undefined> {
  if (workspaceConfig.engineCode && workspaceConfig.engineCode.trim()) {
    return workspaceConfig.engineCode.trim();
  }

  const engineCode = await promptForEngineCode('当前项目缺少企业引擎编码 enginecode,请补充后继续同步。');
  if (!engineCode) {
    return undefined;
  }

  workspaceConfig.engineCode = engineCode;
  fileService.saveWorkspaceConfig(codeFolderPath, workspaceConfig);

  return engineCode;
}

async function promptAndCommit(codeFolderPath: string, appFolderPath: string, summary: string, appName: string): Promise<void> {
  const commitMessage = await promptForCommitMessage(summary, appName);
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

async function syncAppFolderName(
  appFolderPath: string,
  codeFolderPath: string,
  appSuffix: string,
  config: CmaxConfig,
  workspaceConfig: CmaxWorkspaceConfig
): Promise<string> {
  const latestApplication = await h3yunApi.getApplication(config.appCode);

  if (latestApplication.appName !== config.appName) {
    fileService.saveFailedNodesReport(codeFolderPath, config.appName, []);
    const renamedFolderPath = fileService.renameFolderWithSuffix(appFolderPath, latestApplication.appName, appSuffix);
    config.appName = latestApplication.appName;
    fileService.createCmaxConfig(
      codeFolderPath,
      appSuffix,
      config.appCode,
      workspaceConfig.engineCode || '',
      config.appName,
      config.forms,
       workspaceConfig.h3yunApiVersion,
       workspaceConfig.systemUserId
    );
    return renamedFolderPath;
  }

  config.appName = latestApplication.appName;
  return appFolderPath;
}

/**
 * 各同步范围在提示文案中的名称
 */
const SYNC_SCOPE_LABELS: Record<SyncScope, string> = {
  all: '表单设计与代码',
  formDesign: '表单设计',
  code: '代码',
  automation: '自动化'
};

/**
 * 获取同步范围的中文名称
 */
function getScopeLabel(scope: SyncScope): string {
  return SYNC_SCOPE_LABELS[scope];
}

/**
 * 在应用目录下按表单后缀查找实际存在的表单目录。
 * 同步代码时不重命名目录,目录名可能与 cmax.json 中的表单名称不一致,
 * 因此必须按后缀定位真实目录,避免按名称拼路径时写出重复目录。
 */
function findFormFolderBySuffix(appFolderPath: string, suffix: string): string | undefined {
  const suffixPattern = `(${suffix})`;
  const folderName = listSubfolders(appFolderPath).find((name) => name.endsWith(suffixPattern));
  return folderName ? path.join(appFolderPath, folderName) : undefined;
}

/**
 * 同步项目命令处理器
 * @param uri 选中的文件夹 URI(从右键菜单传入)
 * @param scope 同步范围,默认同步表单设计与代码
 */
export async function handleSyncProject(uri?: vscode.Uri, scope: SyncScope = 'all'): Promise<void> {
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
  if (path.basename(path.dirname(appFolderPath)) !== CODE_FOLDER_NAME) {
    vscode.window.showErrorMessage('所选文件夹不是有效的氚云应用文件夹(不在氚云代码目录下)');
    return;
  }

  codeFolderPath = path.dirname(appFolderPath);
  const appSuffixMatch = path.basename(appFolderPath).match(/\((a[0-9a-z]{5,32})\)$/);
  if (!appSuffixMatch) {
    vscode.window.showErrorMessage('所选文件夹不是有效的氚云应用文件夹(缺少应用后缀)');
    return;
  }
  const appSuffix = appSuffixMatch[1];
  if (!fileService.hasCmaxConfig(codeFolderPath)) {
    vscode.window.showErrorMessage('所选氚云代码目录缺少 cmax.json');
    return;
  }

  // 读取配置
  let config: CmaxConfig;
  let workspaceConfig: CmaxWorkspaceConfig;
  try {
    workspaceConfig = fileService.readWorkspaceConfig(codeFolderPath);
    config = fileService.readCmaxConfig(codeFolderPath, appSuffix);
  } catch (error) {
    vscode.window.showErrorMessage(`读取配置文件失败: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  fileService.ensureGitIgnore(codeFolderPath);

  // 每次同步开始时清理上一次同步留下的失败报告,本次如有异常会重新生成。
  fileService.saveFailedNodesReport(codeFolderPath, config.appName, []);

  const engineCode = await ensureEngineCode(workspaceConfig, codeFolderPath);
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
      workspaceConfig,
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
  h3yunApi.setApiVersion(workspaceConfig.h3yunApiVersion);
  h3yunApi.setToken(h3Token, engineCode);

  try {
    appFolderPath = await syncAppFolderName(appFolderPath, codeFolderPath, appSuffix, config, workspaceConfig);
  } catch (error) {
    vscode.window.showWarningMessage(`获取或更新应用名称失败: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 显示进度条。整体同步保持原有标题,分项同步在标题中标明范围。
  const scopeLabel = getScopeLabel(scope);
  // 用于“获取表单××失败”这类拼接文案,避免出现“表单表单设计”这类重复。
  // 控制台沿用改前文案(all 下为“代码”),抛错文案保持改前的“表单代码”。
  const contentLabel = scope === 'automation'
    ? '自动化'
    : (scope === 'formDesign' ? '表单设计' : '代码');
  const fetchLabel = scope === 'formDesign' ? '表单设计' : '表单代码';
  // 只有整体同步和“同步表单设计”按氚云最新表单列表处理应用下表单的增减:
  // 新增表单建目录、重命名变更名称的表单、清理已删除的表单。
  // “同步代码”“同步自动化”只处理本地已有表单目录,不新增、不重命名、不删除任何表单目录。
  const handlesStructure = scope !== 'code' && scope !== 'automation';
  const progressTitle = scope === 'all'
    ? `正在同步应用: ${config.appName}`
    : `正在同步${scopeLabel}: ${config.appName}`;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: progressTitle,
      cancellable: false
    },
    async (progress) => {
      try {
        progress.report({ message: '正在验证 Token 并获取最新数据...', increment: 5 });

        // 同步自动化只需要自动化配置本身，不需要表单列表与表单结构。
        // 必须放在 getForms 之前：getForms 会为应用下每个表单各发一次 LoadForm 请求（并发 10），
        // 表单多的应用会瞬间产生几十个并发请求，而写 automation.md 完全用不到这些数据。
        // 放在这里后，同步自动化对每个应用只发 1 次请求，并发压力最小。
        if (scope === 'automation') {
          progress.report({ message: '正在获取自动化配置...', increment: 20 });

          const labels = collectAllFieldLabels(codeFolderPath);
          const fetchAutomations = () => h3yunApi.getAutomations(config.appCode, labels);

          let result: Awaited<ReturnType<typeof h3yunApi.getAutomations>>;
          try {
            result = await fetchAutomations();
          } catch (apiError) {
            const errorMsg = apiError instanceof Error ? apiError.message : String(apiError);

            // Token 失效时提示重新输入，与表单同步的处理保持一致
            if (!/401|认证|token/i.test(errorMsg)) {
              throw apiError;
            }

            const newToken = await promptForTokenWithProjectInfo(
              config,
              workspaceConfig,
              'Token 已失效,请重新输入 h3_token 后继续同步'
            );

            if (!newToken) {
              throw new Error('已取消同步');
            }

            h3yunApi.setToken(newToken, engineCode);
            fileService.saveToken(codeFolderPath, newToken);
            fileService.ensureGitIgnore(codeFolderPath);

            progress.report({ message: '正在使用新 Token 重新获取自动化配置...', increment: 10 });
            result = await fetchAutomations();
          }

          const { formAutomations } = result;
          progress.report({ message: '正在写入 automation.md...', increment: 50 });

          // 以接口返回的自动化分组为准,只写入本地已存在目录的表单。
          const suffixByFormCode = new Map(
            Object.entries(config.forms).map(([suffix, entry]) => [entry.formCode, suffix])
          );

          let writtenCount = 0;
          let emptyCount = 0;
          let skippedCount = 0;

          for (const form of formAutomations) {
            const suffix = suffixByFormCode.get(form.schemaCode);
            const formFolderPath = suffix ? findFormFolderBySuffix(appFolderPath, suffix) : undefined;

            if (!suffix || !formFolderPath) {
              console.log(`同步自动化跳过本地不存在的表单目录: ${form.formName}(${form.schemaCode})`);
              skippedCount++;
              continue;
            }

            // buildAutomationMarkdown 内部已处理“没有自动化”的情况,无需再分支
            fileService.saveFile(
              path.join(formFolderPath, AUTOMATION_FILENAME),
              buildAutomationMarkdown(form)
            );
            writtenCount++;
            if (form.automations.length === 0) {
              emptyCount++;
            }
          }

          // 本地有目录但氚云侧已无自动化记录的表单,写入“没有自动化”的说明,避免残留旧内容。
          const handledCodes = new Set(formAutomations.map((form) => form.schemaCode));
          for (const [suffix, entry] of Object.entries(config.forms)) {
            if (handledCodes.has(entry.formCode)) continue;

            const formFolderPath = findFormFolderBySuffix(appFolderPath, suffix);
            if (!formFolderPath) continue;

            fileService.saveFile(
              path.join(formFolderPath, AUTOMATION_FILENAME),
              buildEmptyAutomationMarkdown(entry.formName, entry.formCode)
            );
            writtenCount++;
            emptyCount++;
          }

          fileService.updateLastSyncTime(codeFolderPath, appSuffix);

          const totalCount = formAutomations.reduce((sum, form) => sum + form.automations.length, 0);
          const skippedSummary = skippedCount > 0 ? `, 跳过本地未同步的表单: ${skippedCount}` : '';
          const summary = `自动化同步完成! 表单: ${writtenCount}, 自动化: ${totalCount}, 无自动化表单: ${emptyCount}${skippedSummary}`;
          syncSummary = summary;
          vscode.window.showInformationMessage(summary);
          return;
        }

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
            const newToken = await promptForTokenWithProjectInfo(config, workspaceConfig, 'Token 已失效,请重新输入 h3_token 后继续同步');
            
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

        appFolderPath = await syncAppFolderName(appFolderPath, codeFolderPath, appSuffix, config, workspaceConfig);
        const loadFormFailures = h3yunApi.consumeLoadFormFailures();

        if (loadFormFailures.length > 0) {
          const failureNames = loadFormFailures.map((failure) => failure.name).join('、');
          fileService.saveFailedNodesReport(codeFolderPath, config.appName, loadFormFailures);
          vscode.window.showWarningMessage(
            `本次同步无法确认以下表单的最新结构: ${failureNames}\n请重试同步,本次不会删除任何表单文件夹。`,
            { modal: true }
          );
          throw new Error('表单列表获取异常,已取消本次同步');
        }

        if (forms.length === 0) {
          vscode.window.showWarningMessage('该应用下没有表单');

          // 同步代码不处理表单增减,遇到空列表时保留本地全部表单目录和配置。
          if (!handlesStructure) {
            fileService.updateLastSyncTime(codeFolderPath, appSuffix);
            syncSummary = `${scopeLabel}同步完成! 该应用下没有表单,已保留本地现有表单目录`;
            return;
          }

          for (const suffix of Object.keys(config.forms || {})) {
            const formFolderPath = path.join(appFolderPath, buildFolderName(config.forms[suffix].formName, suffix));
            fileService.deleteFolderIfExists(formFolderPath);
          }
          fileService.createCmaxConfig(
            codeFolderPath,
            appSuffix,
            config.appCode,
            workspaceConfig.engineCode || '',
            config.appName,
            {},
            workspaceConfig.h3yunApiVersion,
            workspaceConfig.systemUserId
          );
          fileService.updateLastSyncTime(codeFolderPath, appSuffix);
          fileService.saveFailedNodesReport(codeFolderPath, config.appName, loadFormFailures);
          saveProjectReadme(codeFolderPath);
          syncSummary = `${scope === 'all' ? '同步完成!' : `${scopeLabel}同步完成!`} 该应用下没有表单`;
          return;
        }

        // Step 2: 预先检测所有冲突
        progress.report({ message: '正在检测文件差异...', increment: 10 });

        // 表单重命名属于结构变更,只有处理结构的范围才执行。
        const structureForms = handlesStructure ? forms : [];
        for (const form of structureForms) {
          const existingEntry = findFormByCode(config.forms, form.formCode);
          if (!existingEntry || existingEntry.entry.formName === form.formName) continue;

          const currentFormFolderPath = path.join(
            appFolderPath,
            buildFolderName(existingEntry.entry.formName, existingEntry.suffix)
          );
          fileService.renameFolderWithSuffix(currentFormFolderPath, form.formName, existingEntry.suffix);
          existingEntry.entry.formName = form.formName;
          fileService.createCmaxConfig(
            codeFolderPath,
            appSuffix,
            config.appCode,
            workspaceConfig.engineCode || '',
            config.appName,
            config.forms,
            workspaceConfig.h3yunApiVersion,
            workspaceConfig.systemUserId
          );
        }
        
        // 首先获取本次同步范围内的表单内容,用于检测冲突。
        // 同步代码只为本地已有表单目录拉取内容,跳过的表单不发请求。
        const targetForms = handlesStructure ? forms : forms.filter((form) => {
          const entry = findFormByCode(config.forms, form.formCode);
          return !!entry && !!findFormFolderBySuffix(appFolderPath, entry.suffix);
        });

        const formCodesMap = new Map<string, Partial<FileContentMap>>();
        await mapWithConcurrency(targetForms, FORM_REQUEST_CONCURRENCY, async (form) => {
          try {
            const codes = await h3yunApi.getFormCodes(form.formCode, scope);
            formCodesMap.set(form.formCode, codes);
          } catch (error) {
            console.error(`获取表单 "${form.formName}" ${contentLabel}失败:`, error);
          }
        });

        // 检测冲突数量
        let conflictCount = 0;
        for (const form of targetForms) {
          const existingEntry = findFormByCode(config.forms, form.formCode);
          if (!existingEntry) continue;

          const formFolderPath = handlesStructure
            ? path.join(appFolderPath, buildFolderName(existingEntry.entry.formName, existingEntry.suffix))
            : findFormFolderBySuffix(appFolderPath, existingEntry.suffix);
          if (!formFolderPath) continue;

          const codes = formCodesMap.get(form.formCode);
          if (!codes) continue;

          for (const [filename, remoteContent] of Object.entries(codes)) {
            // 字段表不参与冲突检测,同步时直接覆盖
            if (filename === 'fields.md' || remoteContent === undefined) continue;

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
        const usedFormMappings = new Map(
          Object.entries(config.forms).map(([suffix, entry]) => [suffix, entry.formCode] as [string, string])
        );
        const totalForms = forms.length;
        let successCount = 0;
        let failCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < totalForms; i++) {
          const form = forms[i];

          progress.report({
            message: `正在同步表单 ${i + 1}/${totalForms}: ${form.formName}...`,
            increment: undefined
          });

          let createdFormFolderPath: string | undefined;
          const existingEntry = findFormByCode(config.forms, form.formCode);

          // 同步代码只处理本地已有表单目录:
          // 氚云新增的表单、配置有记录但目录已不存在的表单都直接跳过,不新建目录。
          // 目录按后缀定位,避免表单在氚云改名后本地目录名与配置不一致导致写错位置。
          let lockedFormFolderPath: string | undefined;
          if (!handlesStructure) {
            lockedFormFolderPath = existingEntry
              ? findFormFolderBySuffix(appFolderPath, existingEntry.suffix)
              : undefined;

            if (!lockedFormFolderPath) {
              console.log(`同步代码跳过本地不存在的表单目录: ${form.formName}(${form.formCode})`);
              skippedCount++;
              continue;
            }
          }

          try {
            let formFolderPath: string | undefined = lockedFormFolderPath;
            let formSuffix: string | undefined;

            if (existingEntry) {
              formSuffix = existingEntry.suffix;
              formFolderPath = formFolderPath
                || path.join(appFolderPath, buildFolderName(existingEntry.entry.formName, formSuffix));
            }

            const codes = formCodesMap.get(form.formCode);
            if (!codes) {
              throw new Error(`无法获取${fetchLabel}`);
            }

            if (!existingEntry) {
              const result = fileService.createFormFolder(
                appFolderPath,
                form.formName,
                form.formCode,
                usedFormMappings
              );
              formFolderPath = result.folderPath;
              formSuffix = result.suffix;
              createdFormFolderPath = formFolderPath;
            }

            if (!formFolderPath || !formSuffix) {
              throw new Error('无法确定表单目录');
            }

            for (const [filename, remoteContent] of Object.entries(codes)) {
              if (remoteContent === undefined) continue;

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
              formName: form.formName,
              ...(form.groupPath?.length ? { groupPath: form.groupPath } : {})
            };

            successCount++;
          } catch (error) {
            console.error(`同步表单 "${form.formName}" 失败:`, error);
            if (createdFormFolderPath && !existingEntry) {
              fileService.deleteFolderIfExists(createdFormFolderPath);
            }
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
        if (handlesStructure && failCount === 0) {
          // 已知表单的 LoadForm 异常会提前终止同步,这里仅清理明确不在节点列表中的旧目录。
          const latestFormCodes = new Set(forms.map((form) => form.formCode));
          const deletedFormSuffixes = new Set(
            Object.entries(config.forms)
              .filter(([, entry]) => !latestFormCodes.has(entry.formCode))
              .map(([suffix]) => suffix)
          );

          for (const folderName of listSubfolders(appFolderPath)) {
            const suffixMatch = folderName.match(/\((f[0-9a-z]{5,32})\)$/);
            if (!suffixMatch || !deletedFormSuffixes.has(suffixMatch[1])) continue;

            fileService.deleteFolderIfExists(path.join(appFolderPath, folderName));
            deletedFormCount++;
          }
        }

        // Step 4: 更新 cmax.json 配置文件
        // 同步代码不处理表单增减,保留原有表单映射,避免把已删除或新增的表单误写进配置。
        progress.report({ message: '正在更新配置文件...', increment: 95 });
        fileService.createCmaxConfig(
          codeFolderPath,
          appSuffix,
          config.appCode,
          workspaceConfig.engineCode || '',
          config.appName,
          handlesStructure ? updatedFormsRecord : config.forms,
          workspaceConfig.h3yunApiVersion,
          workspaceConfig.systemUserId
        );
        fileService.updateLastSyncTime(codeFolderPath, appSuffix);
         fileService.saveFailedNodesReport(codeFolderPath, config.appName, loadFormFailures);
        saveProjectReadme(codeFolderPath);

        progress.report({ message: '完成!', increment: 100 });

        // 显示同步结果
        const deletedSummary = deletedFormCount > 0 ? `, 删除表单: ${deletedFormCount}` : '';
        const skippedSummary = skippedCount > 0 ? `, 跳过本地未同步的表单: ${skippedCount}` : '';
        const completionPrefix = scope === 'all' ? '同步完成!' : `${scopeLabel}同步完成!`;
        const summary = `${completionPrefix} 成功: ${successCount}, 失败: ${failCount}, 总计: ${totalForms}${skippedSummary}${deletedSummary}`;
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

  if (syncSummary && await gitService.hasApplicationChanges(codeFolderPath, appFolderPath)) {
    await promptAndCommit(codeFolderPath, appFolderPath, syncSummary, config.appName);
  }
}
