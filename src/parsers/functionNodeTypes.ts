/**
 * 氚云功能节点通用结构
 */
export interface H3FunctionNode {
  objectId: string;
  code: string;
  displayName: string;
  appCode: string;
  parentCode: string | null;
  nodeType: number;
  hasChild: boolean;
  summary?: string | null;
}
