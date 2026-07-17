import { H3YunLegacyApiService } from './h3yunApiLegacy';

/**
 * 氚云新版本 API 服务类。
 * 当前先复用老版本能力,新版本接口差异集中在本文件内迭代。
 */
export class H3YunNewApiService extends H3YunLegacyApiService {}

// 导出新版本 API 单例实例
export const h3yunNewApi = new H3YunNewApiService();
