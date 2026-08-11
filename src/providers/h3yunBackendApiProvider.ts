import * as path from 'path';
import * as vscode from 'vscode';

type ApiItem = {
  label: string;
  detail: string;
  documentation: string;
  insertText?: string;
  kind?: vscode.CompletionItemKind;
};

const namespaces: Record<string, ApiItem[]> = {
  H3: [
    item('Data', 'namespace H3.Data', '数据类型、筛选条件和参数化 SQL 参数。', 'Data', vscode.CompletionItemKind.Module),
    item('DataModel', 'namespace H3.DataModel', '业务对象、表单结构和批量提交。', 'DataModel', vscode.CompletionItemKind.Module),
    item('Organization', 'namespace H3.Organization', '组织与人员对象。', 'Organization', vscode.CompletionItemKind.Module),
    item('Task', 'namespace H3.Task', '待办与任务对象。', 'Task', vscode.CompletionItemKind.Module),
    item('Workflow', 'namespace H3.Workflow', '流程实例、模板、消息和工作项。', 'Workflow', vscode.CompletionItemKind.Module),
    item('IEngine', 'class H3.IEngine', '氚云引擎对象。表单后端通常通过 this.Engine 获取。', 'IEngine', vscode.CompletionItemKind.Class),
    item('Query', 'class H3.Query', 'SQL 查询对象。', 'Query', vscode.CompletionItemKind.Class),
    item('BizObjectManager', 'class H3.BizObjectManager', '表单结构管理对象。', 'BizObjectManager', vscode.CompletionItemKind.Class),
    item('ErrorCode', 'enum H3.ErrorCode', '氚云错误码枚举。', 'ErrorCode', vscode.CompletionItemKind.Enum),
    item('LinkTargetType', 'enum H3.LinkTargetType', '任务链接目标类型枚举。', 'LinkTargetType', vscode.CompletionItemKind.Enum)
  ],
  'H3.Data': [
    item('BizDataType', 'enum H3.Data.BizDataType', '业务数据类型枚举。', 'BizDataType', vscode.CompletionItemKind.Enum),
    item('ComparisonOperatorType', 'enum H3.Data.ComparisonOperatorType', '筛选比较运算符枚举。', 'ComparisonOperatorType', vscode.CompletionItemKind.Enum),
    item('Database', 'namespace H3.Data.Database', '数据库参数对象。', 'Database', vscode.CompletionItemKind.Module),
    item('Filter', 'namespace H3.Data.Filter', '查询筛选与排序对象。', 'Filter', vscode.CompletionItemKind.Module)
  ],
  'H3.Data.Database': [item('Parameter', 'class H3.Data.Database.Parameter', '参数化 SQL 参数。', 'Parameter', vscode.CompletionItemKind.Class)],
  'H3.Data.Filter': [
    item('Matcher', 'interface H3.Data.Filter.Matcher', '筛选条件接口。', 'Matcher', vscode.CompletionItemKind.Interface),
    item('And', 'class H3.Data.Filter.And', '多个筛选条件的 AND 组合。', 'And', vscode.CompletionItemKind.Class),
    item('Or', 'class H3.Data.Filter.Or', '多个筛选条件的 OR 组合。', 'Or', vscode.CompletionItemKind.Class),
    item('ItemMatcher', 'class H3.Data.Filter.ItemMatcher', '单个字段筛选条件。', 'ItemMatcher', vscode.CompletionItemKind.Class),
    item('Filter', 'class H3.Data.Filter.Filter', '查询筛选、分页和排序条件。', 'Filter', vscode.CompletionItemKind.Class),
    item('SortBy', 'class H3.Data.Filter.SortBy', '单个排序条件。', 'SortBy', vscode.CompletionItemKind.Class),
    item('SortDirection', 'enum H3.Data.Filter.SortDirection', '排序方向枚举。', 'SortDirection', vscode.CompletionItemKind.Enum)
  ],
  'H3.DataModel': [
    item('BizObject', 'class H3.DataModel.BizObject', '氚云业务对象。', 'BizObject', vscode.CompletionItemKind.Class),
    item('BizObjectSchema', 'class H3.DataModel.BizObjectSchema', '业务对象表单结构。', 'BizObjectSchema', vscode.CompletionItemKind.Class),
    item('PropertySchema', 'class H3.DataModel.PropertySchema', '控件属性结构。', 'PropertySchema', vscode.CompletionItemKind.Class),
    item('BulkCommit', 'class H3.DataModel.BulkCommit', '业务对象批量提交。', 'BulkCommit', vscode.CompletionItemKind.Class),
    item('BizObjectStatus', 'enum H3.DataModel.BizObjectStatus', '业务对象状态枚举。', 'BizObjectStatus', vscode.CompletionItemKind.Enum),
    item('GetListScopeType', 'enum H3.DataModel.GetListScopeType', '业务对象查询范围枚举。', 'GetListScopeType', vscode.CompletionItemKind.Enum)
  ],
  'H3.Organization': [item('User', 'class H3.Organization.User', '氚云人员对象。', 'User', vscode.CompletionItemKind.Class)],
  'H3.Task': [
    item('ITaskManager', 'class H3.Task.ITaskManager', '待办任务管理器。', 'ITaskManager', vscode.CompletionItemKind.Class),
    item('UserTask', 'class H3.Task.UserTask', '待办任务对象。', 'UserTask', vscode.CompletionItemKind.Class),
    item('TaskType', 'enum H3.Task.TaskType', '任务类型枚举。', 'TaskType', vscode.CompletionItemKind.Enum),
    item('TaskState', 'enum H3.Task.TaskState', '任务状态枚举。', 'TaskState', vscode.CompletionItemKind.Enum),
    item('ReminderType', 'enum H3.Task.ReminderType', '提醒周期枚举。', 'ReminderType', vscode.CompletionItemKind.Enum),
    item('AlertState', 'enum H3.Task.AlertState', '提醒状态枚举。', 'AlertState', vscode.CompletionItemKind.Enum)
  ],
  'H3.Workflow': [
    item('Instance', 'namespace H3.Workflow.Instance', '流程实例对象。', 'Instance', vscode.CompletionItemKind.Module),
    item('Messages', 'namespace H3.Workflow.Messages', '流程操作消息对象。', 'Messages', vscode.CompletionItemKind.Module),
    item('Template', 'namespace H3.Workflow.Template', '流程模板对象。', 'Template', vscode.CompletionItemKind.Module),
    item('WorkItem', 'namespace H3.Workflow.WorkItem', '流程工作项枚举。', 'WorkItem', vscode.CompletionItemKind.Module)
  ],
  'H3.Workflow.Instance': [item('IWorkflowInstanceManager', 'class H3.Workflow.Instance.IWorkflowInstanceManager', '流程实例管理器。', 'IWorkflowInstanceManager', vscode.CompletionItemKind.Class), item('WorkflowInstance', 'class H3.Workflow.Instance.WorkflowInstance', '流程实例。', 'WorkflowInstance', vscode.CompletionItemKind.Class), item('Token', 'class H3.Workflow.Instance.Token', '流程令牌。', 'Token', vscode.CompletionItemKind.Class)],
  'H3.Workflow.Messages': [
    item('Message', 'abstract class H3.Workflow.Messages.Message', '流程操作消息基类。', 'Message', vscode.CompletionItemKind.Class),
    item('ActivateInstanceMessage', 'class H3.Workflow.Messages.ActivateInstanceMessage', '激活流程实例消息。', 'ActivateInstanceMessage', vscode.CompletionItemKind.Class),
    item('ActivateActivityMessage', 'class H3.Workflow.Messages.ActivateActivityMessage', '激活流程节点消息。', 'ActivateActivityMessage', vscode.CompletionItemKind.Class),
    item('FinishInstanceMessage', 'class H3.Workflow.Messages.FinishInstanceMessage', '结束流程实例消息。', 'FinishInstanceMessage', vscode.CompletionItemKind.Class),
    item('CancelInstanceMessage', 'class H3.Workflow.Messages.CancelInstanceMessage', '作废流程实例消息。', 'CancelInstanceMessage', vscode.CompletionItemKind.Class),
    item('WorkflowInstanceChangeSet', 'class H3.Workflow.Messages.WorkflowInstanceChangeSet', '流程实例变更结果。', 'WorkflowInstanceChangeSet', vscode.CompletionItemKind.Class)
  ],
  'H3.Workflow.Template': [item('IWorkflowTemplateManager', 'class H3.Workflow.Template.IWorkflowTemplateManager', '流程模板管理器。', 'IWorkflowTemplateManager', vscode.CompletionItemKind.Class), item('WorkflowTemplate', 'class H3.Workflow.Template.WorkflowTemplate', '流程模板。', 'WorkflowTemplate', vscode.CompletionItemKind.Class)],
  'H3.Workflow.WorkItem': [
    item('AccessMethod', 'enum H3.Workflow.WorkItem.AccessMethod', '流程访问方式枚举。', 'AccessMethod', vscode.CompletionItemKind.Enum),
    item('ActionEventType', 'enum H3.Workflow.WorkItem.ActionEventType', '流程动作事件类型枚举。', 'ActionEventType', vscode.CompletionItemKind.Enum)
  ]
};

