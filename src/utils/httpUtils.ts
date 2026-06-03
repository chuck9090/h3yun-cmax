import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

/**
 * HTTP 请求选项
 */
export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

/**
 * HTTP 响应
 */
export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: string;
}

/**
 * 发送 HTTP 请求
 * @param url 请求URL
 * @param options 请求选项
 * @returns Promise<HttpResponse>
 */
export function sendRequest(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const requestOptions: any = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 30000
    };

    const req = client.request(requestOptions, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 200,
          headers: res.headers as Record<string, string | string[]>,
          body
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${requestOptions.timeout}ms`));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

/**
 * 发送 GET 请求
 * @param url 请求URL
 * @param headers 请求头
 * @returns Promise<HttpResponse>
 */
export function get(url: string, headers?: Record<string, string>): Promise<HttpResponse> {
  return sendRequest(url, { method: 'GET', headers });
}

/**
 * 发送 POST 请求
 * @param url 请求URL
 * @param body 请求体
 * @param headers 请求头
 * @returns Promise<HttpResponse>
 */
export function post(url: string, body: string, headers?: Record<string, string>): Promise<HttpResponse> {
  return sendRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body
  });
}

/**
 * 解析 JSON 响应
 * @param response HTTP 响应
 * @returns 解析后的 JSON 对象
 */
export function parseJsonResponse<T = any>(response: HttpResponse): T {
  try {
    return JSON.parse(response.body) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`);
  }
}
