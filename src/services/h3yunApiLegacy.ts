import * as fs from 'fs';
import * as path from 'path';
import { get, post, parseJsonResponse } from '../utils/httpUtils';
import {
  H3Application,
  H3Form,
  FileContentMap,
  SyncScope
} from '../types';
import { parseApplication, FunctionNodeAppListResponse } from '../parsers/appListParser';
import { parseFunctionNodes, FunctionNodeChildrenResponse } from '../parsers/functionNodeChildrenParser';
import {
  hasFormSchema,
  parseSchemaJSON,
  SheetDesignerLoadFormResponse
} from '../parsers/sheetDesignerParser';
import { H3FunctionNode } from '../parsers/functionNodeTypes';
import { mapWithConcurrency } from '../utils/promiseUtils';
import { FORM_REQUEST_CONCURRENCY } from '../constants/concurrency';
import {
  FormCustomCode,
  LoadCustomCodeResponse,
  parseFormCustomCode
} from '../parsers/customCodeParser';
import {
  AutomaticTriggersResponse,
  parseAutomations
} from '../parsers/automationParser';
import { FieldLabelIndex } from './fieldLabelService';
import {
  ListViewCode,
  ListViewDesignerLoadResponse,
  parseListViewCode
} from '../parsers/listViewDesignerParser';

/**
 * 氚云老版本 API 基础配置
 */
const API_BASE_URL = 'https://www.h3yun.com';
const SQL_PREVIEW_API_PATH = '/rx-report/integrate/data-source/v1/customsql/previewSql';

/**
 * 全局认证信息存储
 */
let globalToken: string = '';
let globalEngineCode: string = '';
const loadFormCache = new Map<string, SheetDesignerLoadFormResponse>();
const customCodeCache = new Map<string, FormCustomCode>();
const listViewCodeCache = new Map<string, ListViewCode>();
const loadFormFailures: Array<{ code: string; name: string; error: string }> = [];

function isReportNode(node: H3FunctionNode): boolean {
  return /报表/.test(node.displayName);
}

function readDefaultCode(filename: keyof Omit<FileContentMap, 'fields.md'>): string {
  const defaultCodePath = path.resolve(__dirname, '..', 'default-code', filename);

  if (!fs.existsSync(defaultCodePath)) {
    return '';
  }

  return fs.readFileSync(defaultCodePath, 'utf-8');
}

function useDefaultCodeIfEmpty(
  filename: keyof Omit<FileContentMap, 'fields.md'>,
  content: string,
  formCode: string
): string {
  if (content.trim().length > 0) {
    return content;
  }

  const defaultCode = readDefaultCode(filename);

  if (filename === 'form-backend.cs' || filename === 'list-backend.cs') {
    return defaultCode.replace(/\{SchemaCode\}/g, formCode);
  }

  return defaultCode;
}

/**
 * 设置认证信息
 * @param token h3_token
 * @param engineCode 企业引擎编码
 */
export function setToken(token: string, engineCode: string): void {
  globalToken = token;
  globalEngineCode = engineCode;
  loadFormCache.clear();
  customCodeCache.clear();
  listViewCodeCache.clear();
  loadFormFailures.length = 0;
}

/**
 * 获取请求头(包含认证信息)
 */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json;charset=UTF-8'
  };

  // 如果设置了 Token,添加到请求头
  if (globalToken) {
    headers['Authorization'] = `Bearer ${globalToken}`;
    // 或者根据实际需求使用 Cookie 方式
    // headers['Cookie'] = `h3_token=${globalToken}`;
  }

  if (globalEngineCode) {
    headers['enginecode'] = globalEngineCode;
  }

  return headers;
}

/**
 * 构建完整的 API URL
 * @param endpoint API 端点路径
 * @returns 完整的 URL
 */
