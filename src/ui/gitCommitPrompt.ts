import * as vscode from 'vscode';

export const DEFAULT_COMMIT_MESSAGE = '从氚云同步';

export async function promptForCommitMessage(summary?: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const panel = vscode.window.createWebviewPanel(
      'h3yunCommitMessage',
      summary ? '同步完成' : '输入 Git 提交信息',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = getWebviewContent(DEFAULT_COMMIT_MESSAGE, summary);

    panel.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case 'submit': {
          const commitMessage = typeof message.value === 'string' ? message.value.trim() : '';
          if (!commitMessage) {
            panel.webview.postMessage({
              command: 'error',
              message: '提交信息不能为空'
            });
            return;
          }

          resolve(commitMessage);
          panel.dispose();
          break;
        }
        case 'cancel':
          resolve(undefined);
          panel.dispose();
          break;
      }
    });

    panel.onDidDispose(() => {
      resolve(undefined);
    });
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getWebviewContent(defaultMessage: string, summary?: string): string {
  const escapedDefaultMessage = escapeHtml(defaultMessage);
  const summaryHtml = summary
    ? `<p class="summary">${escapeHtml(summary)}</p>`
    : '<p class="description">请确认或修改本次从氚云同步后的 git commit 提交信息。</p>';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>输入 Git 提交信息</title>
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
    }

    .page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .card {
      width: min(640px, 100%);
      padding: 28px;
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      border: 1px solid var(--vscode-panel-border, transparent);
      border-radius: 12px;
      box-shadow: 0 8px 24px var(--vscode-widget-shadow, rgba(0, 0, 0, 0.28));
    }

    h1 {
      margin: 0 0 10px;
      font-size: 22px;
      font-weight: 600;
    }

    .description {
      margin: 0 0 22px;
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
      line-height: 1.6;
    }

    .summary {
      margin: 0 0 22px;
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    label {
      display: block;
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: 600;
    }

    input {
      width: 100%;
      padding: 12px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      border: 2px solid var(--vscode-focusBorder, var(--vscode-input-border, transparent));
      border-radius: 6px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size, 14px);
      outline: none;
    }

    input:focus {
      box-shadow: 0 0 0 1px var(--vscode-focusBorder);
    }

    .error {
      min-height: 18px;
      margin-top: 8px;
      color: var(--vscode-inputValidation-errorForeground, #f48771);
      font-size: 12px;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 22px;
    }

    button {
      padding: 8px 16px;
      border: 0;
      border-radius: 4px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      cursor: pointer;
    }

    .primary {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }

    .primary:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .secondary {
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
    }

    .secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="card">
      <h1>${summary ? '同步完成' : '输入 Git 提交信息'}</h1>
      ${summaryHtml}

      <label for="commitMessage">提交信息</label>
      <input id="commitMessage" type="text" value="${escapedDefaultMessage}" autocomplete="off">
      <div id="error" class="error"></div>

      <div class="actions">
        <button id="cancel" class="secondary" type="button">取消</button>
        <button id="submit" class="primary" type="button">提交变更</button>
      </div>
    </section>
  </main>

  <script>
    const vscode = acquireVsCodeApi();
    const input = document.getElementById('commitMessage');
    const error = document.getElementById('error');
    const submit = document.getElementById('submit');
    const cancel = document.getElementById('cancel');

    function submitMessage() {
      const value = input.value.trim();
      if (!value) {
        error.textContent = '提交信息不能为空';
        input.focus();
        return;
      }

      vscode.postMessage({ command: 'submit', value });
    }

    submit.addEventListener('click', submitMessage);
    cancel.addEventListener('click', () => vscode.postMessage({ command: 'cancel' }));
    input.addEventListener('input', () => { error.textContent = ''; });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        vscode.postMessage({ command: 'cancel' });
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        submitMessage();
      }
    });

    window.addEventListener('message', (event) => {
      if (event.data.command === 'error') {
        error.textContent = event.data.message;
        input.focus();
      }
    });

    input.focus();
    input.select();
  </script>
</body>
</html>`;
}
