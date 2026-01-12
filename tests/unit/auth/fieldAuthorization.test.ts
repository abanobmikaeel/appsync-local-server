import { describe, expect, it } from '@jest/globals';
import { parseSchemaDirectives } from '../../../src/auth/directiveParser.js';
import {
  authorizeAllFields,
  authorizeField,
  authorizeFields,
  createFieldAuthContext,
  getDefaultAuthMode,
} from '../../../src/auth/fieldAuthorization.js';
import type { AuthContext } from '../../../src/auth/index.js';
import type { AppSyncIdentity, AuthConfig } from '../../../src/types/index.js';

describe('fieldAuthorization', () => {
  describe('authorizeField', () => {
    it('should authorize when auth mode matches field directive', () => {
      const schema = `
        type Query {
          publicData: String @aws_api_key
        }
      `;
      const directives = parseSchemaDirectives(schema);
      const authContext: AuthContext = { authType: 'API_KEY', isAuthorized: true };
      const context = createFieldAuthContext(authContext, undefined, directives);

      const result = authorizeField('Query', 'publicData', context);

      expect(result.isAuthorized).toBe(true);
    });

    it('should deny when auth mode does not match field directive', () => {
      const schema = `
        type Query {
          adminData: String @aws_iam
        }
      `;
      const directives = parseSchemaDirectives(schema);
      const authContext: AuthContext = { authType: 'API_KEY', isAuthorized: true };
      const context = createFieldAuthContext(authContext, undefined, directives);

      const result = authorizeField('Query', 'adminData', context);

      expect(result.isAuthorized).toBe(false);
      expect(result.error).toContain('Not authorized');
      expect(result.allowedModes).toContain('AWS_IAM');
    });

    it('should inherit type-level directives for fields without explicit directives', () => {
      const schema = `
        type Query @aws_cognito_user_pools {
          userData: String
          moreData: String
        }
      `;
      const directives = parseSchemaDirectives(schema);
      const authContext: AuthContext = { authType: 'AMAZON_COGNITO_USER_POOLS', isAuthorized: true };
      const context = createFieldAuthContext(authContext, undefined, directives);

      expect(authorizeField('Query', 'userData', context).isAuthorized).toBe(true);
      expect(authorizeField('Query', 'moreData', context).isAuthorized).toBe(true);
    });

    it('should use field-level directive over type-level', () => {
      const schema = `
        type Query @aws_api_key {
          publicData: String
          adminOnly: String @aws_iam
        }
      `;
      const directives = parseSchemaDirectives(schema);
      const apiKeyContext = createFieldAuthContext({ authType: 'API_KEY', isAuthorized: true }, undefined, directives);
      const iamContext = createFieldAuthContext({ authType: 'AWS_IAM', isAuthorized: true }, undefined, directives);

      // publicData inherits @aws_api_key from type
      expect(authorizeField('Query', 'publicData', apiKeyContext).isAuthorized).toBe(true);
      expect(authorizeField('Query', 'publicData', iamContext).isAuthorized).toBe(false);

      // adminOnly overrides with @aws_iam
      expect(authorizeField('Query', 'adminOnly', apiKeyContext).isAuthorized).toBe(false);
      expect(authorizeField('Query', 'adminOnly', iamContext).isAuthorized).toBe(true);
    });

    it('should allow access when no auth directives and no default mode', () => {
      const schema = `
        type Query {
          openData: String
        }
      `;
      const directives = parseSchemaDirectives(schema); // No default auth mode
      const context = createFieldAuthContext({ authType: 'ANYTHING', isAuthorized: true }, undefined, directives);

      const result = authorizeField('Query', 'openData', context);
      expect(result.isAuthorized).toBe(true);
    });

    it('should use default auth mode when no directives present', () => {
      const schema = `
        type Query {
          defaultData: String
        }
      `;
      const directives = parseSchemaDirectives(schema, 'API_KEY');
      const apiKeyContext = createFieldAuthContext({ authType: 'API_KEY', isAuthorized: true }, undefined, directives);
      const iamContext = createFieldAuthContext({ authType: 'AWS_IAM', isAuthorized: true }, undefined, directives);

      expect(authorizeField('Query', 'defaultData', apiKeyContext).isAuthorized).toBe(true);
      expect(authorizeField('Query', 'defaultData', iamContext).isAuthorized).toBe(false);
    });

    it('should check Cognito groups for @aws_cognito_user_pools with groups', () => {
      const schema = `
        type Mutation {
          adminAction: String @aws_cognito_user_pools(cognito_groups: ["Admin"])
        }
      `;
      const directives = parseSchemaDirectives(schema);

      // User in Admin group - should be authorized
      const adminIdentity: AppSyncIdentity = { groups: ['Admin'] };
      const adminContext = createFieldAuthContext(
        { authType: 'AMAZON_COGNITO_USER_POOLS', isAuthorized: true },
        adminIdentity,
        directives
      );
      expect(authorizeField('Mutation', 'adminAction', adminContext).isAuthorized).toBe(true);

      // User in different group - should be denied
      const userIdentity: AppSyncIdentity = { groups: ['Users'] };
      const userContext = createFieldAuthContext(
        { authType: 'AMAZON_COGNITO_USER_POOLS', isAuthorized: true },
        userIdentity,
        directives
      );
      expect(authorizeField('Mutation', 'adminAction', userContext).isAuthorized).toBe(false);

      // No groups - should be denied
      const noGroupContext = createFieldAuthContext(
        { authType: 'AMAZON_COGNITO_USER_POOLS', isAuthorized: true },
        undefined,
        directives
      );
      expect(authorizeField('Mutation', 'adminAction', noGroupContext).isAuthorized).toBe(false);
    });

    it('should extract Cognito groups from claims if not in identity.groups', () => {
      const schema = `
        type Query {
          adminData: String @aws_cognito_user_pools(cognito_groups: ["Admin"])
        }
      `;
      const directives = parseSchemaDirectives(schema);

      // Groups in claims rather than identity.groups
      const identity: AppSyncIdentity = {
        claims: { 'cognito:groups': ['Admin', 'Editor'] },
      };
      const context = createFieldAuthContext(
        { authType: 'AMAZON_COGNITO_USER_POOLS', isAuthorized: true },
        identity,
        directives
      );

      expect(authorizeField('Query', 'adminData', context).isAuthorized).toBe(true);
    });

    describe('Lambda authorizer deniedFields', () => {
      it('should deny field when in Lambda authorizer deniedFields', () => {
        const schema = `
          type Query @aws_lambda {
            allowedField: String
            sensitiveField: String
          }
        `;
        const directives = parseSchemaDirectives(schema);

        // Lambda authorizer returned deniedFields
        const authContext: AuthContext = {
          authType: 'AWS_LAMBDA',
          isAuthorized: true,
          deniedFields: ['Query.sensitiveField'],
        };
        const context = createFieldAuthContext(authContext, undefined, directives);

        // sensitiveField should be denied
        const sensitiveResult = authorizeField('Query', 'sensitiveField', context);
        expect(sensitiveResult.isAuthorized).toBe(false);
        expect(sensitiveResult.error).toContain('denied by Lambda authorizer');

        // allowedField should still work
        const allowedResult = authorizeField('Query', 'allowedField', context);
        expect(allowedResult.isAuthorized).toBe(true);
      });

      it('should check deniedFields before schema directives', () => {
        const schema = `
          type Query @aws_lambda {
            myField: String
          }
        `;
        const directives = parseSchemaDirectives(schema);

        // Even though @aws_lambda matches AWS_LAMBDA auth, deniedFields takes precedence
        const authContext: AuthContext = {
          authType: 'AWS_LAMBDA',
          isAuthorized: true,
          deniedFields: ['Query.myField'],
        };
        const context = createFieldAuthContext(authContext, undefined, directives);

        const result = authorizeField('Query', 'myField', context);
        expect(result.isAuthorized).toBe(false);
      });

      it('should handle multiple deniedFields', () => {
        const schema = `
          type Query {
            field1: String @aws_lambda
            field2: String @aws_lambda
            field3: String @aws_lambda
          }
        `;
        const directives = parseSchemaDirectives(schema);

        const authContext: AuthContext = {
          authType: 'AWS_LAMBDA',
          isAuthorized: true,
          deniedFields: ['Query.field1', 'Query.field3'],
        };
        const context = createFieldAuthContext(authContext, undefined, directives);

        expect(authorizeField('Query', 'field1', context).isAuthorized).toBe(false);
        expect(authorizeField('Query', 'field2', context).isAuthorized).toBe(true);
        expect(authorizeField('Query', 'field3', context).isAuthorized).toBe(false);
      });
    });
  });

  describe('getDefaultAuthMode', () => {
    it('should return first auth config type', () => {
      const configs: AuthConfig[] = [{ type: 'API_KEY', key: 'test-key' }, { type: 'AMAZON_COGNITO_USER_POOLS' }];

      expect(getDefaultAuthMode(configs)).toBe('API_KEY');
    });

    it('should return undefined for empty config', () => {
      expect(getDefaultAuthMode([])).toBeUndefined();
    });

    it('should return undefined for unknown auth type', () => {
      const configs: AuthConfig[] = [{ type: 'UNKNOWN_TYPE' }];

      expect(getDefaultAuthMode(configs)).toBeUndefined();
    });
  });

  describe('authorizeFields (batch)', () => {
    it('should check multiple fields and return results map', () => {
      const schema = `
        type Query @aws_api_key {
          field1: String
          field2: String @aws_iam
        }
      `;
      const directives = parseSchemaDirectives(schema);
      const context = createFieldAuthContext({ authType: 'API_KEY', isAuthorized: true }, undefined, directives);

      const results = authorizeFields(
        [
          { typeName: 'Query', fieldName: 'field1' },
          { typeName: 'Query', fieldName: 'field2' },
        ],
        context
      );

      expect(results.size).toBe(2);
      expect(results.get('Query.field1')?.isAuthorized).toBe(true);
      expect(results.get('Query.field2')?.isAuthorized).toBe(false);
    });

    it('should handle empty fields array', () => {
      const schema = `type Query { hello: String }`;
      const directives = parseSchemaDirectives(schema);
      const context = createFieldAuthContext({ authType: 'API_KEY', isAuthorized: true }, undefined, directives);

      const results = authorizeFields([], context);

      expect(results.size).toBe(0);
    });
  });

  describe('authorizeAllFields (batch)', () => {
    it('should return authorized: true when all fields are allowed', () => {
      const schema = `
        type Query @aws_api_key {
          field1: String
          field2: String
        }
      `;
      const directives = parseSchemaDirectives(schema);
      const context = createFieldAuthContext({ authType: 'API_KEY', isAuthorized: true }, undefined, directives);

      const result = authorizeAllFields(
        [
          { typeName: 'Query', fieldName: 'field1' },
          { typeName: 'Query', fieldName: 'field2' },
        ],
        context
      );

      expect(result.authorized).toBe(true);
    });

    it('should return first unauthorized field when one fails', () => {
      const schema = `
        type Query @aws_api_key {
          allowed: String
          denied: String @aws_iam
          alsoAllowed: String
        }
      `;
      const directives = parseSchemaDirectives(schema);
      const context = createFieldAuthContext({ authType: 'API_KEY', isAuthorized: true }, undefined, directives);

      const result = authorizeAllFields(
        [
          { typeName: 'Query', fieldName: 'allowed' },
          { typeName: 'Query', fieldName: 'denied' },
          { typeName: 'Query', fieldName: 'alsoAllowed' },
        ],
        context
      );

      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        expect(result.field).toBe('Query.denied');
        expect(result.error).toContain('Not authorized');
      }
    });

    it('should return authorized: true for empty fields array', () => {
      const schema = `type Query { hello: String }`;
      const directives = parseSchemaDirectives(schema);
      const context = createFieldAuthContext({ authType: 'API_KEY', isAuthorized: true }, undefined, directives);

      const result = authorizeAllFields([], context);

      expect(result.authorized).toBe(true);
    });
  });

  describe('extractGroupsFromClaims edge cases', () => {
    it('should handle claims with non-array cognito:groups', () => {
      const schema = `
        type Query {
          adminData: String @aws_cognito_user_pools(cognito_groups: ["Admin"])
        }
      `;
      const directives = parseSchemaDirectives(schema);

      // Groups as a string instead of array (edge case)
      const identity: AppSyncIdentity = {
        claims: { 'cognito:groups': 'Admin' }, // String, not array
      };
      const context = createFieldAuthContext(
        { authType: 'AMAZON_COGNITO_USER_POOLS', isAuthorized: true },
        identity,
        directives
      );

      // Should not be authorized because groups is not an array
      const result = authorizeField('Query', 'adminData', context);
      expect(result.isAuthorized).toBe(false);
    });

    it('should filter non-string values from cognito:groups array', () => {
      const schema = `
        type Query {
          adminData: String @aws_cognito_user_pools(cognito_groups: ["Admin"])
        }
      `;
      const directives = parseSchemaDirectives(schema);

      // Mixed array with non-strings
      const identity: AppSyncIdentity = {
        claims: { 'cognito:groups': ['Admin', 123, null, 'Users'] },
      };
      const context = createFieldAuthContext(
        { authType: 'AMAZON_COGNITO_USER_POOLS', isAuthorized: true },
        identity,
        directives
      );

      // Should be authorized - Admin is in the array
      const result = authorizeField('Query', 'adminData', context);
      expect(result.isAuthorized).toBe(true);
    });
  });

  describe('Cascading Authorization (Return Type Check)', () => {
    it('should deny when field is allowed but return type is not', () => {
      const schema = `
        type Query @aws_api_key {
          getPost: Post
        }
        type Post @aws_iam {
          id: ID!
          title: String
        }
      `;
      const directives = parseSchemaDirectives(schema);
      const context = createFieldAuthContext({ authType: 'API_KEY', isAuthorized: true }, undefined, directives);

      // Query.getPost allows API_KEY (inherits from Query type)
      // But Post type requires AWS_IAM
      const result = authorizeField('Query', 'getPost', context);

      expect(result.isAuthorized).toBe(false);
      expect(result.error).toContain("return type 'Post'");
      expect(result.allowedModes).toContain('AWS_IAM');
    });

    it('should allow when both field and return type allow the auth mode', () => {
      const schema = `
        type Query @aws_api_key {
          getPost: Post
        }
        type Post @aws_api_key {
          id: ID!
          title: String
        }
      `;
      const directives = parseSchemaDirectives(schema);
      const context = createFieldAuthContext({ authType: 'API_KEY', isAuthorized: true }, undefined, directives);

      const result = authorizeField('Query', 'getPost', context);

      expect(result.isAuthorized).toBe(true);
    });

    it('should allow when return type has no directives AND no default auth mode', () => {
      const schema = `
        type Query @aws_api_key {
          getPost: Post
        }
        type Post {
          id: ID!
          title: String
        }
      `;
      // No default auth mode passed
      const directives = parseSchemaDirectives(schema);
      const context = createFieldAuthContext({ authType: 'API_KEY', isAuthorized: true }, undefined, directives);

      // Post has no directives and no default, so it's open
      const result = authorizeField('Query', 'getPost', context);

      expect(result.isAuthorized).toBe(true);
    });

    it('should deny when return type has no directives but default auth mode differs', () => {
      const schema = `
        type Query @aws_api_key @aws_iam {
          getPost: Post
        }
        type Post {
          id: ID!
          title: String
        }
      `;
      // Default auth mode is API_KEY
      const directives = parseSchemaDirectives(schema, 'API_KEY');

      // IAM can access the field (Query allows it)
      // But Post has no directives, so it defaults to API_KEY only
      const iamContext = createFieldAuthContext({ authType: 'AWS_IAM', isAuthorized: true }, undefined, directives);
      const result = authorizeField('Query', 'getPost', iamContext);

      expect(result.isAuthorized).toBe(false);
      expect(result.error).toContain('API default');
      expect(result.error).toContain('Post');
    });

    it('should allow when return type has no directives and auth matches default', () => {
      const schema = `
        type Query @aws_api_key @aws_iam {
          getPost: Post
        }
        type Post {
          id: ID!
          title: String
        }
      `;
      // Default auth mode is API_KEY
      const directives = parseSchemaDirectives(schema, 'API_KEY');

      // API_KEY matches the default, so it should pass
      const apiKeyContext = createFieldAuthContext({ authType: 'API_KEY', isAuthorized: true }, undefined, directives);
      const result = authorizeField('Query', 'getPost', apiKeyContext);

      expect(result.isAuthorized).toBe(true);
    });

    it('should skip cascading check for scalar return types', () => {
      const schema = `
        type Query @aws_api_key {
          getData: String
          getNumber: Int
          getFlag: Boolean
        }
      `;
      const directives = parseSchemaDirectives(schema);
      const context = createFieldAuthContext({ authType: 'API_KEY', isAuthorized: true }, undefined, directives);

      expect(authorizeField('Query', 'getData', context).isAuthorized).toBe(true);
      expect(authorizeField('Query', 'getNumber', context).isAuthorized).toBe(true);
      expect(authorizeField('Query', 'getFlag', context).isAuthorized).toBe(true);
    });

    it('should handle return type with multiple auth modes', () => {
      const schema = `
        type Query @aws_api_key {
          getPost: Post
        }
        type Post @aws_cognito_user_pools @aws_api_key {
          id: ID!
          title: String
        }
      `;
      const directives = parseSchemaDirectives(schema);

      // API_KEY should work (Post allows both cognito and api_key)
      const apiKeyContext = createFieldAuthContext({ authType: 'API_KEY', isAuthorized: true }, undefined, directives);
      expect(authorizeField('Query', 'getPost', apiKeyContext).isAuthorized).toBe(true);
    });

    it('should check Cognito groups on return type', () => {
      const schema = `
        type Query @aws_cognito_user_pools {
          getAdminData: AdminData
        }
        type AdminData @aws_cognito_user_pools(cognito_groups: ["Admin"]) {
          secret: String
        }
      `;
      const directives = parseSchemaDirectives(schema);

      // User in Admin group - should pass
      const adminIdentity: AppSyncIdentity = { groups: ['Admin'] };
      const adminContext = createFieldAuthContext(
        { authType: 'AMAZON_COGNITO_USER_POOLS', isAuthorized: true },
        adminIdentity,
        directives
      );
      expect(authorizeField('Query', 'getAdminData', adminContext).isAuthorized).toBe(true);

      // User without Admin group - should fail on return type
      const userIdentity: AppSyncIdentity = { groups: ['Users'] };
      const userContext = createFieldAuthContext(
        { authType: 'AMAZON_COGNITO_USER_POOLS', isAuthorized: true },
        userIdentity,
        directives
      );
      const result = authorizeField('Query', 'getAdminData', userContext);
      expect(result.isAuthorized).toBe(false);
      expect(result.error).toContain("return type 'AdminData'");
    });

    it('should handle list return types', () => {
      const schema = `
        type Query @aws_api_key {
          listPosts: [Post!]!
        }
        type Post @aws_iam {
          id: ID!
        }
      `;
      const directives = parseSchemaDirectives(schema);
      const context = createFieldAuthContext({ authType: 'API_KEY', isAuthorized: true }, undefined, directives);

      // Should fail because Post requires IAM
      const result = authorizeField('Query', 'listPosts', context);
      expect(result.isAuthorized).toBe(false);
      expect(result.error).toContain("return type 'Post'");
    });

    it('should handle nullable return types', () => {
      const schema = `
        type Query @aws_api_key {
          maybePost: Post
        }
        type Post @aws_iam {
          id: ID!
        }
      `;
      const directives = parseSchemaDirectives(schema);
      const context = createFieldAuthContext({ authType: 'API_KEY', isAuthorized: true }, undefined, directives);

      const result = authorizeField('Query', 'maybePost', context);
      expect(result.isAuthorized).toBe(false);
      expect(result.error).toContain("return type 'Post'");
    });
  });
});
