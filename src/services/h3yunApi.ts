import { H3YunApiVersion } from '../types';
import { h3yunLegacyApi, H3YunLegacyApiService } from './h3yunApiLegacy';
import { h3yunNewApi } from './h3yunApiNew';

class H3YunApiFacade {
  private apiVersion: H3YunApiVersion = 'legacy';

  setApiVersion(apiVersion: H3YunApiVersion | undefined): void {
    const shouldUseNew = apiVersion === 'new';
    if (this.apiVersion !== (shouldUseNew ? 'new' : 'legacy')) {
      // 切换版本时清空缓存,确保重新从氚云获取数据
      this.clearCaches();
    }
    this.apiVersion = shouldUseNew ? 'new' : 'legacy';
  }

  private clearCaches(): void {
    h3yunLegacyApi.clearCaches();
    h3yunNewApi.clearCaches();
  }

  setToken(token: string, engineCode: string): void {
    h3yunLegacyApi.setToken(token, engineCode);
    h3yunNewApi.setToken(token, engineCode);
  }

  private get service(): H3YunLegacyApiService {
    return this.apiVersion === 'new' ? h3yunNewApi : h3yunLegacyApi;
  }

  consumeLoadFormFailures(): Array<{ code: string; name: string; error: string }> {
    return this.service.consumeLoadFormFailures();
  }

  getApplication(appCode: string) {
    return this.service.getApplication(appCode);
  }

  getForms(appCode: string, knownFormCodes?: Set<string>) {
    return this.service.getForms(appCode, knownFormCodes);
  }

  getFormFields(formCode: string) {
    return this.service.getFormFields(formCode);
  }

  getFormFrontendCode(formCode: string) {
    return this.service.getFormFrontendCode(formCode);
  }

  getFormBackendCode(formCode: string) {
    return this.service.getFormBackendCode(formCode);
  }

  getListFrontendCode(formCode: string) {
    return this.service.getListFrontendCode(formCode);
  }

  getListBackendCode(formCode: string) {
    return this.service.getListBackendCode(formCode);
  }

  getFormAllCodes(formCode: string) {
    return this.service.getFormAllCodes(formCode);
  }

  getSystemUserId() {
    return this.service.getSystemUserId();
  }

  queryFormNames(formCode: string, systemUserId?: string) {
    return this.service.queryFormNames(formCode, systemUserId);
  }
}

// 导出统一 API 单例实例
export const h3yunApi = new H3YunApiFacade();
