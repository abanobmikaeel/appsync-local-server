import { describe, expect, it } from '@jest/globals';
import {
  extractBearerToken,
  parseJwt,
  validateCognitoToken,
  validateJwt,
  validateOidcToken,
} from '../../../src/auth/jwtValidator.js';

// Helper to create a valid JWT structure
function createJwt(payload: Record<string, unknown>, header = { alg: 'HS256', typ: 'JWT' }): string {
  const encodeBase64Url = (obj: unknown): string => {
    const json = JSON.stringify(obj);
    return Buffer.from(json).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const headerB64 = encodeBase64Url(header);
  const payloadB64 = encodeBase64Url(payload);
  // Signature is just a placeholder since we don't verify signatures locally
  const signature = 'test-signature';

  return `${headerB64}.${payloadB64}.${signature}`;
}

describe('jwtValidator', () => {
  describe('parseJwt', () => {
    it('should parse a valid JWT token', () => {
      const token = createJwt({ sub: 'user-123', email: 'test@example.com' });
      const result = parseJwt(token);

      expect(result.isValid).toBe(true);
      expect(result.claims?.sub).toBe('user-123');
      expect(result.claims?.email).toBe('test@example.com');
    });

    it('should return error for empty token', () => {
      const result = parseJwt('');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token is empty');
    });

    it('should return error for token with wrong number of parts', () => {
      const result = parseJwt('only.two');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid JWT structure: expected 3 parts');
    });

    it('should return error for token with invalid base64', () => {
      const result = parseJwt('invalid.base64.content!!!');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Failed to decode JWT');
    });

    it('should parse Cognito-style tokens', () => {
      const token = createJwt({
        sub: 'abc-123',
        iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123',
        'cognito:username': 'testuser',
        'cognito:groups': ['admin', 'users'],
        token_use: 'access',
      });

      const result = parseJwt(token);

      expect(result.isValid).toBe(true);
      expect(result.claims?.['cognito:username']).toBe('testuser');
      expect(result.claims?.['cognito:groups']).toEqual(['admin', 'users']);
      expect(result.claims?.token_use).toBe('access');
    });
  });

  describe('validateJwt', () => {
    it('should validate a non-expired token', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const token = createJwt({ sub: 'user-123', exp: futureExp });

      const result = validateJwt(token);

      expect(result.isValid).toBe(true);
      expect(result.claims?.sub).toBe('user-123');
    });

    it('should reject an expired token', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const token = createJwt({ sub: 'user-123', exp: pastExp });

      const result = validateJwt(token);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token has expired');
      expect(result.claims?.sub).toBe('user-123'); // Claims still returned
    });

    it('should allow expired token within clock skew', () => {
      const recentlyExpired = Math.floor(Date.now() / 1000) - 30; // 30 seconds ago
      const token = createJwt({ sub: 'user-123', exp: recentlyExpired });

      const result = validateJwt(token, { clockSkewSeconds: 60 });

      expect(result.isValid).toBe(true);
    });

    it('should skip expiration check when disabled', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const token = createJwt({ sub: 'user-123', exp: pastExp });

      const result = validateJwt(token, { checkExpiration: false });

      expect(result.isValid).toBe(true);
    });

    it('should validate expected issuer', () => {
      const token = createJwt({ sub: 'user-123', iss: 'https://auth.example.com' });

      const result = validateJwt(token, { expectedIssuer: 'https://auth.example.com' });

      expect(result.isValid).toBe(true);
    });

    it('should reject wrong issuer', () => {
      const token = createJwt({ sub: 'user-123', iss: 'https://wrong.example.com' });

      const result = validateJwt(token, { expectedIssuer: 'https://auth.example.com' });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid issuer: expected 'https://auth.example.com'");
    });

    it('should validate expected audience', () => {
      const token = createJwt({ sub: 'user-123', aud: 'my-client-id' });

      const result = validateJwt(token, { expectedAudience: 'my-client-id' });

      expect(result.isValid).toBe(true);
    });

    it('should validate audience when it is an array', () => {
      const token = createJwt({ sub: 'user-123', aud: ['client-1', 'client-2', 'my-client-id'] });

      const result = validateJwt(token, { expectedAudience: 'my-client-id' });

      expect(result.isValid).toBe(true);
    });

    it('should reject when audience does not match', () => {
      const token = createJwt({ sub: 'user-123', aud: 'other-client' });

      const result = validateJwt(token, { expectedAudience: 'my-client-id' });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid audience: expected 'my-client-id'");
    });
  });

  describe('validateCognitoToken', () => {
    it('should validate a valid Cognito token', () => {
      const token = createJwt({
        sub: 'abc-123',
        iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123',
        token_use: 'access',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const result = validateCognitoToken(token);

      expect(result.isValid).toBe(true);
    });

    it('should accept id token type', () => {
      const token = createJwt({
        sub: 'abc-123',
        iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123',
        token_use: 'id',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const result = validateCognitoToken(token);

      expect(result.isValid).toBe(true);
    });

    it('should reject invalid token_use for Cognito tokens', () => {
      const token = createJwt({
        sub: 'abc-123',
        iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123',
        token_use: 'refresh', // Invalid for Cognito
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const result = validateCognitoToken(token);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid token_use: expected 'access' or 'id'");
    });

    it('should allow non-Cognito tokens (pass through to OIDC)', () => {
      const token = createJwt({
        sub: 'abc-123',
        iss: 'https://other-provider.com', // Not a Cognito issuer
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const result = validateCognitoToken(token);

      expect(result.isValid).toBe(true); // Still valid, just not Cognito-specific
    });
  });

  describe('validateOidcToken', () => {
    it('should validate a valid OIDC token', () => {
      const token = createJwt({
        sub: 'user-123',
        iss: 'https://auth.example.com',
        aud: 'my-client-id',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const result = validateOidcToken(token, 'https://auth.example.com', 'my-client-id');

      expect(result.isValid).toBe(true);
    });

    it('should reject token with wrong issuer', () => {
      const token = createJwt({
        sub: 'user-123',
        iss: 'https://wrong.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const result = validateOidcToken(token, 'https://auth.example.com');

      expect(result.isValid).toBe(false);
    });

    it('should reject token with wrong clientId', () => {
      const token = createJwt({
        sub: 'user-123',
        aud: 'wrong-client',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const result = validateOidcToken(token, undefined, 'expected-client');

      expect(result.isValid).toBe(false);
    });

    it('should validate without issuer/clientId when not specified', () => {
      const token = createJwt({
        sub: 'user-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const result = validateOidcToken(token);

      expect(result.isValid).toBe(true);
    });
  });

  describe('extractBearerToken', () => {
    it('should extract token from Bearer auth header', () => {
      const token = extractBearerToken('Bearer my-token-123');

      expect(token).toBe('my-token-123');
    });

    it('should extract JWT token from Bearer header', () => {
      const jwtToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature';
      const token = extractBearerToken(`Bearer ${jwtToken}`);

      expect(token).toBe(jwtToken);
    });

    it('should return null for undefined header', () => {
      const token = extractBearerToken(undefined);

      expect(token).toBeNull();
    });

    it('should return null for non-Bearer auth', () => {
      const token = extractBearerToken('Basic dXNlcjpwYXNz');

      expect(token).toBeNull();
    });

    it('should return null for empty string', () => {
      const token = extractBearerToken('');

      expect(token).toBeNull();
    });

    it('should be case-sensitive for Bearer prefix', () => {
      const token = extractBearerToken('bearer my-token');

      expect(token).toBeNull();
    });
  });
});