const rootNamespaces: ApiItem[] = [item('H3', 'namespace H3', '氚云后端 API 根命名空间。', 'H3', vscode.CompletionItemKind.Module)];

const constructors: Record<string, ApiItem> = {
  Parameter: item('Parameter', 'Parameter(string name, System.Data.DbType dbType, object value)', '创建参数化 SQL 参数。', 'Parameter("${1:@参数名}", ${2:System.Data.DbType.String}, ${3:value})', vscode.CompletionItemKind.Constructor),
  And: item('And', 'And()', '创建 AND 筛选条件集合。', 'And()', vscode.CompletionItemKind.Constructor),
  Or: item('Or', 'Or()', '创建 OR 筛选条件集合。', 'Or()', vscode.CompletionItemKind.Constructor),
  ItemMatcher: item('ItemMatcher', 'ItemMatcher(string name, H3.Data.ComparisonOperatorType operatorType, object value)', '创建单个字段筛选条件。', 'ItemMatcher("${1:字段编码}", ${2:H3.Data.ComparisonOperatorType.Equal}, ${3:value})', vscode.CompletionItemKind.Constructor),
  Filter: item('Filter', 'Filter()', '创建查询筛选与分页条件。', 'Filter()', vscode.CompletionItemKind.Constructor),
  SortBy: item('SortBy', 'SortBy(string itemName, H3.Data.Filter.SortDirection direction)', '创建单个排序条件。', 'SortBy("${1:字段编码}", ${2:H3.Data.Filter.SortDirection.Ascending})', vscode.CompletionItemKind.Constructor),
  BizObject: item('BizObject', 'BizObject(IEngine engine, BizObjectSchema schema, string userId)', '创建业务对象。', 'BizObject(${1:engine}, ${2:schema}, ${3:userId})', vscode.CompletionItemKind.Constructor),
  BulkCommit: item('BulkCommit', 'BulkCommit()', '创建批量提交对象。', 'BulkCommit()', vscode.CompletionItemKind.Constructor),
  PropertySchema: item('PropertySchema', 'PropertySchema(string name, string displayName, string dataType, string realType, string computationRule, bool isFormula, bool isMappingProperty, bool isRollup)', '创建控件属性结构。', 'PropertySchema("${1:编码}", "${2:名称}", "${3:数据类型}", "${4:实际类型}", "${5:公式}", ${6:false}, ${7:false}, ${8:false})', vscode.CompletionItemKind.Constructor),
  UserTask: item('UserTask', 'UserTask()', '创建待办任务对象。', 'UserTask()', vscode.CompletionItemKind.Constructor),
  ActivateInstanceMessage: item('ActivateInstanceMessage', 'ActivateInstanceMessage(string instanceId)', '创建激活流程实例消息。', 'ActivateInstanceMessage("${1:流程实例Id}")', vscode.CompletionItemKind.Constructor),
  ActivateActivityMessage: item('ActivateActivityMessage', 'ActivateActivityMessage(string instanceId, string activityCode, int tokenId, string[] participants, int[] preTokens, bool checkEntry, H3.Workflow.WorkItem.ActionEventType preActionEventType)', '创建激活流程节点消息。', 'ActivateActivityMessage("${1:流程实例Id}", "${2:节点编码}", ${3:tokenId}, ${4:participants}, ${5:preTokens}, ${6:true}, ${7:H3.Workflow.WorkItem.ActionEventType.Automatic})', vscode.CompletionItemKind.Constructor),
  FinishInstanceMessage: item('FinishInstanceMessage', 'FinishInstanceMessage(string instanceId, int finalTokenId)', '创建结束流程实例消息。', 'FinishInstanceMessage("${1:流程实例Id}", ${2:finalTokenId})', vscode.CompletionItemKind.Constructor),
  CancelInstanceMessage: item('CancelInstanceMessage', 'CancelInstanceMessage(string instanceId, bool recursive)', '创建作废流程实例消息。', 'CancelInstanceMessage("${1:流程实例Id}", ${2:true})', vscode.CompletionItemKind.Constructor),
  WorkflowTemplate: item('WorkflowTemplate', 'WorkflowTemplate()', '创建流程模板对象。', 'WorkflowTemplate()', vscode.CompletionItemKind.Constructor)
};

