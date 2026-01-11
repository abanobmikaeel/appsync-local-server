import type { HTTPDataSource, HTTPRequest, HTTPResponse } from '../types/index.js';

/**
 * Build URL with query parameters
 */
function buildUrl(baseEndpoint: string, resourcePath: string, query?: Record<string, string | string[]>): string {
  // Ensure baseEndpoint doesn't end with / and resourcePath starts with /
  const cleanBase = baseEndpoint.replace(/\/$/, '');
  const cleanPath = resourcePath.startsWith('/') ? resourcePath : `/${resourcePath}`;

  const url = new URL(`${cleanBase}${cleanPath}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          url.searchParams.append(key, v);
        }
      } else {
        url.searchParams.append(key, value);
      }
    }
  }

  return url.toString();
}

/**
 * Execute HTTP data source operation
 * Supports GET, POST, PUT, DELETE, PATCH methods with headers and body
 */
export async function executeHTTPOperation(dataSource: HTTPDataSource, request: HTTPRequest): Promise<HTTPResponse> {
  try {
    const { method, resourcePath, params } = request;
    const { endpoint, defaultHeaders } = dataSource.config;

    // Build the full URL
    const url = buildUrl(endpoint, resourcePath, params?.query);

    // Merge default headers with request headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
      ...params?.headers,
    };

    // Build fetch options
    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    // Add body for methods that support it
    if (params?.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      fetchOptions.body = typeof params.body === 'string' ? params.body : JSON.stringify(params.body);
    }

    // Execute the request
    const response = await fetch(url, fetchOptions);

    // Parse response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Parse response body
    let body: unknown;
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      try {
        body = await response.json();
      } catch {
        body = await response.text();
      }
    } else {
      body = await response.text();
    }

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`HTTP request failed for '${dataSource.name}': ${errorMessage}`);
  }
}

/**
 * Helper to check if HTTP response indicates success
 */
export function isSuccessResponse(response: HTTPResponse): boolean {
  return response.statusCode >= 200 && response.statusCode < 300;
}

/**
 * Helper to create common HTTP request structures for AppSync resolvers
 */
export const httpRequest = {
  /**
   * Create a GET request
   */
  get(resourcePath: string, query?: Record<string, string | string[]>, headers?: Record<string, string>): HTTPRequest {
    return {
      method: 'GET',
      resourcePath,
      params: { query, headers },
    };
  },

  /**
   * Create a POST request
   */
  post(resourcePath: string, body: unknown, headers?: Record<string, string>): HTTPRequest {
    return {
      method: 'POST',
      resourcePath,
      params: { body, headers },
    };
  },

  /**
   * Create a PUT request
   */
  put(resourcePath: string, body: unknown, headers?: Record<string, string>): HTTPRequest {
    return {
      method: 'PUT',
      resourcePath,
      params: { body, headers },
    };
  },

  /**
   * Create a DELETE request
   */
  delete(resourcePath: string, headers?: Record<string, string>): HTTPRequest {
    return {
      method: 'DELETE',
      resourcePath,
      params: { headers },
    };
  },

  /**
   * Create a PATCH request
   */
  patch(resourcePath: string, body: unknown, headers?: Record<string, string>): HTTPRequest {
    return {
      method: 'PATCH',
      resourcePath,
      params: { body, headers },
    };
  },
};