export function buildUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint}`;
}

export function ensureSuccessfulStatus(statusCode: number, action: string): void {
  if (statusCode >= 200 && statusCode < 300) {
    return;
  }

  throw new Error(`${action}失败: HTTP ${statusCode}`);
}

/**
 * 氚云老版本 API 服务类
 */
export class H3YunLegacyApiService {
  /**
   * 设置认证信息
   * @param token h3_token
   * @param engineCode 企业引擎编码
   */
  setToken(token: string, engineCode: string): void {
    globalToken = token;
    globalEngineCode = engineCode;
    loadFormCache.clear();
    customCodeCache.clear();
    listViewCodeCache.clear();
    loadFormFailures.length = 0;
  }

  /**
   * 清空所有缓存
   */
  clearCaches(): void {
    loadFormCache.clear();
    customCodeCache.clear();
    listViewCodeCache.clear();
  }

  /**
   * 获取并清空 LoadForm 请求失败节点
   */
  consumeLoadFormFailures(): Array<{ code: string; name: string; error: string }> {
    const failures = [...loadFormFailures];
    loadFormFailures.length = 0;
    return failures;
  }

  /**
   * 获取应用信息
   * @param appCode 应用编码
   * @returns 应用信息
   */
  async getApplication(appCode: string): Promise<H3Application> {
    try {
      return await this.getApplicationFromList(appCode);
    } catch (error) {
      throw new Error(`获取应用信息失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取应用下的所有表单,按氚云应用菜单顺序返回。
   * 应用菜单中的分组节点不会作为表单返回,其名称记录在表单的 groupPath 中。
   * @param appCode 应用编码
   * @returns 表单列表
   */
  async getForms(appCode: string, knownFormCodes?: Set<string>): Promise<H3Form[]> {
    try {
      const nodes = await this.getFunctionNodes(appCode);
      const formEntries = await mapWithConcurrency(
        this.resolveFormNodes(appCode, nodes),
        FORM_REQUEST_CONCURRENCY,
        async ({ node, groupPath }) => {
          let loadFormResponse: SheetDesignerLoadFormResponse;

          try {
            loadFormResponse = await this.loadFormDesign(node.code);
          } catch (error) {
            // 已知表单(编码已记录在 cmax.json)的 LoadForm 失败必须记入失败并中断同步,
            // 氚云不存在表单转报表逻辑,失败说明本次没有同步到,不能当作已删除。
            const isKnownForm = knownFormCodes?.has(node.code) ?? false;
            if (isKnownForm || (!knownFormCodes && !isReportNode(node))) {
              loadFormFailures.push({
                code: node.code,
                name: node.displayName,
                error: error instanceof Error ? error.message : String(error)
              });
            }
            return null;
          }

          if (!hasFormSchema(loadFormResponse)) {
            // 已知表单必须返回表单结构;没有结构说明本次没同步到,记入失败以中断同步。
            // 未同步过的节点可能是报表等非表单节点,直接跳过。
            if (knownFormCodes?.has(node.code)) {
              loadFormFailures.push({
                code: node.code,
                name: node.displayName,
                error: 'LoadForm 未返回表单结构'
              });
            }
            return null;
          }

          return {
            formCode: node.code,
            formName: node.displayName,
            description: node.summary || undefined,
            ...(groupPath.length > 0 ? { groupPath: [...groupPath] } : {})
          } as H3Form;
        }
      );

      return formEntries.filter((entry): entry is H3Form => entry !== null);
    } catch (error) {
      throw new Error(`获取表单列表失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 从应用节点列表中区分分组节点和表单节点,并解析表单的分组路径。
   * 氚云应用菜单只有一个层级的分组,分组编码会作为其下表单的 parentCode 出现,
   * 因此“被其他节点作为 parentCode 引用”的节点即分组节点,不依赖 NodeType。
   * 先按 parentCode 还原菜单树,再按接口返回的节点顺序深度优先展开,
   * 保证同一分组的表单连续输出,且整体顺序与氚云应用菜单一致。
   * @param appCode 应用编码
   * @param nodes 应用下的节点列表
   */
  private resolveFormNodes(
    appCode: string,
    nodes: H3FunctionNode[]
  ): Array<{ node: H3FunctionNode; groupPath: string[] }> {
    const nodeByCode = new Map(
      nodes.filter((node) => !!node.code).map((node) => [node.code, node])
    );

    // 按 parentCode 归并子节点,子节点列表保持接口返回顺序。
    const childNodesByParent = new Map<string, H3FunctionNode[]>();
    for (const node of nodes) {
      if (!node.code) continue;
      const parentCode = node.parentCode || appCode;
      const siblings = childNodesByParent.get(parentCode);
      if (siblings) {
        siblings.push(node);
      } else {
        childNodesByParent.set(parentCode, [node]);
      }
    }

    // 被其他节点作为 parentCode 引用、且自身也在节点列表中的节点即分组节点。
    const groupCodes = new Set<string>();
    for (const parentCode of childNodesByParent.keys()) {
      if (parentCode !== appCode && nodeByCode.has(parentCode)) {
        groupCodes.add(parentCode);
      }
    }

    const formNodes: Array<{ node: H3FunctionNode; groupPath: string[] }> = [];
    const emittedCodes = new Set<string>();

    const visit = (parentCode: string, groupPath: string[]): void => {
      for (const node of childNodesByParent.get(parentCode) || []) {
        if (emittedCodes.has(node.code)) continue;
        emittedCodes.add(node.code);

        if (groupCodes.has(node.code)) {
          visit(node.code, [...groupPath, node.displayName]);
        } else {
          formNodes.push({ node, groupPath });
        }
      }
    };

    visit(appCode, []);

    // 兜底:分组编码不在节点列表内导致未挂上树的节点,按返回顺序补到顶层。
    for (const node of nodes) {
      if (!node.code || emittedCodes.has(node.code) || groupCodes.has(node.code)) continue;
      emittedCodes.add(node.code);
      formNodes.push({ node, groupPath: [] });
    }

    return formNodes;
  }

  private async getFunctionNodes(parentCode: string): Promise<H3FunctionNode[]> {
    const url = buildUrl('/v1/functionnode/children');
    const headers = getAuthHeaders();
    const body = JSON.stringify({
      parentCode,
      checkHasChild: false
    });

    const response = await post(url, body, headers);
    ensureSuccessfulStatus(response.statusCode, '获取应用节点');
    const apiResponse = parseJsonResponse<FunctionNodeChildrenResponse>(response);
    return parseFunctionNodes(apiResponse);
  }

  private async getApplicationFromList(appCode: string): Promise<H3Application> {
    const url = buildUrl('/v1/functionnode/app/list');
    const headers = getAuthHeaders();
    const response = await get(url, headers);

    ensureSuccessfulStatus(response.statusCode, '获取应用列表');
    const apiResponse = parseJsonResponse<FunctionNodeAppListResponse>(response);
    return parseApplication(apiResponse, appCode);
  }

  /**
   * 获取表单字段表
   * @param formCode 表单编码
   * @returns 字段表文本
   */
  async getFormFields(formCode: string): Promise<string> {
    try {
      const apiResponse = await this.loadFormDesign(formCode);
      return parseSchemaJSON(apiResponse, formCode);
    } catch (error) {
      throw new Error(`获取表单字段失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async loadFormDesign(formCode: string): Promise<SheetDesignerLoadFormResponse> {
    const cachedResponse = loadFormCache.get(formCode);

    if (cachedResponse) {
      return cachedResponse;
    }

    const url = buildUrl('/Console/SheetDesigner/OnAction');
    const headers = {
      ...getAuthHeaders(),
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    const postData = JSON.stringify({
      ActionName: 'LoadForm',
      id: formCode
    });
    const body = `PostData=${encodeURIComponent(postData)}`;
    const response = await post(url, body, headers);

    ensureSuccessfulStatus(response.statusCode, '获取表单字段');
    const apiResponse = parseJsonResponse<SheetDesignerLoadFormResponse>(response);
    loadFormCache.set(formCode, apiResponse);

    return apiResponse;
  }

  /**
   * 获取表单前端代码
   * @param formCode 表单编码
   * @returns 前端代码内容
   */
  async getFormFrontendCode(formCode: string): Promise<string> {
    try {
      const customCode = await this.loadCustomCode(formCode);
      return customCode.formFrontendCode;
    } catch (error) {
      console.warn(`获取表单前端代码失败: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }

  /**
   * 获取表单后端代码
   * @param formCode 表单编码
   * @returns 后端代码内容
   */
  async getFormBackendCode(formCode: string): Promise<string> {
    try {
      const customCode = await this.loadCustomCode(formCode);
      return customCode.formBackendCode;
    } catch (error) {
      console.warn(`获取表单后端代码失败: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }

  /**
   * 获取列表前端代码
   * @param formCode 表单编码
   * @returns 列表前端代码内容
   */
  async getListFrontendCode(formCode: string): Promise<string> {
    try {
      const listViewCode = await this.loadListViewCode(formCode);
      return listViewCode.listFrontendCode;
    } catch (error) {
      console.warn(`获取列表前端代码失败: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }

  private async loadCustomCode(formCode: string): Promise<FormCustomCode> {
    const cachedCode = customCodeCache.get(formCode);

    if (cachedCode) {
      return cachedCode;
    }

    const url = buildUrl('/Console/SheetDesigner/OnAction');
    const headers = {
      ...getAuthHeaders(),
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded',
      'SchemaCode': formCode
    };
    const postData = JSON.stringify({
      ActionName: 'LoadCustomCode',
      SchemaCode: formCode
    });
    const body = `PostData=${encodeURIComponent(postData)}`;
    const response = await post(url, body, headers);

    ensureSuccessfulStatus(response.statusCode, '获取表单自定义代码');
    const apiResponse = parseJsonResponse<LoadCustomCodeResponse>(response);
    const customCode = parseFormCustomCode(apiResponse);
    customCodeCache.set(formCode, customCode);

    return customCode;
  }

  /**
   * 获取列表后端代码
   * @param formCode 表单编码
   * @returns 列表后端代码内容
   */
  async getListBackendCode(formCode: string): Promise<string> {
    try {
      const listViewCode = await this.loadListViewCode(formCode);
      return listViewCode.listBackendCode;
    } catch (error) {
      console.warn(`获取列表后端代码失败: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }

  protected async loadListViewCode(formCode: string): Promise<ListViewCode> {
    const cachedCode = listViewCodeCache.get(formCode);

    if (cachedCode) {
      return cachedCode;
    }

    const url = buildUrl('/ListViewDesigner/OnAction');
    const headers = {
      ...getAuthHeaders(),
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    const postData = JSON.stringify({
      ActionName: 'Load',
      id: formCode
    });
    const body = `PostData=${encodeURIComponent(postData)}`;
    const response = await post(url, body, headers);

    ensureSuccessfulStatus(response.statusCode, '获取列表代码');
    const apiResponse = parseJsonResponse<ListViewDesignerLoadResponse>(response);
    const listViewCode = parseListViewCode(apiResponse);
    listViewCodeCache.set(formCode, listViewCode);

    return listViewCode;
  }

  /**
   * 查询 System 用户的 ObjectId,用于 MCP 执行 SQL 查询
   * @returns System 用户 ObjectId,查询失败返回空字符串
   */
  async getSystemUserId(): Promise<string> {
    try {
      const SYSTEM_USER_SQL = "select ObjectId from h_user where name='System'";
      const url = buildUrl('/Console/Reporting/OnAction');
      const headers = {
        ...getAuthHeaders(),
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      };
      const postData = JSON.stringify({
        ActionName: 'CheckSQL',
        Sql: SYSTEM_USER_SQL,
        Columns: '[]'
      });
      const body = `PostData=${encodeURIComponent(postData)}`;
      const response = await post(url, body, headers);
      const result = parseJsonResponse<{
        Successful?: boolean;
        success?: boolean;
        ReturnData?: { rows?: Array<{ objectid?: string; ObjectId?: string }> };
      }>(response);
      const rows = result?.ReturnData?.rows;
      const systemUserId = Array.isArray(rows) && rows.length > 0
        ? (rows[0]?.objectid || rows[0]?.ObjectId || '')
        : '';

      return systemUserId;
    } catch (error) {
      console.warn(`查询 System 用户 ID 失败: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }

  /**
   * 按指定范围获取表单的设计与代码内容。
   * 只请求范围内需要的接口,避免“仅同步表单设计”时额外拉取代码。
   * 范围内各请求并行发出,与整体同步的性能一致。
   * 返回值按 FileContentMap 的固定键顺序构造,保证冲突预览和写入顺序稳定。
   * @param formCode 表单编码
   * @param scope 同步范围
   * @returns 本次范围内需要写入的文件内容映射
   */
  async getFormCodes(formCode: string, scope: SyncScope = 'all'): Promise<Partial<FileContentMap>> {
    // 两个任务在 await 之前就已经发起,保证范围内请求仍然是并行的。
    const fieldsTask = (scope === 'formDesign' || scope === 'all')
      ? this.getFormFields(formCode)
      : Promise.resolve(undefined);

    const codeTask = (scope === 'code' || scope === 'all')
      ? Promise.all([
        this.getFormFrontendCode(formCode),
        this.getFormBackendCode(formCode),
        this.getListFrontendCode(formCode),
        this.getListBackendCode(formCode)
      ])
      : Promise.resolve(undefined);

    const [fields, codeContents] = await Promise.all([fieldsTask, codeTask]);

    // 按固定顺序输出,范围外的键不写入,由调用方跳过。
    const codes: Partial<FileContentMap> = {};

    if (fields !== undefined) {
      codes['fields.md'] = fields;
    }

    if (codeContents) {
      const [formFrontend, formBackend, listFrontend, listBackend] = codeContents;
      codes['form-frontend.js'] = useDefaultCodeIfEmpty('form-frontend.js', formFrontend, formCode);
      codes['form-backend.cs'] = useDefaultCodeIfEmpty('form-backend.cs', formBackend, formCode);
      codes['list-frontend.js'] = useDefaultCodeIfEmpty('list-frontend.js', listFrontend, formCode);
      codes['list-backend.cs'] = useDefaultCodeIfEmpty('list-backend.cs', listBackend, formCode);
    }

    if (Object.keys(codes).length === 0) {
      throw new Error(`未知的同步范围: ${scope}`);
    }

    return codes;
  }

  /**
   * 获取表单的所有代码内容
   * @param formCode 表单编码
   * @returns 所有代码内容的映射
   */
  async getFormAllCodes(formCode: string): Promise<FileContentMap> {
    const codes = await this.getFormCodes(formCode, 'all');

    // 只校验键是否补齐,允许内容为空字符串(远端确实可能没有代码)。
    if (codes['fields.md'] === undefined
      || codes['form-frontend.js'] === undefined
      || codes['form-backend.cs'] === undefined
      || codes['list-frontend.js'] === undefined
      || codes['list-backend.cs'] === undefined) {
      throw new Error(`获取表单 ${formCode} 的完整代码失败`);
    }

    return codes as FileContentMap;
  }

  /**
   * 获取应用下全部表单的自动化配置。
   * 接口按表单分组返回,分组内是该表单的全部自动化。
   * @param appCode 应用编码
   * @param fieldLabelMap 字段与表单名称索引,用于把编码翻译为可读名称
   */
  async getAutomations(appCode: string, fieldLabelMap?: FieldLabelIndex) {
    const url = buildUrl('/Automatic/OnAction');
    const headers = {
      ...getAuthHeaders(),
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    const postData = JSON.stringify({
      ActionName: 'LoadTriggersByAppCode',
      AppCode: appCode
    });
    const body = `PostData=${encodeURIComponent(postData)}`;
    const response = await post(url, body, headers);

    ensureSuccessfulStatus(response.statusCode, '获取自动化配置');
    const apiResponse = parseJsonResponse<AutomaticTriggersResponse>(response);
    return parseAutomations(
      apiResponse,
      fieldLabelMap || {
        labels: new Map(),
        childrenOf: new Map(),
        childNames: new Map(),
        formNames: new Map()
      }
    );
  }

  /**
   * 根据主表或子表编码查询所属表单名称。
   */
  async queryFormNames(formCode: string, systemUserId?: string): Promise<Array<{
    formCode: string;
    childSchemas: string;
    formName: string;
  }>> {
    if (!systemUserId) {
      throw new Error('无法获取执行 SQL 所需的 System 用户 ID');
    }
    const executionUserId = systemUserId;

    const sql = [
      'SELECT SchemaCode AS `主表编码`, ChildSchemas AS `子表编码`,',
      "extractvalue(Content,'/BizObjectSchema/DisplayName') AS `主表名称`",
      'FROM H_PublishedBizObjectSchema',
      `WHERE SchemaCode = '${formCode}' OR ChildSchemas LIKE '%${formCode}%'`
    ].join(' ');
    const response = await post(
      buildUrl(SQL_PREVIEW_API_PATH),
      JSON.stringify({
        sql,
        corpId: globalEngineCode,
        config: {
          userId: executionUserId,
          extra: { icon: 'icon-cgfk' }
        }
      }),
      {
        ...getAuthHeaders(),
        'Accept': 'application/json, text/plain, */*',
        'Origin': API_BASE_URL
      }
    );
    ensureSuccessfulStatus(response.statusCode, '查询表单名称');

    const result = parseJsonResponse<{
      Successful?: boolean;
      success?: boolean;
      Errors?: unknown[];
      ReturnData?: { rows?: Array<Record<string, unknown>> };
      data?: { data?: Array<Record<string, unknown>> };
    }>(response);
    if (result.Successful === false || result.success === false || (result.Errors && result.Errors.length > 0)) {
      throw new Error(`氚云平台返回查询失败: ${JSON.stringify(result.Errors || result)}`);
    }

    const rows = result.data?.data || result.ReturnData?.rows || [];
    return rows.map((row) => ({
      formCode: String(row['主表编码'] || row.SchemaCode || ''),
      childSchemas: String(row['子表编码'] || row.ChildSchemas || ''),
      formName: String(row['主表名称'] || row.DisplayName || '')
    }));
  }
}

// 导出老版本 API 单例实例
export const h3yunLegacyApi = new H3YunLegacyApiService();