const members: Record<string, ApiItem[]> = {
  IEngine: [item('Query', 'Query: H3.Query', 'SQL 查询对象。', 'Query', vscode.CompletionItemKind.Field), item('BizObjectManager', 'BizObjectManager: H3.BizObjectManager', '业务对象管理器。', 'BizObjectManager', vscode.CompletionItemKind.Field), item('TaskManager', 'TaskManager: H3.Task.ITaskManager', '任务管理器。', 'TaskManager', vscode.CompletionItemKind.Field), item('WorkflowTemplateManager', 'WorkflowTemplateManager: H3.Workflow.Template.IWorkflowTemplateManager', '流程模板管理器。', 'WorkflowTemplateManager', vscode.CompletionItemKind.Field), item('WorkflowInstanceManager', 'WorkflowInstanceManager: H3.Workflow.Instance.IWorkflowInstanceManager', '流程实例管理器。', 'WorkflowInstanceManager', vscode.CompletionItemKind.Field)],
  Query: [item('QueryTable', 'QueryTable(string sql, params Parameter[] ps)', '执行参数化 SQL 查询并返回 DataTable。', 'QueryTable("${1:SELECT ...}", ${2:parameters})')],
  BizObjectManager: [item('GetPublishedSchema', 'GetPublishedSchema(string schemaCode)', '获取已发布表单的业务对象结构。', 'GetPublishedSchema("${1:表单编码}")')],
  Parameter: properties(['Name: string', 'DbType: System.Data.DbType', 'Value: object']),
  And: properties(['Type: string', 'Matchers: List<Matcher>'], [item('Add', 'Add(Matcher item)', '增加 AND 筛选条件。', 'Add(${1:matcher})')]),
  Or: properties(['Type: string', 'Matchers: List<Matcher>'], [item('Add', 'Add(Matcher item)', '增加 OR 筛选条件。', 'Add(${1:matcher})')]),
  ItemMatcher: properties(['Type: string', 'Name: string', 'Operator: H3.Data.ComparisonOperatorType', 'Value: object', 'IsColumn: bool']),
  Filter: properties(['FromRowNum: int', 'ToRowNum: int', 'RequireCount: bool', 'ReturnItems: string[]', 'SortByCollection: SortBy[]', 'Matcher: Matcher'], [item('AddSortBy', 'AddSortBy(string field, SortDirection direction)', '添加排序字段。', 'AddSortBy("${1:字段编码}", H3.Data.Filter.SortDirection.${2:Ascending})')]),
  SortBy: properties(['ItemName: string', 'Direction: H3.Data.Filter.SortDirection']),
  BizObject: [item('Load', 'Load()', '重新加载当前业务对象数据。'), item('CalcExpression', 'CalcExpression(string computationRule)', '计算公式表达式。', 'CalcExpression("${1:公式}")'), item('Create', 'Create() / Create(BulkCommit commit)', '创建业务对象，或加入批量提交。'), item('Update', 'Update() / Update(BulkCommit commit)', '更新业务对象，或加入批量提交。'), item('Remove', 'Remove() / Remove(BulkCommit commit)', '删除业务对象，或加入批量提交。'), ...properties(['Schema: BizObjectSchema', 'Parent: BizObject', 'ObjectId: string', 'Name: string', 'OwnerId: string', 'OwnerDeptId: string', 'Status: BizObjectStatus', 'WorkflowInstanceId: string', 'CreatedBy: string', 'CreatedTime: DateTime', 'ModifiedBy: string', 'ModifiedTime: DateTime'])],
  BizObjectSchema: [item('PropertyExist', 'PropertyExist(string propertyName)', '判断控件编码是否存在。', 'PropertyExist("${1:控件编码}")'), item('GetProperty', 'GetProperty(string propertyName)', '获取控件属性结构。', 'GetProperty("${1:控件编码}")'), item('GetChildSchema', 'GetChildSchema(string childSchemaCode)', '获取子表结构。', 'GetChildSchema("${1:子表编码}")'), ...properties(['Properties: PropertySchema[]', 'ChildSchemas: BizObjectSchema[]', 'SchemaCode: string', 'DisplayName: string', 'ParentSchema: BizObjectSchema', 'ParentSchemaCode: string'])],
  PropertySchema: properties(['Name: string', 'DisplayName: string', 'DataType: H3.Data.BizDataType', 'RealType: Type', 'ComputationRule: string', 'IsFormula: bool', 'IsMappingProperty: bool', 'IsRollup: bool']),
  BulkCommit: [item('Commit', 'Commit(BizObjectManager bizObjectManager, out string errorMsg)', '提交已加入的批量业务对象操作。', 'Commit(${1:bizObjectManager}, out ${2:errorMsg})')],
  ITaskManager: [item('AddTask', 'AddTask(UserTask userTask)', '新增单个待办任务。', 'AddTask(${1:userTask})'), item('AddTasks', 'AddTasks(UserTask[] userTasks)', '批量新增待办任务。', 'AddTasks(${1:userTasks})')],
  IWorkflowTemplateManager: [item('GetDefaultWorkflow', 'GetDefaultWorkflow(string schemaCode)', '获取表单的默认流程模板。', 'GetDefaultWorkflow("${1:表单编码}")')],
  IWorkflowInstanceManager: [item('SendMessage', 'SendMessage(Message message)', '向流程实例发送操作消息。', 'SendMessage(${1:message})'), item('OriginateInstance', 'OriginateInstance(userId, schemaCode, workflowVersion, bizObjectId, instanceId, accessPoint, finishStartActivity, destActivityCode, returnWorkItem, out workItemId, out errorMessage)', '发起流程实例。', 'OriginateInstance(${1:userId}, "${2:表单编码}", ${3:workflowVersion}, ${4:bizObjectId}, ${5:instanceId}, ${6:accessPoint}, ${7:true}, "${8:节点编码}", ${9:false}, out ${10:workItemId}, out ${11:errorMessage})'), item('GetWorkflowInstance', 'GetWorkflowInstance(string instanceId)', '获取流程实例。', 'GetWorkflowInstance("${1:流程实例Id}")')],
  UserTask: properties(['ObjectId: string', 'Sender: string', 'UserId: string', 'AppCode: string', 'TaskType: H3.Task.TaskType', 'SchemaCode: string', 'TargetType: H3.LinkTargetType', 'TargetId: string', 'TargetName: string', 'Name: string', 'Summary: string', 'AlertTime: DateTime', 'ReminderType: H3.Task.ReminderType', 'StartTime: DateTime', 'EndTime: DateTime', 'TaskState: H3.Task.TaskState', 'AlertState: H3.Task.AlertState']),
  WorkflowInstance: properties(['InstanceId: string', 'InstanceName: string', 'FinalTokenId: int']),
  Message: properties(['InstanceId: string']),
  ActivateActivityMessage: properties(['ActivityCode: string', 'TokenId: int', 'Participants: string[]', 'PreTokens: int[]', 'CheckEntry: bool', 'PreActionEventType: H3.Workflow.WorkItem.ActionEventType']),
  FinishInstanceMessage: properties(['FinalTokenId: int']),
  CancelInstanceMessage: properties(['Recursive: bool']),
  WorkflowTemplate: properties(['ObjectId: string', 'SchemaCode: string', 'StartActivityCode: string', 'EndActivityCode: string', 'InstanceName: string', 'WorkflowName: string', 'WorkflowFullName: string', 'WorkflowVersion: int'])
};

