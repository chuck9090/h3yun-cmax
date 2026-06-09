import * as vscode from 'vscode';
import { DiffReport } from '../utils/diffUtils';
import { ConflictResolution } from './conflictDialog';

interface DiffLine {
  localLineNumber: number | null;
  remoteLineNumber: number | null;
  localText: string;
  remoteText: string;
  type: 'same' | 'added' | 'removed' | 'changed';
}

export interface DiffPreviewOptions {
  formName: string;
  filename: string;
  localContent: string;
  remoteContent: string;
  diffReport: DiffReport;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function splitLines(content: string): string[] {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

function buildLCSTable(localLines: string[], remoteLines: string[]): number[][] {
  const localLength = localLines.length;
  const remoteLength = remoteLines.length;
  const table: number[][] = Array.from({ length: localLength + 1 }, () => new Array(remoteLength + 1).fill(0));

  for (let i = 1; i <= localLength; i++) {
    for (let j = 1; j <= remoteLength; j++) {
      if (localLines[i - 1] === remoteLines[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }

  return table;
}

function buildDiffLines(localContent: string, remoteContent: string): DiffLine[] {
  const localLines = splitLines(localContent);
  const remoteLines = splitLines(remoteContent);
  const table = buildLCSTable(localLines, remoteLines);
  const rows: DiffLine[] = [];
  let i = localLines.length;
  let j = remoteLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && localLines[i - 1] === remoteLines[j - 1]) {
      rows.push({
        localLineNumber: i,
        remoteLineNumber: j,
        localText: localLines[i - 1],
        remoteText: remoteLines[j - 1],
        type: 'same'
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      rows.push({
        localLineNumber: null,
        remoteLineNumber: j,
        localText: '',
        remoteText: remoteLines[j - 1],
        type: 'added'
      });
      j--;
    } else if (i > 0) {
      rows.push({
        localLineNumber: i,
        remoteLineNumber: null,
        localText: localLines[i - 1],
        remoteText: '',
        type: 'removed'
      });
      i--;
    }
  }

  rows.reverse();

  for (let index = 0; index < rows.length - 1; index++) {
    const current = rows[index];
    const next = rows[index + 1];

    if (current.type === 'removed' && next.type === 'added') {
      current.type = 'changed';
      next.type = 'changed';
    }
  }

  return rows;
}

function renderRows(rows: DiffLine[]): string {
  return rows.map((row) => {
    const localLineNumber = row.localLineNumber === null ? '' : String(row.localLineNumber);
    const remoteLineNumber = row.remoteLineNumber === null ? '' : String(row.remoteLineNumber);
    const localText = row.localLineNumber === null ? '' : escapeHtml(row.localText);
    const remoteText = row.remoteLineNumber === null ? '' : escapeHtml(row.remoteText);

    return `<tr class="${row.type}">
      <td class="line-number">${localLineNumber}</td>
      <td class="code local-code"><pre>${localText}</pre></td>
      <td class="line-number">${remoteLineNumber}</td>
      <td class="code remote-code"><pre>${remoteText}</pre></td>
    </tr>`;
  }).join('');
}

function getWebviewHtml(options: DiffPreviewOptions, nonce: string): string {
  const rows = buildDiffLines(options.localContent, options.remoteContent);
  const rowsHtml = renderRows(rows);
  const title = `${options.formName} / ${options.filename}`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      margin: 0;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
    }

    header {
      position: sticky;
      top: 0;
      z-index: 2;
      padding: 14px 18px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editor-background);
    }

    h1 {
      margin: 0 0 8px;
      font-size: 16px;
      font-weight: 600;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }

    .toolbar {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    button {
      padding: 6px 12px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border: 0;
      border-radius: 2px;
      cursor: pointer;
    }

    button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    button.secondary {
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
    }

    button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    main {
      padding: 0 18px 18px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
    }

    th {
      position: sticky;
      top: 109px;
      z-index: 1;
      padding: 8px;
      text-align: left;
      background: var(--vscode-editorGroupHeader-tabsBackground);
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .line-header {
      width: 52px;
      text-align: right;
    }

    .line-number {
      width: 52px;
      padding: 0 8px;
      color: var(--vscode-editorLineNumber-foreground);
      text-align: right;
      vertical-align: top;
      user-select: none;
      border-right: 1px solid var(--vscode-panel-border);
    }

    .code {
      width: calc(50% - 52px);
      padding: 0 8px;
      vertical-align: top;
      white-space: pre;
      overflow-wrap: normal;
    }

    pre {
      margin: 0;
      min-height: 19px;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: inherit;
    }

    tr.added .remote-code,
    tr.added td:nth-child(3) {
      background: rgba(46, 160, 67, 0.25);
    }

    tr.removed .local-code,
    tr.removed td:nth-child(1) {
      background: rgba(248, 81, 73, 0.25);
    }

    tr.changed .local-code,
    tr.changed td:nth-child(1),
    tr.changed .remote-code,
    tr.changed td:nth-child(3) {
      background: rgba(187, 128, 9, 0.28);
    }

    .legend {
      display: flex;
      gap: 10px;
      margin: 12px 0;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }

    .legend span::before {
      content: '';
      display: inline-block;
      width: 10px;
      height: 10px;
      margin-right: 5px;
      border-radius: 2px;
      vertical-align: -1px;
    }

    .legend .added::before { background: rgba(46, 160, 67, 0.55); }
    .legend .removed::before { background: rgba(248, 81, 73, 0.55); }
    .legend .changed::before { background: rgba(187, 128, 9, 0.65); }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">
      <span>本地版本: ${options.diffReport.localLines} 行 (${options.diffReport.localSize} 字节)</span>
      <span>远程版本: ${options.diffReport.remoteLines} 行 (${options.diffReport.remoteSize} 字节)</span>
      <span>变化: +${options.diffReport.addedLines} 行, -${options.diffReport.removedLines} 行</span>
    </div>
    <div class="toolbar">
      <button data-action="local">使用本地版本</button>
      <button data-action="remote">使用远程版本</button>
      <button class="secondary" data-action="skip">跳过</button>
    </div>
  </header>
  <main>
    <div class="legend">
      <span class="added">远程新增</span>
      <span class="removed">本地删除</span>
      <span class="changed">内容变化</span>
    </div>
    <table>
      <thead>
        <tr>
          <th class="line-header">行号</th>
          <th>本地代码</th>
          <th class="line-header">行号</th>
          <th>氚云代码</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('button[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        vscode.postMessage({ type: 'resolve', resolution: button.dataset.action });
      });
    });
  </script>
</body>
</html>`;
}

function getNonce(): string {
  return String(Date.now()) + String(Math.random()).slice(2);
}

export function showDiffPreview(options: DiffPreviewOptions): Promise<ConflictResolution | null> {
  return new Promise((resolve) => {
    const panel = vscode.window.createWebviewPanel(
      'h3yunCmaxDiffPreview',
      `代码差异: ${options.filename}`,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    let resolved = false;

    panel.webview.html = getWebviewHtml(options, getNonce());

    panel.webview.onDidReceiveMessage((message) => {
      if (message?.type !== 'resolve') {
        return;
      }

      resolved = true;

      if (message.resolution === 'local') {
        resolve(ConflictResolution.USE_LOCAL);
      } else if (message.resolution === 'remote') {
        resolve(ConflictResolution.USE_REMOTE);
      } else {
        resolve(ConflictResolution.SKIP);
      }

      panel.dispose();
    });

    panel.onDidDispose(() => {
      if (!resolved) {
        resolve(null);
      }
    });
  });
}
