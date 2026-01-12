import { describe, expect, it } from '@jest/globals';
import { parseSchemaDirectives } from '../../../src/auth/directiveParser.js';
import { formatSchemaAuthWarnings, validateSchemaAuth } from '../../../src/auth/schemaValidator.js';
import type { AuthConfig } from '../../../src/types/index.js';

describe('schemaValidator', () => {
  describe('validateSchemaAuth', () => {
    describe('@aws_auth with multiple providers', () => {
      it('should warn when @aws_auth is used with multiple auth providers', () => {
        const schema = `
          type Query @aws_auth(cognito_groups: ["Admin"]) {
            getUser(id: ID!): User
          }
          type User @aws_auth {
            id: ID!
            name: String!
          }
        `;

        const authConfigs: AuthConfig[] = [{ type: 'AMAZON_COGNITO_USER_POOLS' }, { type: 'API_KEY', key: 'test-key' }];

        const directives = parseSchemaDirectives(schema, 'AMAZON_COGNITO_USER_POOLS');
        const warnings = validateSchemaAuth(directives, authConfigs);

        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings.some((w) => w.code === 'AWS_AUTH_MULTI_PROVIDER')).toBe(true);
        expect(warnings[0].suggestion).toContain('@aws_cognito_user_pools');
      });

      it('should not warn when @aws_auth is used with single provider', () => {
        const schema = `
          type Query @aws_auth(cognito_groups: ["Admin"]) {
            getUser(id: ID!): User
          }
        `;

        const authConfigs: AuthConfig[] = [{ type: 'AMAZON_COGNITO_USER_POOLS' }];

        const directives = parseSchemaDirectives(schema, 'AMAZON_COGNITO_USER_POOLS');
        const warnings = validateSchemaAuth(directives, authConfigs);

        expect(warnings.filter((w) => w.code === 'AWS_AUTH_MULTI_PROVIDER').length).toBe(0);
      });

      it('should warn for both type-level and field-level @aws_auth usage', () => {
        const schema = `
          type Query @aws_auth {
            getUser(id: ID!): User
            adminData: String @aws_auth(cognito_groups: ["Admin"])
          }
        `;

        const authConfigs: AuthConfig[] = [{ type: 'AMAZON_COGNITO_USER_POOLS' }, { type: 'AWS_IAM' }];

        const directives = parseSchemaDirectives(schema, 'AMAZON_COGNITO_USER_POOLS');
        const warnings = validateSchemaAuth(directives, authConfigs);

        const authWarnings = warnings.filter((w) => w.code === 'AWS_AUTH_MULTI_PROVIDER');
        expect(authWarnings.length).toBe(2); // One for type, one for field
        expect(authWarnings.some((w) => w.location === 'Query')).toBe(true);
        expect(authWarnings.some((w) => w.location === 'Query.adminData')).toBe(true);
      });
    });

    describe('return type auth mismatches', () => {
      it('should warn when field allows auth mode not allowed by return type', () => {
        const schema = `
          type Query @aws_api_key @aws_cognito_user_pools {
            getUser(id: ID!): User
          }
          type User @aws_cognito_user_pools {
            id: ID!
            name: String!
          }
        `;

        const authConfigs: AuthConfig[] = [{ type: 'API_KEY', key: 'test-key' }, { type: 'AMAZON_COGNITO_USER_POOLS' }];

        const directives = parseSchemaDirectives(schema, 'API_KEY');
        const warnings = validateSchemaAuth(directives, authConfigs);

        const mismatchWarnings = warnings.filter((w) => w.code === 'RETURN_TYPE_AUTH_MISMATCH');
        expect(mismatchWarnings.length).toBeGreaterThan(0);
        expect(mismatchWarnings[0].message).toContain('User');
        expect(mismatchWarnings[0].message).toContain('API_KEY');
      });

      it('should warn when return type defaults to different auth mode', () => {
        const schema = `
          type Query @aws_iam {
            getPost(id: ID!): Post
          }
          type Post {
            id: ID!
            title: String!
          }
        `;

        const authConfigs: AuthConfig[] = [{ type: 'API_KEY', key: 'test-key' }, { type: 'AWS_IAM' }];

        // Default is API_KEY
        const directives = parseSchemaDirectives(schema, 'API_KEY');
        const warnings = validateSchemaAuth(directives, authConfigs);

        const defaultMismatch = warnings.filter((w) => w.code === 'RETURN_TYPE_DEFAULT_MISMATCH');
        expect(defaultMismatch.length).toBeGreaterThan(0);
        expect(defaultMismatch[0].message).toContain('Post');
        expect(defaultMismatch[0].message).toContain('defaults to API_KEY');
      });

      it('should not warn when return type allows same auth modes as field', () => {
        const schema = `
          type Query @aws_api_key @aws_cognito_user_pools {
            getUser(id: ID!): User
          }
          type User @aws_api_key @aws_cognito_user_pools {
            id: ID!
            name: String!
          }
        `;

        const authConfigs: AuthConfig[] = [{ type: 'API_KEY', key: 'test-key' }, { type: 'AMAZON_COGNITO_USER_POOLS' }];

        const directives = parseSchemaDirectives(schema, 'API_KEY');
        const warnings = validateSchemaAuth(directives, authConfigs);

        const mismatchWarnings = warnings.filter(
          (w) => w.code === 'RETURN_TYPE_AUTH_MISMATCH' || w.code === 'RETURN_TYPE_DEFAULT_MISMATCH'
        );
        expect(mismatchWarnings.length).toBe(0);
      });

      it('should not warn for scalar return types', () => {
        const schema = `
          type Query @aws_api_key {
            getMessage: String
            getCount: Int
            isActive: Boolean
          }
        `;

        const authConfigs: AuthConfig[] = [{ type: 'API_KEY', key: 'test-key' }];

        const directives = parseSchemaDirectives(schema, 'API_KEY');
        const warnings = validateSchemaAuth(directives, authConfigs);

        expect(warnings.length).toBe(0);
      });
    });

    describe('no auth configured', () => {
      it('should not produce warnings when no auth is configured', () => {
        const schema = `
          type Query {
            getUser(id: ID!): User
          }
          type User {
            id: ID!
          }
        `;

        const authConfigs: AuthConfig[] = [];

        const directives = parseSchemaDirectives(schema, undefined);
        const warnings = validateSchemaAuth(directives, authConfigs);

        expect(warnings.length).toBe(0);
      });
    });
  });

  describe('formatSchemaAuthWarnings', () => {
    it('should return empty string when no warnings', () => {
      const result = formatSchemaAuthWarnings([]);
      expect(result).toBe('');
    });

    it('should format warnings with code, message, and suggestion', () => {
      const warnings = [
        {
          code: 'TEST_CODE',
          message: 'Test message',
          location: 'Query.field',
          suggestion: 'Fix it like this',
        },
      ];

      const result = formatSchemaAuthWarnings(warnings);

      expect(result).toContain('Schema Authorization Warnings');
      expect(result).toContain('TEST_CODE');
      expect(result).toContain('Test message');
      expect(result).toContain('Fix it like this');
      expect(result).toContain('1 warning(s)');
    });

    it('should format multiple warnings', () => {
      const warnings = [
        { code: 'CODE1', message: 'Message 1' },
        { code: 'CODE2', message: 'Message 2', suggestion: 'Suggestion 2' },
        { code: 'CODE3', message: 'Message 3' },
      ];

      const result = formatSchemaAuthWarnings(warnings);

      expect(result).toContain('CODE1');
      expect(result).toContain('CODE2');
      expect(result).toContain('CODE3');
      expect(result).toContain('3 warning(s)');
    });
  });
});
