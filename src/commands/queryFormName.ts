import * as path from 'path';
import * as vscode from 'vscode';
import { fileService } from '../services/fileService';
import { h3yunApi } from '../services/h3yunApi';
import { buildFolderName } from '../utils/folderUtils';
import { CODE_FOLDER_NAME } from '../utils/folderUtils';
import { promptForUpdateGuide } from '../ui/updateGuide';

/**
 * 从当前编辑文件的父目录中定位所属氚云应用目录。
 */
function findAppFolderPath(documentUri: vscode.Uri): string | undefined {
  let folderPath = path.dirname(documentUri.fsPath);

  while (true) {
    if (fileService.hasCmaxConfig(folderPath)) {
      return folderPath;
    }

    const parentFolderPath = path.dirname(folderPath);
    if (parentFolderPath === folderPath) {
      return undefined;
    }

    folderPath = parentFolderPath;
  }
}

/**
 * 查询当前编辑器所选氚云主表或子表编码对应的表单名称。
 */
export async function handleQueryFormName(uri?: vscode.Uri): Promise<void> {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor || (uri && activeEditor.document.uri.fsPath !== uri.fsPath)) {
    vscode.window.showWarningMessage('请在氚云项目文件中选中表单或子表编码后再执行查询');
    return;
  }

  const selectedText = activeEditor.document.getText(activeEditor.selection).trim();
  if (!selectedText) {
    vscode.window.showWarningMessage('请先选中需要查询的表单或子表编码');
    return;
  }

  if (!/^[A-Za-z0-9_]+$/.test(selectedText)) {
    vscode.window.showWarningMessage('表单编码只能包含字母、数字和下划线');
    return;
  }

  const formCode = selectedText.replace(/^i_/i, '');
  if (!formCode) {
    vscode.window.showWarningMessage('请选择有效的表单编码或业务表名');
    return;
  }

  const appFolderPath = findAppFolderPath(activeEditor.document.uri);
  if (!appFolderPath) {
    vscode.window.showWarningMessage('当前文件不在包含 cmax.json 的氚云应用目录中');
    return;
  }

  if (path.basename(path.dirname(appFolderPath)) !== CODE_FOLDER_NAME) {
    await promptForUpdateGuide(
      '当前应用不在“氚云代码”目录下，可能仍在使用旧版目录方案。请查看更新指南，并重新构建一次项目。'
    );
    return;
  }

  try {
    const config = fileService.readCmaxConfig(appFolderPath);
    const localForm = Object.entries(config.forms).find(([, form]) => form.formCode === formCode);
    if (localForm) {
      const [suffix, form] = localForm;
      const fieldsPath = path.join(
        appFolderPath,
        buildFolderName(form.formName, suffix),
        'fields.md'
      );
      const document = await vscode.workspace.openTextDocument(fieldsPath);
      await vscode.window.showTextDocument(document);
      return;
    }

    let token: string;
    try {
      token = fileService.readToken(path.dirname(appFolderPath));
    } catch (error) {
      await promptForUpdateGuide(
        '“氚云代码”目录下没有可用的 .h3token 文件，可能仍在使用旧版目录方案。请查看更新指南，并重新构建一次项目。'
      );
      throw error;
    }
    h3yunApi.setApiVersion(config.h3yunApiVersion);
    h3yunApi.setToken(token, config.engineCode);

    const forms = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '正在查询氚云表单名称',
        cancellable: false
      },
      () => h3yunApi.queryFormNames(formCode, config.systemUserId)
    );

    if (forms.length === 0) {
      vscode.window.showInformationMessage(`未查询到编码 “${selectedText}” 对应的表单`);
      return;
    }

    const result = forms.map((form) => (
      `表单名称: ${form.formName || '未命名'}\n主表编码: ${form.formCode}\n子表编码: ${form.childSchemas || '无'}`
    )).join('\n\n');
    vscode.window.showInformationMessage(result, { modal: true });
  } catch (error) {
    vscode.window.showErrorMessage(
      `查询氚云表单名称失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
