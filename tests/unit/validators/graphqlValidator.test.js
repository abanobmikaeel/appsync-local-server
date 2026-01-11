import { 
  validateGraphQLSchema, 
  extractSchemaFields, 
  validateResolverCoverage, 
  validateDataSourceReferences,
  validateGraphQL 
} from '../../../src/validators/graphqlValidator.js';

// Manual mock for fs
const mockFs = {
  readFileSync: jest.fn()
};

// Mock the fs module manually
jest.doMock('fs', () => mockFs);

describe('GraphQL Validator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateGraphQLSchema', () => {
    it('should validate a correct GraphQL schema', () => {
      const validSchema = `
        type Query {
          hello: String
        }
      `;
      
      mockFs.readFileSync.mockReturnValue(validSchema);
      
      const result = validateGraphQLSchema('./schema.graphql');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect GraphQL syntax errors', () => {
      const invalidSchema = `
        type Query {
          hello: String
          # Missing closing brace
      `;
      
      mockFs.readFileSync.mockReturnValue(invalidSchema);
      
      const result = validateGraphQLSchema('./schema.graphql');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('extractSchemaFields', () => {
    it('should extract fields from Query type', () => {
      const schemaContent = `
        type Query {
          hello: String
          world: Int
          user: User
        }
        
        type User {
          id: ID!
          name: String!
        }
      `;
      
      const fields = extractSchemaFields(schemaContent);
      expect(fields.Query.has('hello')).toBe(true);
      expect(fields.Query.has('world')).toBe(true);
      expect(fields.Query.has('user')).toBe(true);
      expect(fields.Query.size).toBe(3);
    });

    it('should extract fields from Mutation type', () => {
      const schemaContent = `
        type Mutation {
          createUser(name: String!): User
          updateUser(id: ID!, name: String!): User
        }
      `;
      
      const fields = extractSchemaFields(schemaContent);
      expect(fields.Mutation.has('createUser')).toBe(true);
      expect(fields.Mutation.has('updateUser')).toBe(true);
      expect(fields.Mutation.size).toBe(2);
    });

    it('should ignore comments in schema', () => {
      const schemaContent = `
        type Query {
          # This is a comment
          hello: String
          # Another comment
          world: Int
        }
      `;
      
      const fields = extractSchemaFields(schemaContent);
      expect(fields.Query.has('hello')).toBe(true);
      expect(fields.Query.has('world')).toBe(true);
      expect(fields.Query.size).toBe(2);
    });
  });

  describe('validateResolverCoverage', () => {
    it('should pass when all resolvers have corresponding schema fields', () => {
      const schemaFields = {
        Query: new Set(['hello', 'world']),
        Mutation: new Set(['createUser']),
        Subscription: new Set()
      };
      
      const config = {
        resolvers: [
          { type: 'Query', field: 'hello' },
          { type: 'Query', field: 'world' },
          { type: 'Mutation', field: 'createUser' }
        ]
      };
      
      const result = validateResolverCoverage(config, schemaFields);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should error when resolver references non-existent type', () => {
      const schemaFields = {
        Query: new Set(['hello']),
        Mutation: new Set(),
        Subscription: new Set()
      };
      
      const config = {
        resolvers: [
          { type: 'NonExistentType', field: 'hello' }
        ]
      };
      
      const result = validateResolverCoverage(config, schemaFields);
      expect(result.errors).toContain("Resolver for NonExistentType.hello references non-existent type 'NonExistentType' in schema");
    });

    it('should error when resolver references non-existent field', () => {
      const schemaFields = {
        Query: new Set(['hello']),
        Mutation: new Set(),
        Subscription: new Set()
      };
      
      const config = {
        resolvers: [
          { type: 'Query', field: 'nonExistentField' }
        ]
      };
      
      const result = validateResolverCoverage(config, schemaFields);
      expect(result.errors).toContain("Resolver for Query.nonExistentField references non-existent field 'nonExistentField' in Query type");
    });

    it('should warn when schema field has no resolver', () => {
      const schemaFields = {
        Query: new Set(['hello', 'world']),
        Mutation: new Set(),
        Subscription: new Set()
      };
      
      const config = {
        resolvers: [
          { type: 'Query', field: 'hello' }
          // 'world' field has no resolver
        ]
      };
      
      const result = validateResolverCoverage(config, schemaFields);
      expect(result.warnings).toContain("⚠️  Field Query.world has no resolver defined");
    });
  });

  describe('validateDataSourceReferences', () => {
    it('should pass when all data sources exist', () => {
      const config = {
        dataSources: [
          { name: 'usersTable', type: 'DYNAMODB' },
          { name: 'userLambda', type: 'LAMBDA' }
        ],
        resolvers: [
          { 
            type: 'Query', 
            field: 'user', 
            kind: 'Unit', 
            dataSource: 'usersTable' 
          },
          {
            type: 'Mutation',
            field: 'createUser',
            kind: 'Pipeline',
            pipelineFunctions: [
              { dataSource: 'userLambda' }
            ]
          }
        ]
      };
      
      const result = validateDataSourceReferences(config);
      expect(result).toHaveLength(0);
    });

    it('should error when unit resolver references non-existent data source', () => {
      const config = {
        dataSources: [
          { name: 'usersTable', type: 'DYNAMODB' }
        ],
        resolvers: [
          { 
            type: 'Query', 
            field: 'user', 
            kind: 'Unit', 
            dataSource: 'nonExistentDataSource' 
          }
        ]
      };
      
      const result = validateDataSourceReferences(config);
      expect(result).toContain("Unit resolver Query.user references non-existent data source 'nonExistentDataSource'");
    });

    it('should error when pipeline function references non-existent data source', () => {
      const config = {
        dataSources: [
          { name: 'usersTable', type: 'DYNAMODB' }
        ],
        resolvers: [
          {
            type: 'Mutation',
            field: 'createUser',
            kind: 'Pipeline',
            pipelineFunctions: [
              { dataSource: 'nonExistentDataSource' }
            ]
          }
        ]
      };
      
      const result = validateDataSourceReferences(config);
      expect(result).toContain("Pipeline function in Mutation.createUser references non-existent data source 'nonExistentDataSource'");
    });
  });

  describe('validateGraphQL', () => {
    it('should pass for valid configuration', () => {
      const validSchema = `
        type Query {
          hello: String
        }
      `;
      
      mockFs.readFileSync.mockReturnValue(validSchema);
      
      const config = {
        schema: './schema.graphql',
        dataSources: [
          { name: 'testTable', type: 'DYNAMODB' }
        ],
        resolvers: [
          { type: 'Query', field: 'hello', kind: 'Unit', dataSource: 'testTable' }
        ]
      };
      
      const result = validateGraphQL(config);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for invalid schema syntax', () => {
      const invalidSchema = `
        type Query {
          hello: String
          # Missing closing brace
      `;
      
      mockFs.readFileSync.mockReturnValue(invalidSchema);
      
      const config = {
        schema: './schema.graphql',
        dataSources: [],
        resolvers: []
      };
      
      const result = validateGraphQL(config);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('GraphQL schema syntax error');
    });
  });
}); 