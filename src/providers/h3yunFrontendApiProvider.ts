import * as path from 'path';
import * as vscode from 'vscode';

type ApiItem = {
  label: string;
  detail: string;
  documentation: string;
  insertText?: string;
};

const formControlApis: ApiItem[] = [
  api('GetValue', 'GetValue()', '获取控件当前值。不同控件类型的返回值结构不同。'),
  api('SetValue', 'SetValue(value)', '设置控件值。传入值的格式取决于控件类型。', 'SetValue(${1:value})'),
  api('SetVisible', 'SetVisible(visible)', '设置控件显示或隐藏。', 'SetVisible(${1:true})'),
  api('SetReadonly', 'SetReadonly(readonly)', '设置控件只读或可写。', 'SetReadonly(${1:true})'),
  api('ClearItems', 'ClearItems()', '清空单选框、复选框或下拉框的全部选项。'),
  api('AddItem', 'AddItem(item)', '为单选框、复选框或下拉框增加一个字符串选项。', 'AddItem("${1:选项}")'),
  api('BindChange', 'BindChange(key, callback)', '绑定控件值改变事件，控件失去焦点后触发。', 'BindChange($.IGuid(), function() {\n\t${1}\n})'),
  api('UnbindChange', 'UnbindChange(key)', '按事件标识取消 BindChange 绑定。', 'UnbindChange("${1:key}")'),
  api('OnTempChange', 'OnTempChange(callback)', '值变化时立即触发。表单 3.0 不支持，不建议继续使用。', 'OnTempChange(function() {\n\t${1}\n})'),
  api('OnKeyDown', 'OnKeyDown(callback)', '绑定控件内键盘按下事件。可通过 event.srcElement.value 读取最新录入值。', 'OnKeyDown(function(event) {\n\t${1}\n})'),
  api('SetColor', 'SetColor(color)', '设置文本颜色，支持单行文本、多行文本、日期和数值控件。', 'SetColor(Color.${1:Blue})'),
  api('SetBgColor', 'SetBgColor(color)', '设置控件内容背景颜色。', 'SetBgColor(BgColor.${1:Success})'),
  api('SetFontSize', 'SetFontSize(size)', '设置控件内容字体大小。', 'SetFontSize(FontSize.${1:Large})'),
  api('SetFontWeight', 'SetFontWeight(weight)', '设置控件内容字重。', 'SetFontWeight(FontWeight.${1:Bold})'),
  api('SetLine', 'SetLine(lineType)', '设置控件内容的下划线或删除线。', 'SetLine(LineType.${1:Underline})'),
  api('SetFocus', 'SetFocus(scroll)', '聚焦到控件；传 true 时自动滚动到该控件。', 'SetFocus(${1:true})'),
  api('OnFocus', 'OnFocus(callback)', '绑定控件聚焦事件，仅支持编辑态控件。', 'OnFocus(function() {\n\t${1}\n})'),
  api('AddRow', 'AddRow(rowId, values)', '为子表增加一行。values 的字段编码需使用“子表编码.控件编码”完整格式。', 'AddRow($.IGuid(), {\n\t"${1:子表编码.控件编码}": ${2:value}\n})'),
  api('ClearRows', 'ClearRows()', '清空子表全部行数据。'),
  api('UpdateRow', 'UpdateRow(rowId, values)', '更新子表指定行数据。', 'UpdateRow(${1:rowId}, {\n\t"${2:子表编码.控件编码}": ${3:value}\n})'),
  api('GetCellManager', 'GetCellManager(rowId, controlCode)', '获取子表指定行内控件的实例。', 'GetCellManager(${1:rowId}, "${2:子表编码.控件编码}")'),
  api('GetRowsCount', 'GetRowsCount()', '获取子表数据行数。')
];

const formSmartFormApis: ApiItem[] = [
  api('PostForm', 'PostForm(actionName, data, callback, errorCallback, async)', '向表单后端发起请求，触发后端 OnSubmit 事件。actionName 建议命名为“功能名_Post”。', 'PostForm("${1:功能名_Post}", ${2:{}}, function(data) {\n\t${3}\n}, function(error) {\n\t${4}\n}, ${5:false})'),
  api('ResponseContext', 'ResponseContext', '当前表单上下文，可获取 IsCreateMode、BizObjectStatus、FormMode、ActivityCode、IsMobile 等信息。', 'ResponseContext'),
  api('ClosePage', 'ClosePage()', '关闭旧版表单页面。新版表单请使用 this.ClosePage()。')
];

