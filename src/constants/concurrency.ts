export const FORM_REQUEST_CONCURRENCY = 10;

/**
 * 业务规则按表单逐个请求,使用分批方式控制并发。
 * 每批最多同时发起 10 个请求,一批完成后再发下一批,避免表单较多的应用瞬间压垮氚云接口。
 */
export const BUSINESS_RULE_REQUEST_BATCH_SIZE = 10;
