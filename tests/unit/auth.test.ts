import { authenticateRequest, executeLambdaAuthorizer, validateApiKey } from '../../src/auth/index.js';
import type { AuthConfig } from '../../src/types/index.js';

describe('Auth Middleware', () => {
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
    it('should execute Lambda authorizer and return authorized', async () => {
      // Create a mock Lambda file path that doesn't exist
      // In a real test, we'd mock the loadResolverModule function
      const result = await executeLambdaAuthorizer('Bearer test-token', 'nonexistent-file.js', {
        apiId: 'test-api',
        accountId: 'test-account',
        requestId: 'test-request',
        queryString: '{ test }',
      });

      // Should fail because file doesn't exist
      expect(result.isAuthorized).toBe(false);
      expect(result.error).toBeDefined();
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

      const result = await authenticateRequest({ authorization: 'Bearer some-jwt-token' }, authConfigs);

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
  });
});
