import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import type { AppSyncConfig, SchemaFields } from '../../../src/types/index.js';
import {
  extractSchemaFields,
  validateDataSourceReferences,
  validateGraphQL,
  validateResolverCoverage,
} from '../../../src/validators/graphqlValidator.js';

const defaultApiConfig = { auth: [{ type: 'API_KEY' as const, key: 'test-key' }] };

describe('GraphQL Validator', () => {
  describe('extractSchemaFields', () => {
    it('should extract Query fields', () => {
      const schemaContent = `
        type Query {
          getUser(id: ID!): User
          listUsers: [User!]!
        }
      `;
      const fields = extractSchemaFields(schemaContent);
      expect(fields.Query.has('getUser')).toBe(true);
      expect(fields.Query.has('listUsers')).toBe(true);
      expect(fields.Query.size).toBe(2);
    });

    it('should extract Mutation fields', () => {
      const schemaContent = `
        type Mutation {
          createUser(input: CreateUserInput!): User
          deleteUser(id: ID!): Boolean
        }
      `;
      const fields = extractSchemaFields(schemaContent);
      expect(fields.Mutation.has('createUser')).toBe(true);
      expect(fields.Mutation.has('deleteUser')).toBe(true);
      expect(fields.Mutation.size).toBe(2);
    });

    it('should extract Subscription fields', () => {
      const schemaContent = `
        type Subscription {
          onUserCreated: User
          onUserUpdated(id: ID!): User
        }
      `;
      const fields = extractSchemaFields(schemaContent);
      expect(fields.Subscription.has('onUserCreated')).toBe(true);
      expect(fields.Subscription.has('onUserUpdated')).toBe(true);
      expect(fields.Subscription.size).toBe(2);
    });

    it('should extract fields from all root types', () => {
      const schemaContent = `
        type Query {
          getUser(id: ID!): User
        }
        type Mutation {
          createUser(input: CreateUserInput!): User
        }
        type Subscription {
          onUserCreated: User
        }
      `;
      const fields = extractSchemaFields(schemaContent);
      expect(fields.Query.has('getUser')).toBe(true);
      expect(fields.Mutation.has('createUser')).toBe(true);
      expect(fields.Subscription.has('onUserCreated')).toBe(true);
    });

    it('should skip comments', () => {
      const schemaContent = `
        type Query {
          # This is a comment
          getUser(id: ID!): User
          # Another comment
        }
      `;
      const fields = extractSchemaFields(schemaContent);
      expect(fields.Query.has('getUser')).toBe(true);
      expect(fields.Query.size).toBe(1);
    });

    it('should handle empty types', () => {
      const schemaContent = `
        type Query {
        }
      `;
      const fields = extractSchemaFields(schemaContent);
      expect(fields.Query.size).toBe(0);
    });

    it('should ignore non-root types', () => {
      const schemaContent = `
        type User {
          id: ID!
          name: String!
        }
        type Query {
          getUser: User
        }
      `;
      const fields = extractSchemaFields(schemaContent);
      expect(fields.Query.has('getUser')).toBe(true);
      expect(fields.Query.size).toBe(1);
    });
  });

  describe('validateResolverCoverage', () => {
    const schemaFields: SchemaFields = {
      Query: new Set(['getUser', 'listUsers']),
      Mutation: new Set(['createUser', 'deleteUser']),
      Subscription: new Set(['onUserCreated']),
    };

    const defaultApiConfig = { auth: [{ type: 'API_KEY' as const, key: 'test-key' }] };

    it('should validate resolvers that match schema fields', () => {
      const config: AppSyncConfig = {
        schema: 'schema.graphql',
        apiConfig: defaultApiConfig,
        dataSources: [{ type: 'NONE', name: 'LocalDS' }],
        resolvers: [
          { type: 'Query', field: 'getUser', kind: 'Unit', dataSource: 'LocalDS', file: 'getUser.js' },
          { type: 'Query', field: 'listUsers', kind: 'Unit', dataSource: 'LocalDS', file: 'listUsers.js' },
        ],
      };
      const result = validateResolverCoverage(config, schemaFields);
      expect(result.errors).toHaveLength(0);
    });

    it('should report error for resolver referencing non-existent type', () => {
      const config = {
        schema: 'schema.graphql',
        apiConfig: defaultApiConfig,
        dataSources: [{ type: 'NONE', name: 'LocalDS' }],
        resolvers: [{ type: 'InvalidType', field: 'getUser', kind: 'Unit', dataSource: 'LocalDS', file: 'getUser.js' }],
      } as unknown as AppSyncConfig;
      const result = validateResolverCoverage(config, schemaFields);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('non-existent type');
    });

    it('should report error for resolver referencing non-existent field', () => {
      const config: AppSyncConfig = {
        schema: 'schema.graphql',
        apiConfig: defaultApiConfig,
        dataSources: [{ type: 'NONE', name: 'LocalDS' }],
        resolvers: [
          { type: 'Query', field: 'nonExistentField', kind: 'Unit', dataSource: 'LocalDS', file: 'getUser.js' },
        ],
      };
      const result = validateResolverCoverage(config, schemaFields);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('non-existent field');
    });

    it('should warn about schema fields without resolvers', () => {
      const config: AppSyncConfig = {
        schema: 'schema.graphql',
        apiConfig: defaultApiConfig,
        dataSources: [{ type: 'NONE', name: 'LocalDS' }],
        resolvers: [
          { type: 'Query', field: 'getUser', kind: 'Unit', dataSource: 'LocalDS', file: 'getUser.js' },
          // Missing listUsers resolver
        ],
      };
      const result = validateResolverCoverage(config, schemaFields);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('listUsers'))).toBe(true);
    });
  });

  describe('validateDataSourceReferences', () => {
    const defaultApiConfig = { auth: [{ type: 'API_KEY' as const, key: 'test-key' }] };

    it('should validate unit resolver with existing data source', () => {
      const config: AppSyncConfig = {
        schema: 'schema.graphql',
        apiConfig: defaultApiConfig,
        dataSources: [
          { type: 'NONE', name: 'LocalDS' },
          { type: 'DYNAMODB', name: 'UsersTable', config: { tableName: 'users', region: 'us-east-1' } },
        ],
        resolvers: [{ type: 'Query', field: 'getUser', kind: 'Unit', dataSource: 'UsersTable', file: 'getUser.js' }],
      };
      const errors = validateDataSourceReferences(config);
      expect(errors).toHaveLength(0);
    });

    it('should report error for unit resolver with non-existent data source', () => {
      const config: AppSyncConfig = {
        schema: 'schema.graphql',
        apiConfig: defaultApiConfig,
        dataSources: [{ type: 'NONE', name: 'LocalDS' }],
        resolvers: [{ type: 'Query', field: 'getUser', kind: 'Unit', dataSource: 'NonExistentDS', file: 'getUser.js' }],
      };
      const errors = validateDataSourceReferences(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('NonExistentDS');
    });

    it('should validate pipeline resolver functions with existing data sources', () => {
      const config: AppSyncConfig = {
        schema: 'schema.graphql',
        apiConfig: defaultApiConfig,
        dataSources: [
          { type: 'NONE', name: 'LocalDS' },
          { type: 'DYNAMODB', name: 'UsersTable', config: { tableName: 'users', region: 'us-east-1' } },
        ],
        resolvers: [
          {
            type: 'Mutation',
            field: 'createUser',
            kind: 'Pipeline',
            file: 'createUser.js',
            pipelineFunctions: [
              { file: 'validate.js', dataSource: 'LocalDS' },
              { file: 'save.js', dataSource: 'UsersTable' },
            ],
          },
        ],
      };
      const errors = validateDataSourceReferences(config);
      expect(errors).toHaveLength(0);
    });

    it('should report error for pipeline function with non-existent data source', () => {
      const config: AppSyncConfig = {
        schema: 'schema.graphql',
        apiConfig: defaultApiConfig,
        dataSources: [{ type: 'NONE', name: 'LocalDS' }],
        resolvers: [
          {
            type: 'Mutation',
            field: 'createUser',
            kind: 'Pipeline',
            file: 'createUser.js',
            pipelineFunctions: [
              { file: 'validate.js', dataSource: 'LocalDS' },
              { file: 'save.js', dataSource: 'NonExistentDS' },
            ],
          },
        ],
      };
      const errors = validateDataSourceReferences(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('NonExistentDS');
    });

    it('should report multiple errors for multiple missing data sources', () => {
      const config: AppSyncConfig = {
        schema: 'schema.graphql',
        apiConfig: defaultApiConfig,
        dataSources: [],
        resolvers: [
          { type: 'Query', field: 'getUser', kind: 'Unit', dataSource: 'DS1', file: 'getUser.js' },
          { type: 'Query', field: 'listUsers', kind: 'Unit', dataSource: 'DS2', file: 'listUsers.js' },
        ],
      };
      const errors = validateDataSourceReferences(config);
      expect(errors.length).toBe(2);
      expect(errors[0]).toContain('DS1');
      expect(errors[1]).toContain('DS2');
    });
  });

  describe('validateGraphQL', () => {
    const tmpDir = os.tmpdir();
    const testDir = path.join(tmpDir, 'graphql-validator-test');

    beforeAll(() => {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      // Create a valid GraphQL schema file
      fs.writeFileSync(
        path.join(testDir, 'valid-schema.graphql'),
        `type Query {
          getUser(id: ID!): User
        }
        type User {
          id: ID!
          name: String!
        }`
      );
    });

    afterAll(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }
    });

    it('should validate a valid schema with matching resolvers', () => {
      const config: AppSyncConfig = {
        schema: path.join(testDir, 'valid-schema.graphql'),
        apiConfig: defaultApiConfig,
        dataSources: [{ type: 'NONE', name: 'LocalDS' }],
        resolvers: [{ type: 'Query', field: 'getUser', kind: 'Unit', dataSource: 'LocalDS', file: 'getUser.js' }],
      };

      const result = validateGraphQL(config);

      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for non-existent schema file', () => {
      const config: AppSyncConfig = {
        schema: '/non/existent/schema.graphql',
        apiConfig: defaultApiConfig,
        dataSources: [{ type: 'NONE', name: 'LocalDS' }],
        resolvers: [],
      };

      const result = validateGraphQL(config);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('schema');
    });

    it('should return errors for resolver referencing non-existent data source', () => {
      const config: AppSyncConfig = {
        schema: path.join(testDir, 'valid-schema.graphql'),
        apiConfig: defaultApiConfig,
        dataSources: [],
        resolvers: [{ type: 'Query', field: 'getUser', kind: 'Unit', dataSource: 'MissingDS', file: 'getUser.js' }],
      };

      const result = validateGraphQL(config);

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return warnings for uncovered schema fields', () => {
      const config: AppSyncConfig = {
        schema: path.join(testDir, 'valid-schema.graphql'),
        apiConfig: defaultApiConfig,
        dataSources: [{ type: 'NONE', name: 'LocalDS' }],
        resolvers: [], // No resolvers for getUser
      };

      const result = validateGraphQL(config);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('extractSchemaFields edge cases', () => {
    it('should handle schema with type keyword in comments', () => {
      const schemaContent = `
        # type Query is the root type
        type Query {
          getUser: User
        }
      `;
      const fields = extractSchemaFields(schemaContent);
      expect(fields.Query.has('getUser')).toBe(true);
    });

    it('should handle schema with multiple types on same line', () => {
      const schemaContent = `type Query { getUser: User }`;
      const fields = extractSchemaFields(schemaContent);
      expect(fields.Query.has('getUser')).toBe(true);
    });

    it('should handle schema with tabs and mixed whitespace', () => {
      const schemaContent = `
\t\ttype Query {
\t\t\tgetUser: User
\t\t}
      `;
      const fields = extractSchemaFields(schemaContent);
      expect(fields.Query.has('getUser')).toBe(true);
    });

    it('should handle schema with directives on fields', () => {
      const schemaContent = `
        type Query {
          getUser(id: ID!): User @deprecated(reason: "Use getUserById")
        }
      `;
      const fields = extractSchemaFields(schemaContent);
      expect(fields.Query.has('getUser')).toBe(true);
    });

    it('should handle schema with complex argument types', () => {
      const schemaContent = `
        type Query {
          searchUsers(filter: UserFilterInput!, pagination: PaginationInput): UserConnection!
        }
      `;
      const fields = extractSchemaFields(schemaContent);
      expect(fields.Query.has('searchUsers')).toBe(true);
    });

    it('should handle schema with extend keyword', () => {
      const schemaContent = `
        type Query {
          getUser: User
        }
        extend type Query {
          listUsers: [User!]!
        }
      `;
      const fields = extractSchemaFields(schemaContent);
      expect(fields.Query.has('getUser')).toBe(true);
      // Note: extend might not be fully supported, just testing it doesn't break
    });

    it('should return empty/undefined sets for schema without root types', () => {
      const schemaContent = `
        type User {
          id: ID!
          name: String!
        }
      `;
      const fields = extractSchemaFields(schemaContent);
      // When a root type is not defined, it may be undefined or empty
      expect(fields.Query?.size ?? 0).toBe(0);
      expect(fields.Mutation?.size ?? 0).toBe(0);
      expect(fields.Subscription?.size ?? 0).toBe(0);
    });
  });
});