const formInstanceApis: ApiItem[] = [
  api('ClosePage', 'ClosePage()', '关闭新版表单页面。')
];

const responseContextApis: ApiItem[] = [
  api('ActivityCode', 'ActivityCode: string', '当前流程节点编码。', 'ActivityCode'),
  api('DisplayName', 'DisplayName: string', '当前表单名称。', 'DisplayName'),
  api('FormDataType', 'FormDataType: number', '当前表单数据类型。', 'FormDataType'),
  api('FormMode', 'FormMode: number', '当前表单模式：0 审批/办理，1 办理完结，2 创建，4 查阅。', 'FormMode'),
  api('InstanceId', 'InstanceId: string', '当前表单数据的流程实例 Id。', 'InstanceId'),
  api('IsCreateMode', 'IsCreateMode: boolean', '是否处于创建模式。', 'IsCreateMode'),
  api('BizObjectId', 'BizObjectId: string', '当前表单数据 Id。', 'BizObjectId'),
  api('BizObjectStatus', 'BizObjectStatus: number', '当前表单数据状态：0 草稿，1 生效/流程结束，2 流程进行中，3 作废。', 'BizObjectStatus'),
  api('SchemaCode', 'SchemaCode: string', '当前表单的 SchemaCode。', 'SchemaCode'),
  api('IsMobile', 'IsMobile: boolean', '是否处于移动端。', 'IsMobile'),
  api('Originator', 'Originator: string', '发起人用户 Id。', 'Originator'),
  api('OriginatorCode', 'OriginatorCode: string', '发起人用户名。', 'OriginatorCode'),
  api('OriginatorParentId', 'OriginatorParentId: string', '发起人所在部门 Id。', 'OriginatorParentId')
];

const listViewApis: ApiItem[] = [
  api('ActionPreDo', 'ActionPreDo = function(actionCode) { ... }', '列表按钮点击前的处理入口，actionCode 为按钮编码，应为该属性赋值事件处理函数。', 'ActionPreDo = function(actionCode) {\n\t${1}\n};'),
  api('GetSelected', 'GetSelected()', '获取列表中当前选中的数据。'),
  api('Post', 'Post(actionName, data, callback, errorCallback, async)', '向列表后端发起请求，触发后端 OnSubmit 事件。', 'Post("${1:功能名_Post}", ${2:{}}, function(data) {\n\t${3}\n}, function(error) {\n\t${4}\n}, ${5:false})'),
  api('RefreshView', 'RefreshView()', '刷新列表数据。'),
  api('InitQueryItems', 'InitQueryItems()', '初始化列表筛选条件。')
];

const sharedRootApis: ApiItem[] = [
  api('IShowSuccess', 'IShowSuccess(title, message)', '显示成功消息。', 'IShowSuccess("${1:成功}", "${2:提示内容}")'),
  api('IShowWarn', 'IShowWarn(title, message)', '显示警告消息。', 'IShowWarn("${1:警告}", "${2:提示内容}")'),
  api('IShowError', 'IShowError(title, message)', '显示错误消息。', 'IShowError("${1:错误}", "${2:提示内容}")'),
  api('IConfirm', 'IConfirm(title, message, callback)', '显示确认弹窗。此 API 为回调式，不会阻塞后续代码。', 'IConfirm("${1:提示}", "${2:是否确认？}", function(confirmed) {\n\t${3}\n})'),
  api('IShowForm（全屏）', 'IShowForm(schemaCode, objectId, checkIsChange)', '以全屏模式打开表单。', 'IShowForm("${1:表单编码}", "${2:数据Id}", ${3:true})'),
  api('IShowForm（弹窗）', 'IShowForm(schemaCode, objectId, params, checkIsChange, showlist, options)', '以弹窗模式打开表单。', 'IShowForm("${1:表单编码}", "${2:数据Id}", ${3:{}}, ${4:false}, ${5:false}, {\n\tshowInModal: true,\n\ttitle: "${6:表单页标题}",\n\theight: ${7:500},\n\twidth: ${8:800}\n})')
];

const formRootOnlyApis: ApiItem[] = [
  api('IGetParams', 'IGetParams(name)', '获取通过 IShowForm 的 params 传入的指定参数。', 'IGetParams("${1:参数名}")'),
  api('ILocation', 'ILocation(needAddress, callback)', '获取设备经纬度，仅限钉钉移动端使用。', 'ILocation(true, function(data) {\n\t${1}\n})'),
  api('IGuid', 'IGuid()', '生成唯一标识，可用作 BindChange 事件标识或子表行 Id。')
];

