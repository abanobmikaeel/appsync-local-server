import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { executeHTTPOperation, httpRequest, isSuccessResponse } from '../../../src/datasourceHandlers/http.js';
import type { HTTPDataSource, HTTPRequest } from '../../../src/types/index.js';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('HTTP Data Source Handler', () => {
  const mockDataSource: HTTPDataSource = {
    type: 'HTTP',
    name: 'TestAPI',
    config: {
      endpoint: 'https://api.example.com',
      defaultHeaders: {
        'X-Api-Key': 'test-key',
      },
    },
  };

  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeHTTPOperation', () => {
    it('should execute GET request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: 1, name: 'Test' }),
        text: async () => '',
      } as Response;
      mockFetch.mockResolvedValueOnce(mockResponse);

      const request: HTTPRequest = {
        method: 'GET',
        resourcePath: '/users/1',
      };

      const result = await executeHTTPOperation(mockDataSource, request);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Api-Key': 'test-key',
          }),
        })
      );
      expect(result.statusCode).toBe(200);
      expect(result.body).toEqual({ id: 1, name: 'Test' });
    });

    it('should execute POST request with body', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: 2, name: 'New User' }),
        text: async () => '',
      } as Response;
      mockFetch.mockResolvedValueOnce(mockResponse);

      const request: HTTPRequest = {
        method: 'POST',
        resourcePath: '/users',
        params: {
          body: { name: 'New User' },
        },
      };

      const result = await executeHTTPOperation(mockDataSource, request);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'New User' }),
        })
      );
      expect(result.statusCode).toBe(201);
    });

    it('should include query parameters', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [],
        text: async () => '',
      } as Response;
      mockFetch.mockResolvedValueOnce(mockResponse);

      const request: HTTPRequest = {
        method: 'GET',
        resourcePath: '/users',
        params: {
          query: { limit: '10', offset: '0' },
        },
      };

      await executeHTTPOperation(mockDataSource, request);

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/users?limit=10&offset=0', expect.anything());
    });

    it('should handle array query parameters', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [],
        text: async () => '',
      } as Response;
      mockFetch.mockResolvedValueOnce(mockResponse);

      const request: HTTPRequest = {
        method: 'GET',
        resourcePath: '/users',
        params: {
          query: { ids: ['1', '2', '3'] },
        },
      };

      await executeHTTPOperation(mockDataSource, request);

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/users?ids=1&ids=2&ids=3', expect.anything());
    });

    it('should merge request headers with default headers', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
        text: async () => '',
      } as Response;
      mockFetch.mockResolvedValueOnce(mockResponse);

      const request: HTTPRequest = {
        method: 'GET',
        resourcePath: '/users',
        params: {
          headers: { Authorization: 'Bearer token123' },
        },
      };

      await executeHTTPOperation(mockDataSource, request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Api-Key': 'test-key',
            Authorization: 'Bearer token123',
          }),
        })
      );
    });

    it('should handle text response', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        json: async () => {
          throw new Error('Not JSON');
        },
        text: async () => 'Hello World',
      } as unknown as Response;
      mockFetch.mockResolvedValueOnce(mockResponse);

      const request: HTTPRequest = {
        method: 'GET',
        resourcePath: '/hello',
      };

      const result = await executeHTTPOperation(mockDataSource, request);

      expect(result.body).toBe('Hello World');
    });

    it('should throw error on fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const request: HTTPRequest = {
        method: 'GET',
        resourcePath: '/users',
      };

      await expect(executeHTTPOperation(mockDataSource, request)).rejects.toThrow(
        "HTTP request failed for 'TestAPI': Network error"
      );
    });
  });

  describe('httpRequest helpers', () => {
    it('should create GET request', () => {
      const request = httpRequest.get('/users', { limit: '10' }, { Accept: 'application/json' });
      expect(request).toEqual({
        method: 'GET',
        resourcePath: '/users',
        params: {
          query: { limit: '10' },
          headers: { Accept: 'application/json' },
        },
      });
    });

    it('should create POST request', () => {
      const request = httpRequest.post('/users', { name: 'Test' });
      expect(request).toEqual({
        method: 'POST',
        resourcePath: '/users',
        params: {
          body: { name: 'Test' },
          headers: undefined,
        },
      });
    });

    it('should create PUT request', () => {
      const request = httpRequest.put('/users/1', { name: 'Updated' });
      expect(request).toEqual({
        method: 'PUT',
        resourcePath: '/users/1',
        params: {
          body: { name: 'Updated' },
          headers: undefined,
        },
      });
    });

    it('should create DELETE request', () => {
      const request = httpRequest.delete('/users/1');
      expect(request).toEqual({
        method: 'DELETE',
        resourcePath: '/users/1',
        params: {
          headers: undefined,
        },
      });
    });

    it('should create PATCH request', () => {
      const request = httpRequest.patch('/users/1', { status: 'active' });
      expect(request).toEqual({
        method: 'PATCH',
        resourcePath: '/users/1',
        params: {
          body: { status: 'active' },
          headers: undefined,
        },
      });
    });
  });

  describe('isSuccessResponse', () => {
    it('should return true for 2xx status codes', () => {
      expect(isSuccessResponse({ statusCode: 200, headers: {}, body: null })).toBe(true);
      expect(isSuccessResponse({ statusCode: 201, headers: {}, body: null })).toBe(true);
      expect(isSuccessResponse({ statusCode: 204, headers: {}, body: null })).toBe(true);
      expect(isSuccessResponse({ statusCode: 299, headers: {}, body: null })).toBe(true);
    });

    it('should return false for non-2xx status codes', () => {
      expect(isSuccessResponse({ statusCode: 400, headers: {}, body: null })).toBe(false);
      expect(isSuccessResponse({ statusCode: 404, headers: {}, body: null })).toBe(false);
      expect(isSuccessResponse({ statusCode: 500, headers: {}, body: null })).toBe(false);
      expect(isSuccessResponse({ statusCode: 199, headers: {}, body: null })).toBe(false);
    });
  });
});
