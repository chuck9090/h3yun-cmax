import * as vscode from 'vscode';
import { h3yunApi } from '../services/h3yunApi';
import { fileService } from '../services/fileService';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 构建项目输入数据
 */
interface BuildInputData {
  appCode: string;
  h3Token: string;
}

/**
 * 显示构建项目输入表单 Webview
 */
export function showBuildProjectForm(): Promise<BuildInputData | null> {
  return new Promise((resolve) => {
    // 创建 WebView 面板
    const panel = vscode.window.createWebviewPanel(
      'h3yunBuildForm',
      '从氚云构建项目',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    // 读取 HTML 模板
    const htmlPath = path.join(__dirname, '..', 'assets', 'token-guide.html');
    let tokenGuideHtml = '';
    try {
      tokenGuideHtml = fs.readFileSync(htmlPath, 'utf-8');
    } catch (error) {
      console.error('Failed to read token guide HTML:', error);
    }

    // 设置 HTML 内容
    panel.webview.html = getWebviewContent(tokenGuideHtml);

    // 处理消息
    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'submit':
          // 验证输入
          if (!message.appCode || !message.appCode.trim()) {
            panel.webview.postMessage({ 
              command: 'error', 
              field: 'appCode', 
              message: '应用编码不能为空' 
            });
            return;
          }

          if (!message.h3Token || !message.h3Token.trim()) {
            panel.webview.postMessage({ 
              command: 'error', 
              field: 'h3Token', 
              message: 'Token 不能为空' 
            });
            return;
          }

          // 验证 Token 有效性
          panel.webview.postMessage({ command: 'validating' });
          
          try {
            h3yunApi.setToken(message.h3Token.trim());
            
            // 尝试获取应用信息来验证 Token
            await h3yunApi.getApplication(message.appCode.trim());
            
            // 验证成功,返回数据
            resolve({
              appCode: message.appCode.trim(),
              h3Token: message.h3Token.trim()
            });
            
            panel.dispose();
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            
            // 判断错误类型
            let errorMessage = '验证失败: ';
            let errorField = 'h3Token';
            
            if (errorMsg.includes('401') || errorMsg.includes('认证') || errorMsg.toLowerCase().includes('token')) {
              errorMessage = 'Token 已失效或无效,请重新获取';
              errorField = 'h3Token';
            } else if (errorMsg.includes('404') || errorMsg.includes('不存在')) {
              errorMessage = '应用编码不存在,请检查后重试';
              errorField = 'appCode';
            } else {
              errorMessage = `验证失败: ${errorMsg}`;
            }
            
            panel.webview.postMessage({ 
              command: 'error', 
              field: errorField, 
              message: errorMessage 
            });
          }
          break;
          
        case 'cancel':
          resolve(null);
          panel.dispose();
          break;
          
        case 'openTokenGuide':
          // 在新标签页中打开 Token 获取指南
          const guidePanel = vscode.window.createWebviewPanel(
            'tokenGuide',
            '如何获取 h3_token',
            vscode.ViewColumn.Beside,
            {
              enableScripts: false
            }
          );
          guidePanel.webview.html = tokenGuideHtml;
          break;
      }
    });

    // 处理面板关闭
    panel.onDidDispose(() => {
      resolve(null);
    });
  });
}

/**
 * 获取 Webview HTML 内容
 */