const formRootApis = sharedRootApis.concat(formRootOnlyApis, api('SmartForm', 'SmartForm', '表单前端 API 命名空间。', 'SmartForm'));
const listRootApis = sharedRootApis.concat(api('ListView', 'ListView', '列表前端 API 命名空间。', 'ListView'));

function api(label: string, detail: string, documentation: string, insertText?: string): ApiItem {
  return { label, detail, documentation, insertText };
}

function isH3yunFrontendFile(document: vscode.TextDocument): 'form' | 'list' | undefined {
  const fileName = path.basename(document.fileName).toLowerCase();
  if (fileName === 'form-frontend.js') {
    return 'form';
  }
  if (fileName === 'list-frontend.js') {
    return 'list';
  }
  return undefined;
}

function createCompletionItems(items: ApiItem[]): vscode.CompletionItem[] {
  return items.map((item) => {
    const completion = new vscode.CompletionItem(item.label, vscode.CompletionItemKind.Method);
    completion.detail = `氚云前端 API: ${item.detail}`;
    completion.documentation = new vscode.MarkdownString(`${item.documentation}\n\n[查看开发文档](https://h3yunpro.github.io/docs/)`);
    completion.insertText = new vscode.SnippetString(item.insertText || `${item.label}()`);
    return completion;
  });
}

function getCompletionApis(prefix: string, fileType: 'form' | 'list'): ApiItem[] | undefined {
  if (/\$\.SmartForm\.ResponseContext\.$/i.test(prefix)) {
    return fileType === 'form' ? responseContextApis : undefined;
  }
  if (/\$\.SmartForm\.$/i.test(prefix)) {
    return fileType === 'form' ? formSmartFormApis : undefined;
  }
  if (/\$\.ListView\.$/i.test(prefix)) {
    return fileType === 'list' ? listViewApis : undefined;
  }
  if (/\$\.$/.test(prefix)) {
    return fileType === 'form' ? formRootApis : listRootApis;
  }
  if (fileType === 'form' && /this\.$/.test(prefix)) {
    return formInstanceApis;
  }
  if (fileType === 'form' && /(?:this|that|parent)\.[A-Za-z][A-Za-z0-9_]*\.$/.test(prefix)) {
    return formControlApis;
  }
  return undefined;
}

function getHoverApi(prefix: string, fileType: 'form' | 'list', word: string): ApiItem | undefined {
  const apis = getCompletionApis(prefix, fileType);
  if (!apis) {
    return undefined;
  }
  return apis.find((apiItem) => apiItem.label === word || apiItem.label.indexOf(`${word}（`) === 0);
}

/** 注册仅作用于氚云前端代码文件的 API 补全与悬浮说明。 */
export function registerH3yunFrontendApiProvider(context: vscode.ExtensionContext): void {
  const selector: vscode.DocumentSelector = [{ language: 'javascript', pattern: '**/{form,list}-frontend.js' }];
  const provider = vscode.languages.registerCompletionItemProvider(selector, {
    provideCompletionItems(document, position) {
      const fileType = isH3yunFrontendFile(document);
      if (!fileType) {
        return undefined;
      }
      const prefix = document.lineAt(position.line).text.slice(0, position.character);
      const apis = getCompletionApis(prefix, fileType);
      return apis ? createCompletionItems(apis) : undefined;
    }
  }, '.');

  const hoverProvider = vscode.languages.registerHoverProvider(selector, {
    provideHover(document, position) {
      const fileType = isH3yunFrontendFile(document);
      if (!fileType) {
        return undefined;
      }
      const range = document.getWordRangeAtPosition(position);
      if (!range) {
        return undefined;
      }
      const word = document.getText(range);
      const prefix = document.lineAt(position.line).text.slice(0, range.start.character);
      const item = getHoverApi(prefix, fileType, word);
      if (!item) {
        return undefined;
      }
      const content = new vscode.MarkdownString();
      content.appendCodeblock(item.detail, 'javascript');
      content.appendMarkdown(`\n${item.documentation}\n\n[查看开发文档](https://h3yunpro.github.io/docs/)`);
      return new vscode.Hover(content, range);
    }
  });

  context.subscriptions.push(provider, hoverProvider);
}
