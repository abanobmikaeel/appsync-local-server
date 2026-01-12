import { describe, expect, it } from '@jest/globals';
import {
  authConfigToAuthMode,
  getFieldAuthRequirements,
  getFieldReturnType,
  getSubscriptionMutations,
  getTypeAuthRequirements,
  isFieldAuthorized,
  isScalarOrBuiltinType,
  parseSchemaDirectives,
} from '../../../src/auth/directiveParser.js';

describe('directiveParser', () => {
  describe('parseSchemaDirectives', () => {
    it('should parse type-level auth directives', () => {
      const schema = `
        type Query @aws_api_key {
          getUser(id: ID!): User
          listUsers: [User]
        }
      `;

      const result = parseSchemaDirectives(schema);

      expect(result.typeDirectives.has('Query')).toBe(true);
      const queryDirectives = result.typeDirectives.get('Query')!;
      expect(queryDirectives).toHaveLength(1);
      expect(queryDirectives[0].authMode).toBe('API_KEY');
      expect(queryDirectives[0].directiveName).toBe('aws_api_key');
    });

    it('should parse multiple type-level directives', () => {
      const schema = `
        type Query @aws_api_key @aws_cognito_user_pools {
          getUser(id: ID!): User
        }
      `;

      const result = parseSchemaDirectives(schema);

      const queryDirectives = result.typeDirectives.get('Query')!;
      expect(queryDirectives).toHaveLength(2);
      expect(queryDirectives.map((d) => d.authMode)).toContain('API_KEY');
      expect(queryDirectives.map((d) => d.authMode)).toContain('AMAZON_COGNITO_USER_POOLS');
    });

    it('should parse field-level auth directives', () => {
      const schema = `
        type Query {
          publicData: String @aws_api_key
          privateData: String @aws_iam
        }
      `;

      const result = parseSchemaDirectives(schema);

      expect(result.fieldDirectives.has('Query.publicData')).toBe(true);
      expect(result.fieldDirectives.has('Query.privateData')).toBe(true);

      const publicDirectives = result.fieldDirectives.get('Query.publicData')!;
      expect(publicDirectives[0].authMode).toBe('API_KEY');

      const privateDirectives = result.fieldDirectives.get('Query.privateData')!;
      expect(privateDirectives[0].authMode).toBe('AWS_IAM');
    });

    it('should parse @aws_cognito_user_pools with cognito_groups', () => {
      const schema = `
        type Mutation {
          adminAction: String @aws_cognito_user_pools(cognito_groups: ["Admin", "Superuser"])
        }
      `;

      const result = parseSchemaDirectives(schema);

      const fieldDirectives = result.fieldDirectives.get('Mutation.adminAction')!;
      expect(fieldDirectives).toHaveLength(1);
      expect(fieldDirectives[0].authMode).toBe('AMAZON_COGNITO_USER_POOLS');
      expect(fieldDirectives[0].cognitoGroups).toEqual(['Admin', 'Superuser']);
    });

    it('should parse @aws_auth with cognito_groups (legacy directive)', () => {
      const schema = `
        type Query {
          adminData: String @aws_auth(cognito_groups: ["Admin"])
        }
      `;

      const result = parseSchemaDirectives(schema);

      const fieldDirectives = result.fieldDirectives.get('Query.adminData')!;
      expect(fieldDirectives[0].authMode).toBe('AMAZON_COGNITO_USER_POOLS');
      expect(fieldDirectives[0].cognitoGroups).toEqual(['Admin']);
    });

    it('should parse @aws_subscribe directive', () => {
      const schema = `
        type Subscription {
          onPostCreated: Post @aws_subscribe(mutations: ["createPost"])
          onPostUpdated: Post @aws_subscribe(mutations: ["updatePost", "editPost"])
        }
      `;

      const result = parseSchemaDirectives(schema);

      expect(result.subscriptionDirectives.has('Subscription.onPostCreated')).toBe(true);
      expect(result.subscriptionDirectives.has('Subscription.onPostUpdated')).toBe(true);

      expect(result.subscriptionDirectives.get('Subscription.onPostCreated')?.mutations).toEqual(['createPost']);
      expect(result.subscriptionDirectives.get('Subscription.onPostUpdated')?.mutations).toEqual([
        'updatePost',
        'editPost',
      ]);
    });

    it('should parse all AWS auth directives', () => {
      const schema = `
        type Query {
          apiKeyField: String @aws_api_key
          iamField: String @aws_iam
          cognitoField: String @aws_cognito_user_pools
          oidcField: String @aws_oidc
          lambdaField: String @aws_lambda
        }
      `;

      const result = parseSchemaDirectives(schema);

      expect(result.fieldDirectives.get('Query.apiKeyField')![0].authMode).toBe('API_KEY');
      expect(result.fieldDirectives.get('Query.iamField')![0].authMode).toBe('AWS_IAM');
      expect(result.fieldDirectives.get('Query.cognitoField')![0].authMode).toBe('AMAZON_COGNITO_USER_POOLS');
      expect(result.fieldDirectives.get('Query.oidcField')![0].authMode).toBe('OPENID_CONNECT');
      expect(result.fieldDirectives.get('Query.lambdaField')![0].authMode).toBe('AWS_LAMBDA');
    });

    it('should handle schema with no directives', () => {
      const schema = `
        type Query {
          getUser(id: ID!): User
        }
        type User {
          id: ID!
          name: String
        }
      `;

      const result = parseSchemaDirectives(schema);

      expect(result.typeDirectives.size).toBe(0);
      expect(result.fieldDirectives.size).toBe(0);
      expect(result.subscriptionDirectives.size).toBe(0);
    });

    it('should handle invalid schema gracefully', () => {
      const schema = 'this is not valid graphql';

      const result = parseSchemaDirectives(schema);

      expect(result.typeDirectives.size).toBe(0);
      expect(result.fieldDirectives.size).toBe(0);
    });

    it('should store default auth mode when provided', () => {
      const schema = `type Query { hello: String }`;

      const result = parseSchemaDirectives(schema, 'API_KEY');

      expect(result.defaultAuthMode).toBe('API_KEY');
    });
  });

  describe('getFieldAuthRequirements', () => {
    it('should return field-level directives when present', () => {
      const schema = `
        type Query @aws_api_key {
          specialField: String @aws_iam
        }
      `;

      const directives = parseSchemaDirectives(schema);
      const requirements = getFieldAuthRequirements('Query', 'specialField', directives);

      expect(requirements.hasExplicitDirectives).toBe(true);
      expect(requirements.allowedModes).toHaveLength(1);
      expect(requirements.allowedModes[0].authMode).toBe('AWS_IAM');
    });

    it('should inherit type-level directives when field has none', () => {
      const schema = `
        type Query @aws_api_key @aws_cognito_user_pools {
          normalField: String
        }
      `;

      const directives = parseSchemaDirectives(schema);
      const requirements = getFieldAuthRequirements('Query', 'normalField', directives);

      expect(requirements.hasExplicitDirectives).toBe(false);
      expect(requirements.allowedModes).toHaveLength(2);
    });

    it('should use default auth mode when no directives present', () => {
      const schema = `
        type Query {
          simpleField: String
        }
      `;

      const directives = parseSchemaDirectives(schema, 'API_KEY');
      const requirements = getFieldAuthRequirements('Query', 'simpleField', directives);

      expect(requirements.hasExplicitDirectives).toBe(false);
      expect(requirements.allowedModes).toHaveLength(1);
      expect(requirements.allowedModes[0].authMode).toBe('API_KEY');
    });

    it('should return empty allowed modes when no auth configured', () => {
      const schema = `
        type Query {
          openField: String
        }
      `;

      const directives = parseSchemaDirectives(schema); // No default
      const requirements = getFieldAuthRequirements('Query', 'openField', directives);

      expect(requirements.allowedModes).toHaveLength(0);
    });
  });

  describe('isFieldAuthorized', () => {
    it('should authorize when auth mode matches', () => {
      const requirements = {
        allowedModes: [{ authMode: 'API_KEY' as const, directiveName: 'aws_api_key' }],
        hasExplicitDirectives: true,
      };

      expect(isFieldAuthorized('API_KEY', requirements)).toBe(true);
    });

    it('should deny when auth mode does not match', () => {
      const requirements = {
        allowedModes: [{ authMode: 'API_KEY' as const, directiveName: 'aws_api_key' }],
        hasExplicitDirectives: true,
      };

      expect(isFieldAuthorized('AWS_IAM', requirements)).toBe(false);
    });

    it('should authorize when any mode matches (multiple modes)', () => {
      const requirements = {
        allowedModes: [
          { authMode: 'API_KEY' as const, directiveName: 'aws_api_key' },
          { authMode: 'AMAZON_COGNITO_USER_POOLS' as const, directiveName: 'aws_cognito_user_pools' },
        ],
        hasExplicitDirectives: true,
      };

      expect(isFieldAuthorized('API_KEY', requirements)).toBe(true);
      expect(isFieldAuthorized('AMAZON_COGNITO_USER_POOLS', requirements)).toBe(true);
      expect(isFieldAuthorized('AWS_IAM', requirements)).toBe(false);
    });

    it('should allow access when no modes specified', () => {
      const requirements = {
        allowedModes: [],
        hasExplicitDirectives: false,
      };

      expect(isFieldAuthorized('ANY_MODE', requirements)).toBe(true);
    });

    it('should check Cognito groups when specified', () => {
      const requirements = {
        allowedModes: [
          {
            authMode: 'AMAZON_COGNITO_USER_POOLS' as const,
            directiveName: 'aws_cognito_user_pools',
            cognitoGroups: ['Admin', 'Editor'],
          },
        ],
        hasExplicitDirectives: true,
      };

      // User in Admin group - should be authorized
      expect(isFieldAuthorized('AMAZON_COGNITO_USER_POOLS', requirements, ['Admin'])).toBe(true);

      // User in Editor group - should be authorized
      expect(isFieldAuthorized('AMAZON_COGNITO_USER_POOLS', requirements, ['Editor'])).toBe(true);

      // User in both groups - should be authorized
      expect(isFieldAuthorized('AMAZON_COGNITO_USER_POOLS', requirements, ['Admin', 'Editor'])).toBe(true);

      // User in different group - should be denied
      expect(isFieldAuthorized('AMAZON_COGNITO_USER_POOLS', requirements, ['Reader'])).toBe(false);

      // No groups provided - should be denied
      expect(isFieldAuthorized('AMAZON_COGNITO_USER_POOLS', requirements)).toBe(false);
      expect(isFieldAuthorized('AMAZON_COGNITO_USER_POOLS', requirements, [])).toBe(false);
    });

    it('should try multiple modes with different group requirements', () => {
      const requirements = {
        allowedModes: [
          {
            authMode: 'AMAZON_COGNITO_USER_POOLS' as const,
            directiveName: 'aws_cognito_user_pools',
            cognitoGroups: ['Admin'],
          },
          {
            authMode: 'API_KEY' as const,
            directiveName: 'aws_api_key',
          },
        ],
        hasExplicitDirectives: true,
      };

      // API key should work without groups
      expect(isFieldAuthorized('API_KEY', requirements)).toBe(true);

      // Cognito without Admin group should fail
      expect(isFieldAuthorized('AMAZON_COGNITO_USER_POOLS', requirements, ['Reader'])).toBe(false);

      // Cognito with Admin group should work
      expect(isFieldAuthorized('AMAZON_COGNITO_USER_POOLS', requirements, ['Admin'])).toBe(true);
    });
  });

  describe('getSubscriptionMutations', () => {
    it('should return mutations for subscription field', () => {
      const schema = `
        type Subscription {
          onPostCreated: Post @aws_subscribe(mutations: ["createPost"])
        }
      `;

      const directives = parseSchemaDirectives(schema);
      const mutations = getSubscriptionMutations('onPostCreated', directives);

      expect(mutations).toEqual(['createPost']);
    });

    it('should return null for non-subscription field', () => {
      const schema = `
        type Query {
          getPost: Post
        }
      `;

      const directives = parseSchemaDirectives(schema);
      const mutations = getSubscriptionMutations('getPost', directives);

      expect(mutations).toBeNull();
    });
  });

  describe('authConfigToAuthMode', () => {
    it('should map auth config types correctly', () => {
      expect(authConfigToAuthMode('API_KEY')).toBe('API_KEY');
      expect(authConfigToAuthMode('AWS_IAM')).toBe('AWS_IAM');
      expect(authConfigToAuthMode('AMAZON_COGNITO_USER_POOLS')).toBe('AMAZON_COGNITO_USER_POOLS');
      expect(authConfigToAuthMode('OPENID_CONNECT')).toBe('OPENID_CONNECT');
      expect(authConfigToAuthMode('AWS_LAMBDA')).toBe('AWS_LAMBDA');
    });

    it('should return null for unknown auth types', () => {
      expect(authConfigToAuthMode('UNKNOWN')).toBeNull();
      expect(authConfigToAuthMode('')).toBeNull();
    });
  });

  describe('getFieldReturnType', () => {
    it('should return the return type of a field', () => {
      const schema = `
        type Query {
          getUser: User
          getPost: Post
        }
        type User { id: ID! }
        type Post { id: ID! }
      `;
      const directives = parseSchemaDirectives(schema);

      expect(getFieldReturnType('Query', 'getUser', directives)).toBe('User');
      expect(getFieldReturnType('Query', 'getPost', directives)).toBe('Post');
    });

    it('should unwrap non-null types', () => {
      const schema = `
        type Query {
          getUser: User!
        }
        type User { id: ID! }
      `;
      const directives = parseSchemaDirectives(schema);

      expect(getFieldReturnType('Query', 'getUser', directives)).toBe('User');
    });

    it('should unwrap list types', () => {
      const schema = `
        type Query {
          listUsers: [User]
          listPosts: [Post!]!
        }
        type User { id: ID! }
        type Post { id: ID! }
      `;
      const directives = parseSchemaDirectives(schema);

      expect(getFieldReturnType('Query', 'listUsers', directives)).toBe('User');
      expect(getFieldReturnType('Query', 'listPosts', directives)).toBe('Post');
    });

    it('should return null for unknown fields', () => {
      const schema = `
        type Query {
          getUser: User
        }
      `;
      const directives = parseSchemaDirectives(schema);

      expect(getFieldReturnType('Query', 'unknownField', directives)).toBeNull();
      expect(getFieldReturnType('UnknownType', 'getUser', directives)).toBeNull();
    });

    it('should handle scalar return types', () => {
      const schema = `
        type Query {
          getName: String
          getAge: Int!
          getScores: [Float!]!
        }
      `;
      const directives = parseSchemaDirectives(schema);

      expect(getFieldReturnType('Query', 'getName', directives)).toBe('String');
      expect(getFieldReturnType('Query', 'getAge', directives)).toBe('Int');
      expect(getFieldReturnType('Query', 'getScores', directives)).toBe('Float');
    });
  });

  describe('isScalarOrBuiltinType', () => {
    it('should return true for GraphQL scalars', () => {
      expect(isScalarOrBuiltinType('String')).toBe(true);
      expect(isScalarOrBuiltinType('Int')).toBe(true);
      expect(isScalarOrBuiltinType('Float')).toBe(true);
      expect(isScalarOrBuiltinType('Boolean')).toBe(true);
      expect(isScalarOrBuiltinType('ID')).toBe(true);
    });

    it('should return true for AWS AppSync scalars', () => {
      expect(isScalarOrBuiltinType('AWSDate')).toBe(true);
      expect(isScalarOrBuiltinType('AWSDateTime')).toBe(true);
      expect(isScalarOrBuiltinType('AWSTime')).toBe(true);
      expect(isScalarOrBuiltinType('AWSTimestamp')).toBe(true);
      expect(isScalarOrBuiltinType('AWSJSON')).toBe(true);
      expect(isScalarOrBuiltinType('AWSURL')).toBe(true);
      expect(isScalarOrBuiltinType('AWSEmail')).toBe(true);
      expect(isScalarOrBuiltinType('AWSPhone')).toBe(true);
      expect(isScalarOrBuiltinType('AWSIPAddress')).toBe(true);
    });

    it('should return false for custom types', () => {
      expect(isScalarOrBuiltinType('User')).toBe(false);
      expect(isScalarOrBuiltinType('Post')).toBe(false);
      expect(isScalarOrBuiltinType('CustomType')).toBe(false);
    });
  });

  describe('getTypeAuthRequirements', () => {
    it('should return type-level directives', () => {
      const schema = `
        type Query @aws_api_key {
          getUser: User
        }
        type User @aws_iam {
          id: ID!
        }
      `;
      const directives = parseSchemaDirectives(schema);

      const queryReqs = getTypeAuthRequirements('Query', directives);
      expect(queryReqs.allowedModes).toHaveLength(1);
      expect(queryReqs.allowedModes[0].authMode).toBe('API_KEY');
      expect(queryReqs.hasExplicitDirectives).toBe(true);

      const userReqs = getTypeAuthRequirements('User', directives);
      expect(userReqs.allowedModes).toHaveLength(1);
      expect(userReqs.allowedModes[0].authMode).toBe('AWS_IAM');
      expect(userReqs.hasExplicitDirectives).toBe(true);
    });

    it('should return multiple directives on a type', () => {
      const schema = `
        type User @aws_api_key @aws_cognito_user_pools {
          id: ID!
        }
      `;
      const directives = parseSchemaDirectives(schema);

      const reqs = getTypeAuthRequirements('User', directives);
      expect(reqs.allowedModes).toHaveLength(2);
      expect(reqs.allowedModes.map((m) => m.authMode)).toContain('API_KEY');
      expect(reqs.allowedModes.map((m) => m.authMode)).toContain('AMAZON_COGNITO_USER_POOLS');
    });

    it('should fall back to default auth mode', () => {
      const schema = `
        type User {
          id: ID!
        }
      `;
      const directives = parseSchemaDirectives(schema, 'API_KEY');

      const reqs = getTypeAuthRequirements('User', directives);
      expect(reqs.allowedModes).toHaveLength(1);
      expect(reqs.allowedModes[0].authMode).toBe('API_KEY');
      expect(reqs.hasExplicitDirectives).toBe(false);
    });

    it('should return empty array when no auth configured', () => {
      const schema = `
        type User {
          id: ID!
        }
      `;
      const directives = parseSchemaDirectives(schema);

      const reqs = getTypeAuthRequirements('User', directives);
      expect(reqs.allowedModes).toHaveLength(0);
      expect(reqs.hasExplicitDirectives).toBe(false);
    });

    it('should include cognito groups from type directive', () => {
      const schema = `
        type AdminData @aws_cognito_user_pools(cognito_groups: ["Admin", "Moderator"]) {
          secret: String
        }
      `;
      const directives = parseSchemaDirectives(schema);

      const reqs = getTypeAuthRequirements('AdminData', directives);
      expect(reqs.allowedModes).toHaveLength(1);
      expect(reqs.allowedModes[0].authMode).toBe('AMAZON_COGNITO_USER_POOLS');
      expect(reqs.allowedModes[0].cognitoGroups).toEqual(['Admin', 'Moderator']);
    });
  });
});