const staticMembers: Record<string, ApiItem[]> = {
  BizObject: [item('GetList', 'GetList(IEngine engine, string userId, BizObjectSchema schema, GetListScopeType scopeType, Filter filter)', '按筛选条件获取业务对象列表。', 'GetList(${1:engine}, ${2:userId}, ${3:schema}, ${4:scopeType}, ${5:filter})'), item('Load', 'Load(string userId, IEngine engine, string schemaCode, string objectId, bool requireRelatedObjects)', '加载指定表单数据。', 'Load(${1:userId}, ${2:engine}, "${3:表单编码}", "${4:数据Id}", ${5:false})')],
  BizObjectSchema: [item('IsBoReservedPropertiesOnly', 'IsBoReservedPropertiesOnly(string propertyName)', '判断是否为业务对象系统字段。', 'IsBoReservedPropertiesOnly("${1:字段编码}")')],
  User: [item('SystemUserId', 'SystemUserId: string', '系统用户 Id。', 'SystemUserId', vscode.CompletionItemKind.Field)]
};

const enumValues: Record<string, string[]> = {
  BizDataType: ['Address', 'Association', 'AssociationArray', 'AssociationPropertyDataType', 'BizObject', 'BizObjectArray', 'BizStructure', 'BizStructureArray', 'Bool', 'ByteArray', 'DateTime', 'Double', 'File', 'Formula', 'Html', 'Image', 'Int', 'Long', 'Map', 'Plugin', 'ShortString', 'Signature', 'String', 'TimeSpan', 'Unit', 'UnitArray', 'Unspecified', 'Xml'],
  ComparisonOperatorType: ['Above', 'NotBelow', 'Equal', 'NotAbove', 'Below', 'NotEqual', 'In', 'NotIn', 'Contains', 'StartWith', 'EndWith', 'IsNull', 'NotNull', 'IsNone', 'NotNone', 'NotStartWith', 'NotEndWith', 'NotContains'],
  SortDirection: ['Ascending', 'Descending'],
  BizObjectStatus: ['Draft', 'Effective', 'Running', 'Canceled'],
  GetListScopeType: ['GlobalAll'],
  AlertState: ['Alerted', 'Waiting'],
  ReminderType: ['Daily', 'Monthly', 'None', 'Once', 'Weekly', 'Yearly'],
  TaskState: ['Finished', 'Unfinished', 'Unspecified'],
  TaskType: ['Calendar', 'Reminder', 'Task', 'Unspecified'],
  AccessMethod: ['Batch', 'Email', 'ExternalSystem', 'InternalSystem', 'Mobile', 'SMS', 'Web'],
  ActionEventType: ['Adjust', 'Automatic', 'Backward', 'Cancel', 'ForBack', 'ForComment', 'Forward', 'None', 'Revise', 'TempAddition'],
  LinkTargetType: ['Approve', 'BizObject', 'Cancel', 'Circulate', 'Forward', 'Post', 'Submit', 'WorkItem'],
  ErrorCode: ['AboveContainerConcurrentCap', 'AboveCorporateConcurrentCap', 'AccountTypeInvalid', 'AddEngineFailed', 'AdminRoleCanNotSetDepts', 'AdminRoleUserNumberNotBeZero', 'AnonymousDisabled', 'AnotherSwitchingIsRunning', 'ApplyTooMany', 'ArgumentIsNull', 'AtLeastOneAdministrator', 'AuthorizedLimitError', 'BannerDetailNotExist', 'BizObjectIsTooLarge', 'BizObjectIsUpdating', 'BizObjectReferToRemovingObjects', 'CalcExpressionFailed', 'CanNotAddUser', 'CanNotChangeAnonymous', 'CanNotLoginProductSystem', 'CanNotRemoveObjectWhichReferred', 'CanNotRemoveObjectWithWorkflowInstance', 'CanNotRemoveOwnAdmin', 'CanNotUpdateUserLoginName', 'ChildBizObjectCanNotInvokeMethodAlone', 'ClusterTokenInvalid', 'CodeDuplicated', 'CodeExists', 'CodeInvalid', 'CodeIsNotChangable', 'CodeIsNull', 'CompanyInconsistent', 'CompanyInvalid', 'CompanyNotExists', 'CompileError', 'ConfigureMigrationJobError', 'ConnectionFailed', 'ConnectToDbFailed', 'ConnectToRedisFailed', 'ContactSuiteKeyNotExist', 'ContainerNotExists', 'CorpIdExsit', 'CorpIdNotExists', 'CreateBizRuleProcedureFailed', 'CreateDatabaseFailed', 'CreateDbAccountFailed', 'CreateDtsMigrationJobError', 'CreateShortcutError', 'DingTalkAccessTokenFailed', 'DingTalkAccountInvalid', 'DingTalkCircuitBreak', 'DingTalkCoprIdExists', 'DingTalkCorpExists', 'DingTalkCorpExistsUserNotExists', 'DingTalkCorpIdInvalid', 'DingTalkCorpNotExists', 'DingTalkCorpSecretInvalid', 'DingTalkExistEngineNotExists', 'DingTalkIdInvalid', 'DingTalkIsvBackEndSignatureNotExists', 'DingTalkLoadDepartmentError', 'DingTalkScanFailed', 'DingTalkServiceNotRunning', 'DingTalkSuiteNotExists', 'DropDbFailed', 'DuplicatedRoles', 'DuplicatedShardContainers', 'EmployeeNumberDuplicated', 'EmptyContentOfFile', 'EngineIsRunning', 'EngineNotExists', 'EntryAccessDenied', 'EntryCompanyNotAllowUpdate', 'EntryDepartmentIdInvalid', 'EntryEmailExist', 'EntryEmailInvalid', 'EntryExtattrInvalid', 'EntryGenderInvalid', 'EntryJobnumberInvalid', 'EntryMobileExist', 'EntryMobileInvalid', 'EntryOrderInvalid', 'EntryOrgHasNotRoot', 'EntryParentIdInvalid', 'EntryParentNotExist', 'EntryPositionInvalid', 'EntryRequestResultError', 'EntryUnitError1', 'EntryUnitError2', 'EntryUnitError3', 'EntryUnitError4', 'EntryUnitError5', 'EntryUnitError6', 'EntryUnitError7', 'EntryUnitError8', 'EntryUnitIdExist', 'EntryUnitNameInvalid', 'EntryUnitNotExist', 'EntryUserDisabled', 'EntryUserError1', 'EntryUserError2', 'EntryUserError3', 'EntryUserError4', 'EntryUserError5', 'EntryUserError6', 'EntryUserError7', 'EntryUserError8', 'EntryUserIdExist', 'EntryUserIdInvalid', 'EntryUserIdNotExist', 'EntryUserNameInvalid', 'EntryUserNotExist', 'EveryoneIsUserRoleByDefault', 'Exception', 'FormNotExists', 'GeneralFailed', 'GenerateInvitationCodeFail', 'GetAzureAccessTokenFailed', 'GrantDbAccountFailed', 'H3SecretInvalid', 'HasSensitiveWord', 'HaveAttached', 'IdDuplidated', 'IdInvalid', 'InitializeLogicUnitFailed', 'InstallAppFailed', 'InterfaceException', 'InvalidServiceStateException', 'InvalidState', 'InvitationCodeInvalid', 'InvitationCodeNotExist', 'InvitiedLogtExist', 'IpBlocked', 'JsonInvalid', 'LicenseNotSupportWebService', 'LoadAccessPointTokenFailed', 'LoadEngineException', 'LockVesselFailed', 'LogicUnitArchived', 'LogicUnitDisabled', 'LogicUnitMigrating', 'LogicUnitNotMounted', 'LogicUnitNotRunning', 'LoginNameExists', 'ManagerInvalid', 'MetadataLocked', 'MicroServerError', 'MigratingDatabaseError', 'MigratingShard', 'MigrationTaskErrorEngineConfigSide', 'MigrationTaskExist', 'MigrationTaskHaveMigratedToDest', 'MigrationTaskHaveNotRemoveDatabase', 'MigrationTaskNotBackup', 'MigrationTaskNotFinished', 'MigrationTaskTypeNotMigrateDatabaseSynchronization', 'MobileRequired', 'MountDestError', 'MultipleEngine', 'NameDuplicated', 'NameInvalid', 'NoAllocatableDb', 'NoAvailableDatabase', 'NoAvailableDbServer', 'NoAvailableShardServer', 'NodeNotExists', 'NoFileUpload', 'NotAuthroized', 'NotCanUseSheet', 'NotEnoughAllocatableSlice', 'NotEnoughPermission', 'NotExistSourceServiceInstance', 'NotMaster', 'NotOverride', 'NotSurportAddCorpSecret', 'ObjectIsRemoving', 'OrganizationUnitCycleInvalid', 'OrgRoleNotExists', 'OuDepartmentIdExists', 'OverBannerDetailShowLimitCount', 'OverSolutionUserLimit', 'ParseConditionExistMultiSubSchemaException', 'PasswordInvalid', 'PermanentCodeGetError', 'PostDeptInvalid', 'RegisteringLogicUnit', 'RemoveFail', 'ReportSettingInvalid', 'ReportSettingNotExists', 'ReportSourceInvalid', 'SaveFailed', 'SchemaCodeDuplicated', 'SchemaColumnConflicted', 'SchemaNotExists', 'SchemaRowTooLarge', 'ServerAddressInvalid', 'ServiceContainerIsNotShardedServiceContainer', 'ServiceContainerNotMatch', 'ServiceInternalError', 'ServiceProviderNotFound', 'ServingInstaneBeUsed', 'SettingError', 'ShardAlreadyMounted', 'ShardKeyInvalid', 'ShardKeyNotMatchException', 'SignatureNotExists', 'SourceDbInstanceIdEqualsDestinationDbInstanceId', 'StartMigrationJobError', 'StartVesselFailed', 'SubjectDetailNotExist', 'Success', 'SynchronizingOrganization', 'SyncOrganizationError', 'TimeStampInvalid', 'TooManyVisitWithinIp', 'UpdateFailed', 'UpdateWorkrecordError', 'UserAuthorizedUnspecial', 'UserCodeExists', 'UserCodeIsNull', 'UserDingIdAccountExists', 'UserDingTalkAccountExists', 'UserDisableAuthorized', 'UserDisabled', 'UserEmailExists', 'UserLocked', 'UserMobileExists', 'UserNotAuthorized', 'UserNotExists', 'ValidateNoRepeatRuleFailed', 'ValidateSubmitRuleFailed', 'VerificationCodeInvalid', 'VesselIsRunning', 'VesselNotExists', 'VesselNotRunning', 'ViceParentIdsError', 'WeChatEnterpriseSuiteNotExsit', 'WeightOverFlow', 'WorkflowClauseNotExists', 'WorkflowInstanceNotExists', 'WorkItemNotExists', 'WorkItemParticipantDuplicated', 'WorkItemStateNotMatched']
};