function getWebviewContent(tokenGuideHtml: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>从氚云构建项目</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        
        .form-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            padding: 30px;
        }
        
        .form-header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .form-header h1 {
            font-size: 24px;
            color: #333;
            margin-bottom: 10px;
        }
        
        .form-header p {
            color: #666;
            font-size: 14px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
            font-size: 14px;
        }
        
        .form-label .required {
            color: #f44336;
            margin-left: 4px;
        }
        
        .form-input {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
            transition: all 0.3s;
        }
        
        .form-input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .form-input.error {
            border-color: #f44336;
        }
        
        .error-message {
            color: #f44336;
            font-size: 12px;
            margin-top: 6px;
            display: none;
        }
        
        .error-message.show {
            display: block;
        }
        
        .help-link {
            color: #667eea;
            font-size: 12px;
            cursor: pointer;
            text-decoration: none;
            margin-top: 6px;
            display: inline-block;
        }
        
        .help-link:hover {
            text-decoration: underline;
        }
        
        .form-actions {
            display: flex;
            gap: 10px;
            margin-top: 30px;
        }
        
        .btn {
            flex: 1;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        
        .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        
        .btn-secondary {
            background: #f5f5f5;
            color: #666;
            border: 2px solid #ddd;
        }
        
        .btn-secondary:hover {
            background: #e0e0e0;
        }
        
        .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        
        .loading-overlay.show {
            display: flex;
        }
        
        .loading-box {
            background: white;
            padding: 30px 40px;
            border-radius: 12px;
            text-align: center;
        }
        
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .loading-text {
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="form-container">
        <div class="form-header">
            <h1>🚀 从氚云构建项目</h1>
            <p>请输入应用编码和认证 Token</p>
        </div>
        
        <form id="buildForm">
            <div class="form-group">
                <label class="form-label">
                    应用编码 <span class="required">*</span>
                </label>
                <input 
                    type="text" 
                    id="appCode" 
                    class="form-input" 
                    placeholder="例如: APP001"
                    autocomplete="off"
                />
                <div class="error-message" id="appCodeError"></div>
            </div>
            
            <div class="form-group">
                <label class="form-label">
                    h3_token <span class="required">*</span>
                </label>
                <input 
                    type="password" 
                    id="h3Token" 
                    class="form-input" 
                    placeholder="从浏览器 Cookie 中复制的 h3_token 值"
                    autocomplete="off"
                />
                <a class="help-link" id="tokenHelpLink">📖 如何获取 h3_token?</a>
                <div class="error-message" id="h3TokenError"></div>
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="cancelBtn">取消</button>
                <button type="submit" class="btn btn-primary" id="submitBtn">开始构建</button>
            </div>
        </form>
    </div>
    
    <div class="loading-overlay" id="loadingOverlay">
        <div class="loading-box">
            <div class="spinner"></div>
            <div class="loading-text">正在验证 Token...</div>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        const form = document.getElementById('buildForm');
        const appCodeInput = document.getElementById('appCode');
        const h3TokenInput = document.getElementById('h3Token');
        const submitBtn = document.getElementById('submitBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const tokenHelpLink = document.getElementById('tokenHelpLink');
        const loadingOverlay = document.getElementById('loadingOverlay');
        
        // 提交表单
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // 清除之前的错误
            clearErrors();
            
            // 发送数据到扩展
            vscode.postMessage({
                command: 'submit',
                appCode: appCodeInput.value,
                h3Token: h3TokenInput.value
            });
        });
        
        // 取消按钮
        cancelBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'cancel' });
        });
        
        // 查看 Token 获取指南
        tokenHelpLink.addEventListener('click', () => {
            vscode.postMessage({ command: 'openTokenGuide' });
        });
        
        // 接收来自扩展的消息
        window.addEventListener('message', (event) => {
            const message = event.data;
            
            switch (message.command) {
                case 'error':
                    showError(message.field, message.message);
                    hideLoading();
                    break;
                    
                case 'validating':
                    showLoading();
                    break;
            }
        });
        
        function showError(field, message) {
            const input = document.getElementById(field);
            const errorDiv = document.getElementById(field + 'Error');
            
            if (input && errorDiv) {
                input.classList.add('error');
                errorDiv.textContent = message;
                errorDiv.classList.add('show');
            }
        }
        
        function clearErrors() {
            const inputs = document.querySelectorAll('.form-input');
            const errors = document.querySelectorAll('.error-message');
            
            inputs.forEach(input => input.classList.remove('error'));
            errors.forEach(error => {
                error.textContent = '';
                error.classList.remove('show');
            });
        }
        
        function showLoading() {
            loadingOverlay.classList.add('show');
            submitBtn.disabled = true;
        }
        
        function hideLoading() {
            loadingOverlay.classList.remove('show');
            submitBtn.disabled = false;
        }
    </script>
</body>
</html>`;
}
