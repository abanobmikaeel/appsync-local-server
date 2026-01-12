import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { authenticateRequest, executeLambdaAuthorizer, validateApiKey } from '../../src/auth/index.js';
import type { AuthConfig } from '../../src/types/index.js';

describe('Auth Middleware', () => {
  const tmpDir = os.tmpdir();
  const testDir = path.join(tmpDir, 'auth-test-fixtures');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create a simple Lambda authorizer that returns authorized
    // Note: Using .cjs extension with CommonJS syntax for Jest compatibility
    fs.writeFileSync(
      path.join(testDir, 'successAuth.cjs'),
      `exports.handler = async function(event) {
        return {
          isAuthorized: true,
          resolverContext: { userId: 'test-user' }
        };
      };`
    );

    // Create a Lambda authorizer that returns unauthorized
    fs.writeFileSync(
      path.join(testDir, 'failAuth.cjs'),
      `exports.handler = async function(event) {
        return { isAuthorized: false };
      };`
    );

    // Create a Lambda authorizer that returns denied fields
    fs.writeFileSync(
      path.join(testDir, 'deniedFieldsAuth.cjs'),
      `exports.handler = async function(event) {
        return {
          isAuthorized: true,
          deniedFields: ['User.ssn', 'User.password']
        };
      };`
    );

    // Create a Lambda authorizer without handler
    fs.writeFileSync(path.join(testDir, 'noHandlerAuth.cjs'), `exports.notAHandler = () => {};`);

    // Create a Lambda authorizer that throws
    fs.writeFileSync(
      path.join(testDir, 'throwingAuth.cjs'),
      `exports.handler = async function(event) {
        throw new Error('Auth error');
      };`
    );

    // Create a Lambda authorizer with default export
    // module.exports = fn maps to mod.default when dynamically imported
    fs.writeFileSync(
      path.join(testDir, 'defaultExportAuth.cjs'),
      `module.exports = async function(event) {
        return { isAuthorized: true };
      };`
    );
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('validateApiKey', () => {
    const authConfigs: AuthConfig[] = [{ type: 'API_KEY', key: 'valid-api-key' }];

    it('should validate correct API key', () => {
      const result = validateApiKey('valid-api-key', authConfigs);
      expect(result.isAuthorized).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject missing API key', () => {
      const result = validateApiKey(undefined, authConfigs);
      expect(result.isAuthorized).toBe(false);
      expect(result.error).toContain('Missing API key');
    });

    it('should reject invalid API key', () => {
      const result = validateApiKey('wrong-key', authConfigs);
      expect(result.isAuthorized).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('should allow requests when no API key auth is configured', () => {
      const result = validateApiKey(undefined, []);
      expect(result.isAuthorized).toBe(true);
    });

    it('should reject expired API key', () => {
      const expiredConfigs: AuthConfig[] = [{ type: 'API_KEY', key: 'valid-api-key', expiration: Date.now() - 1000 }];
      const result = validateApiKey('valid-api-key', expiredConfigs);
      expect(result.isAuthorized).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should allow non-expired API key', () => {
      const validConfigs: AuthConfig[] = [{ type: 'API_KEY', key: 'valid-api-key', expiration: Date.now() + 100000 }];
      const result = validateApiKey('valid-api-key', validConfigs);
      expect(result.isAuthorized).toBe(true);
    });
  });

  describe('executeLambdaAuthorizer', () => {
    const requestContext = {
      apiId: 'test-api',
      accountId: 'test-account',
      requestId: 'test-request',
      queryString: '{ test }',
    };

    it('should return unauthorized for non-existent file', async () => {
      const result = await executeLambdaAuthorizer('Bearer test-token', 'nonexistent-file.js', requestContext);

      expect(result.isAuthorized).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should execute Lambda authorizer and return authorized', async () => {
      const result = await executeLambdaAuthorizer(
        'Bearer test-token',
        path.join(testDir, 'successAuth.cjs'),
        requestContext
      );

      expect(result.isAuthorized).toBe(true);
      expect(result.resolverContext).toEqual({ userId: 'test-user' });
    });

    it('should return unauthorized from Lambda authorizer', async () => {
      const result = await executeLambdaAuthorizer(
        'Bearer test-token',
        path.join(testDir, 'failAuth.cjs'),
        requestContext
      );

      expect(result.isAuthorized).toBe(false);
    });

    it('should return denied fields from Lambda authorizer', async () => {
      const result = await executeLambdaAuthorizer(
        'Bearer test-token',
        path.join(testDir, 'deniedFieldsAuth.cjs'),
        requestContext
      );

      expect(result.isAuthorized).toBe(true);
      expect(result.deniedFields).toEqual(['User.ssn', 'User.password']);
    });

    it('should return error for Lambda authorizer without handler', async () => {
      const result = await executeLambdaAuthorizer(
        'Bearer test-token',
        path.join(testDir, 'noHandlerAuth.cjs'),
        requestContext
      );

      expect(result.isAuthorized).toBe(false);
      // Error message varies: "no handler function" or "handler is not a function"
      expect(result.error).toMatch(/no handler|handler is not a function/i);
    });

    it('should return error when Lambda authorizer throws', async () => {
      const result = await executeLambdaAuthorizer(
        'Bearer test-token',
        path.join(testDir, 'throwingAuth.cjs'),
        requestContext
      );

      expect(result.isAuthorized).toBe(false);
      expect(result.error).toContain('Auth error');
    });

    it('should work with default export', async () => {
      const result = await executeLambdaAuthorizer(
        'Bearer test-token',
        path.join(testDir, 'defaultExportAuth.cjs'),
        requestContext
      );

      expect(result.isAuthorized).toBe(true);
    });
  });

  describe('authenticateRequest', () => {
    it('should authenticate with valid API key', async () => {
      const authConfigs: AuthConfig[] = [{ type: 'API_KEY', key: 'test-api-key' }];

      const result = await authenticateRequest({ 'x-api-key': 'test-api-key' }, authConfigs);

      expect(result.isAuthorized).toBe(true);
      expect(result.authType).toBe('API_KEY');
    });

    it('should reject request with invalid API key', async () => {
      const authConfigs: AuthConfig[] = [{ type: 'API_KEY', key: 'test-api-key' }];

      const result = await authenticateRequest({ 'x-api-key': 'wrong-key' }, authConfigs);

      expect(result.isAuthorized).toBe(false);
    });

    it('should authenticate with JWT Bearer token for Cognito', async () => {
      const authConfigs: AuthConfig[] = [{ type: 'AMAZON_COGNITO_USER_POOLS' }];

      const result = await authenticateRequest(
        {
          authorization:
            'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
        },
        authConfigs
      );

      expect(result.isAuthorized).toBe(true);
      expect(result.authType).toBe('AMAZON_COGNITO_USER_POOLS');
    });

    it('should authenticate with OIDC Bearer token', async () => {
      const authConfigs: AuthConfig[] = [{ type: 'OPENID_CONNECT' }];

      // Valid JWT structure (header.payload.signature)
      const result = await authenticateRequest(
        {
          authorization:
            'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaXNzIjoiaHR0cHM6Ly9vaWRjLXByb3ZpZGVyLmNvbSJ9.signature',
        },
        authConfigs
      );

      expect(result.isAuthorized).toBe(true);
      expect(result.authType).toBe('OPENID_CONNECT');
    });

    it('should authenticate with IAM auth headers', async () => {
      const authConfigs: AuthConfig[] = [{ type: 'AWS_IAM' }];

      const result = await authenticateRequest({ 'x-amz-security-token': 'some-token' }, authConfigs);

      expect(result.isAuthorized).toBe(true);
      expect(result.authType).toBe('AWS_IAM');
    });

    it('should allow all requests when no auth is configured', async () => {
      const result = await authenticateRequest({}, []);
      expect(result.isAuthorized).toBe(true);
      expect(result.authType).toBe('NONE');
    });

    it('should handle case-insensitive headers', async () => {
      const authConfigs: AuthConfig[] = [{ type: 'API_KEY', key: 'test-api-key' }];

      const result = await authenticateRequest({ 'X-API-KEY': 'test-api-key' }, authConfigs);

      expect(result.isAuthorized).toBe(true);
    });

    it('should try multiple auth methods and succeed on first match', async () => {
      const authConfigs: AuthConfig[] = [
        { type: 'API_KEY', key: 'test-api-key' },
        { type: 'AMAZON_COGNITO_USER_POOLS' },
      ];

      // Both auth methods configured, but we only have API key
      const result = await authenticateRequest({ 'x-api-key': 'test-api-key' }, authConfigs);

      expect(result.isAuthorized).toBe(true);
      expect(result.authType).toBe('API_KEY');
    });

    it('should reject when no auth method matches', async () => {
      const authConfigs: AuthConfig[] = [{ type: 'API_KEY', key: 'test-api-key' }];

      const result = await authenticateRequest(
        {}, // No API key header
        authConfigs
      );

      expect(result.isAuthorized).toBe(false);
    });

    it('should handle array header values', async () => {
      const authConfigs: AuthConfig[] = [{ type: 'API_KEY', key: 'test-api-key' }];

      // HTTP headers can be arrays
      const result = await authenticateRequest(
        { 'x-api-key': ['test-api-key', 'second-value'] as unknown as string },
        authConfigs
      );

      expect(result.isAuthorized).toBe(true);
      expect(result.authType).toBe('API_KEY');
    });

    it('should authenticate with x-amz-date header for IAM', async () => {
      const authConfigs: AuthConfig[] = [{ type: 'AWS_IAM' }];

      const result = await authenticateRequest({ 'x-amz-date': '20230101T000000Z' }, authConfigs);

      expect(result.isAuthorized).toBe(true);
      expect(result.authType).toBe('AWS_IAM');
    });

    it('should authenticate with AWS4-HMAC-SHA256 authorization for IAM', async () => {
      const authConfigs: AuthConfig[] = [{ type: 'AWS_IAM' }];

      const result = await authenticateRequest({ authorization: 'AWS4-HMAC-SHA256 Credential=...' }, authConfigs);

      expect(result.isAuthorized).toBe(true);
      expect(result.authType).toBe('AWS_IAM');
    });

    it('should not authenticate IAM without proper headers', async () => {
      const authConfigs: AuthConfig[] = [{ type: 'AWS_IAM' }];

      const result = await authenticateRequest({ 'x-custom': 'value' }, authConfigs);

      expect(result.isAuthorized).toBe(false);
    });

    it('should not authenticate Cognito without Bearer prefix', async () => {
      const authConfigs: AuthConfig[] = [{ type: 'AMAZON_COGNITO_USER_POOLS' }];

      const result = await authenticateRequest({ authorization: 'Basic some-credentials' }, authConfigs);

      expect(result.isAuthorized).toBe(false);
    });

    it('should try Lambda auth when configured', async () => {
      const authConfigs: AuthConfig[] = [{ type: 'AWS_LAMBDA', lambdaFunction: 'non-existent-auth.js' }];

      const result = await authenticateRequest(
        { authorization: 'Bearer test-token' },
        authConfigs,
        '{ testQuery }',
        'TestOperation',
        { var1: 'value1' }
      );

      // Will fail because Lambda file doesn't exist
      expect(result.isAuthorized).toBe(false);
    });

    it('should skip Lambda auth when no lambdaFunction configured', async () => {
      const authConfigs: AuthConfig[] = [
        { type: 'AWS_LAMBDA' }, // No lambdaFunction
        { type: 'API_KEY', key: 'test-key' },
      ];

      const result = await authenticateRequest({ 'x-api-key': 'test-key' }, authConfigs);

      expect(result.isAuthorized).toBe(true);
      expect(result.authType).toBe('API_KEY');
    });

    it('should use mock identity for Lambda auth when configured (local dev mode)', async () => {
      const authConfigs: AuthConfig[] = [
        {
          type: 'AWS_LAMBDA',
          // No lambdaFunction - use mock identity instead
          identity: {
            sub: 'TEST-USER-ID',
            username: 'testuser',
            groups: ['admin', 'users'],
          },
          resolverContext: {
            customField: 'customValue',
            isValid: true,
          },
        },
      ];

      const result = await authenticateRequest({}, authConfigs);

      expect(result.isAuthorized).toBe(true);
      expect(result.authType).toBe('AWS_LAMBDA');
      expect(result.mockIdentity).toEqual({
        sub: 'TEST-USER-ID',
        username: 'testuser',
        groups: ['admin', 'users'],
      });
      expect(result.resolverContext).toEqual({
        customField: 'customValue',
        isValid: true,
      });
    });

    it('should use mock identity with only resolverContext configured', async () => {
      const authConfigs: AuthConfig[] = [
        {
          type: 'AWS_LAMBDA',
          resolverContext: { userId: 'mock-user' },
        },
      ];

      const result = await authenticateRequest({}, authConfigs);

      expect(result.isAuthorized).toBe(true);
      expect(result.authType).toBe('AWS_LAMBDA');
      expect(result.resolverContext).toEqual({ userId: 'mock-user' });
    });

    it('should successfully authenticate with Lambda authorizer', async () => {
      const authConfigs: AuthConfig[] = [{ type: 'AWS_LAMBDA', lambdaFunction: path.join(testDir, 'successAuth.cjs') }];

      const result = await authenticateRequest(
        { authorization: 'Bearer test-token' },
        authConfigs,
        '{ testQuery }',
        'TestOperation',
        { var1: 'value1' }
      );

      expect(result.isAuthorized).toBe(true);
      expect(result.authType).toBe('AWS_LAMBDA');
      expect(result.resolverContext).toEqual({ userId: 'test-user' });
    });

    it('should fall back to next auth method when Lambda fails', async () => {
      const authConfigs: AuthConfig[] = [
        { type: 'AWS_LAMBDA', lambdaFunction: path.join(testDir, 'failAuth.cjs') },
        { type: 'API_KEY', key: 'test-key' },
      ];

      const result = await authenticateRequest(
        { authorization: 'Bearer test-token', 'x-api-key': 'test-key' },
        authConfigs
      );

      expect(result.isAuthorized).toBe(true);
      expect(result.authType).toBe('API_KEY');
    });

    it('should warn and fall through when AWS_LAMBDA has no lambdaFunction or identity', async () => {
      const authConfigs: AuthConfig[] = [{ type: 'AWS_LAMBDA' }, { type: 'API_KEY', key: 'fallback-key' }];

      const originalWarn = console.warn;
      console.warn = jest.fn();

      const result = await authenticateRequest({ 'x-api-key': 'fallback-key' }, authConfigs);

      // Should warn about missing config
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('AWS_LAMBDA auth configured without lambdaFunction or mock identity')
      );
      // Should fall through to next auth method
      expect(result.isAuthorized).toBe(true);
      expect(result.authType).toBe('API_KEY');

      console.warn = originalWarn;
    });

    it('should authorize expired JWT with warning in local dev mode', async () => {
      const authConfigs: AuthConfig[] = [{ type: 'OPENID_CONNECT' }];

      // Create a JWT with expired timestamp (past)
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(
        JSON.stringify({
          sub: 'user-123',
          exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        })
      ).toString('base64');
      const expiredJwt = `${header}.${payload}.signature`;

      const originalWarn = console.warn;
      console.warn = jest.fn();

      const result = await authenticateRequest({ authorization: `Bearer ${expiredJwt}` }, authConfigs);

      // Should still authorize in local dev mode, with warning
      expect(result.isAuthorized).toBe(true);
      expect(result.authType).toBe('OPENID_CONNECT');
      expect(result.jwtClaims?.sub).toBe('user-123');
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('JWT validation warning'));

      console.warn = originalWarn;
    });

    it('should reject completely invalid JWT structure', async () => {
      const authConfigs: AuthConfig[] = [{ type: 'OPENID_CONNECT' }];

      const originalWarn = console.warn;
      console.warn = jest.fn();

      // Invalid JWT - not proper base64 structure
      const result = await authenticateRequest({ authorization: 'Bearer not-a-valid-jwt-at-all' }, authConfigs);

      expect(result.isAuthorized).toBe(false);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('JWT validation failed'));

      console.warn = originalWarn;
    });

    it('should reject JWT with invalid base64 payload', async () => {
      const authConfigs: AuthConfig[] = [{ type: 'AMAZON_COGNITO_USER_POOLS' }];

      const originalWarn = console.warn;
      console.warn = jest.fn();

      // Three parts but invalid base64 in payload
      const result = await authenticateRequest({ authorization: 'Bearer header.!!!invalid!!!.signature' }, authConfigs);

      expect(result.isAuthorized).toBe(false);

      console.warn = originalWarn;
    });
  });
});