const memberTypes: Record<string, Record<string, string>> = {
  IEngine: { Query: 'Query', BizObjectManager: 'BizObjectManager', TaskManager: 'ITaskManager', WorkflowTemplateManager: 'IWorkflowTemplateManager', WorkflowInstanceManager: 'IWorkflowInstanceManager' }
};

function item(label: string, detail: string, documentation: string, insertText?: string, kind = vscode.CompletionItemKind.Method): ApiItem {
  return { label, detail, documentation, insertText, kind };
}

function properties(definitions: string[], extraItems: ApiItem[] = []): ApiItem[] {
  return definitions.map((definition) => {
    const parts = definition.split(': ');
    return item(parts[0], definition, `公开属性：${definition}。`, parts[0], vscode.CompletionItemKind.Property);
  }).concat(extraItems);
}

function getEnumItems(typeName: string): ApiItem[] | undefined {
  const enumName = Object.keys(enumValues).find((name) => name.toLowerCase() === typeName.toLowerCase());
  const values = enumName ? enumValues[enumName] : undefined;
  return values ? values.map((value) => item(value, `${typeName}.${value}`, `${typeName} 枚举值。`, value, vscode.CompletionItemKind.EnumMember)) : undefined;
}

function getNamespaceItems(namespaceName: string): ApiItem[] | undefined {
  const name = Object.keys(namespaces).find((key) => key.toLowerCase() === namespaceName.toLowerCase());
  return name ? namespaces[name] : undefined;
}

function getStaticMembers(typeName: string): ApiItem[] | undefined {
  const name = Object.keys(staticMembers).find((key) => key.toLowerCase() === typeName.toLowerCase());
  return name ? staticMembers[name] : undefined;
}

function isBackendFile(document: vscode.TextDocument): boolean {
  const fileName = path.basename(document.fileName).toLowerCase();
  return fileName === 'form-backend.cs' || fileName === 'list-backend.cs';
}

function createItems(items: ApiItem[], isNewExpression = false): vscode.CompletionItem[] {
  return items.filter((api) => !isNewExpression || constructors[api.label]).map((api) => {
    const constructor = isNewExpression ? constructors[api.label] : undefined;
    const completion = new vscode.CompletionItem(api.label, constructor ? constructor.kind : api.kind);
    completion.detail = `氚云后端 API: ${constructor ? constructor.detail : api.detail}`;
    completion.documentation = new vscode.MarkdownString(constructor ? constructor.documentation : api.documentation);
    completion.insertText = new vscode.SnippetString(constructor ? constructor.insertText || constructor.label : api.insertText || `${api.label}()`);
    return completion;
  });
}

function getVariableType(document: vscode.TextDocument, position: vscode.Position, variableName: string): string | undefined {
  if (variableName === 'Engine') {
    return 'IEngine';
  }
  const precedingCode = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
  const declaration = new RegExp(`\\b([A-Za-z_][A-Za-z0-9_.]*)\\s+${variableName}\\s*(?:=|;|,|\\))`, 'g');
  let match: RegExpExecArray | null;
  let typeName: string | undefined;
  while ((match = declaration.exec(precedingCode)) !== null) {
    typeName = match[1].split('.').pop();
  }
  if (typeName === 'var') {
    const inferredDeclaration = new RegExp(`\\bvar\\s+${variableName}\\s*=\\s*((?:this\\.)?[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*)\\s*;`, 'g');
    let inferredMatch: RegExpExecArray | null;
    while ((inferredMatch = inferredDeclaration.exec(precedingCode)) !== null) {
      typeName = getExpressionType(document, position, inferredMatch[1]);
    }
  }
  return typeName;
}

function getExpressionType(document: vscode.TextDocument, position: vscode.Position, expression: string): string | undefined {
  const parts = expression.replace(/^this\./, '').split('.');
  let typeName = getVariableType(document, position, parts[0]);
  if (!typeName) {
    return undefined;
  }
  for (let index = 1; index < parts.length; index += 1) {
    typeName = memberTypes[typeName] ? memberTypes[typeName][parts[index]] : undefined;
    if (!typeName) {
      return undefined;
    }
  }
  return typeName;
}

/** 注册仅在氚云后端代码文件中生效的分层 API 补全。 */
export function registerH3yunBackendApiProvider(context: vscode.ExtensionContext): void {
  const selector: vscode.DocumentSelector = [{ language: 'csharp', pattern: '**/{form,list}-backend.cs' }];
  const provider = vscode.languages.registerCompletionItemProvider(selector, {
    provideCompletionItems(document, position) {
      if (!isBackendFile(document)) {
        return undefined;
      }
      const prefix = document.lineAt(position.line).text.slice(0, position.character);
      const isNewExpression = /\bnew\s+H3(?:\.[A-Za-z_][A-Za-z0-9_]*)*\.$/i.test(prefix);
      if (/\bH$/i.test(prefix)) {
        return createItems(rootNamespaces);
      }
      const expressionMatch = prefix.match(/\b(H3(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\.$/i);
      const namespaceItems = expressionMatch ? getNamespaceItems(expressionMatch[1]) : undefined;
      if (namespaceItems) {
        return createItems(namespaceItems, isNewExpression);
      }
      if (expressionMatch) {
        const typeName = expressionMatch[1].split('.').pop();
        const enumItems = typeName ? getEnumItems(typeName) : undefined;
        if (enumItems) {
          return createItems(enumItems);
        }
        const typeMembers = typeName ? getStaticMembers(typeName) : undefined;
        return typeMembers ? createItems(typeMembers) : undefined;
      }
      const memberMatch = prefix.match(/((?:this\.)?[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\.$/);
      if (!memberMatch) {
        return undefined;
      }
      const typeName = getExpressionType(document, position, memberMatch[1]);
      return typeName && members[typeName] ? createItems(members[typeName]) : undefined;
    }
  }, '.', 'H', 'h');
  context.subscriptions.push(provider);
}
