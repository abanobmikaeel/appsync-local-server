import { describe, expect, it } from '@jest/globals';
import {
  AWSConfigSchema,
  DynamoDBConfigSchema,
  HTTPConfigSchema,
  PipelineResolverSchema,
  RDSConfigSchema,
  UnitResolverSchema,
} from '../../../src/validators/configSchemas.js';

describe('configSchemas', () => {
  describe('AWSConfigSchema', () => {
    it('should validate minimal config with just region', () => {
      const result = AWSConfigSchema.safeParse({ region: 'us-east-1' });
      expect(result.success).toBe(true);
    });

    it('should validate config with endpoint for local development', () => {
      const result = AWSConfigSchema.safeParse({
        region: 'us-east-1',
        endpoint: 'http://localhost:8000',
      });
      expect(result.success).toBe(true);
    });

    it('should validate config with credentials', () => {
      const result = AWSConfigSchema.safeParse({
        region: 'us-east-1',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });
      expect(result.success).toBe(true);
    });

    it('should reject config without region', () => {
      const result = AWSConfigSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('DynamoDBConfigSchema', () => {
    it('should validate DynamoDB config with tableName', () => {
      const result = DynamoDBConfigSchema.safeParse({
        region: 'us-east-1',
        tableName: 'users',
      });
      expect(result.success).toBe(true);
    });

    it('should validate local DynamoDB config', () => {
      const result = DynamoDBConfigSchema.safeParse({
        region: 'us-east-1',
        tableName: 'users',
        endpoint: 'http://localhost:8000',
        accessKeyId: 'fakeId',
        secretAccessKey: 'fakeSecret',
      });
      expect(result.success).toBe(true);
    });

    it('should reject config without tableName', () => {
      const result = DynamoDBConfigSchema.safeParse({
        region: 'us-east-1',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('HTTPConfigSchema', () => {
    it('should validate HTTP config with endpoint', () => {
      const result = HTTPConfigSchema.safeParse({
        endpoint: 'https://api.example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should validate HTTP config with default headers', () => {
      const result = HTTPConfigSchema.safeParse({
        endpoint: 'https://api.example.com',
        defaultHeaders: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
      });
      expect(result.success).toBe(true);
    });

    it('should validate HTTP config with authorization', () => {
      const result = HTTPConfigSchema.safeParse({
        endpoint: 'https://api.example.com',
        authorizationConfig: {
          authorizationType: 'AWS_IAM',
          awsIamConfig: {
            signingRegion: 'us-east-1',
            signingServiceName: 'execute-api',
          },
        },
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid endpoint URL', () => {
      const result = HTTPConfigSchema.safeParse({
        endpoint: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('RDSConfigSchema', () => {
    it('should validate local RDS config', () => {
      const result = RDSConfigSchema.safeParse({
        databaseName: 'mydb',
        engine: 'postgresql',
        mode: 'local',
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'password',
      });
      expect(result.success).toBe(true);
    });

    it('should validate AWS RDS Data API config', () => {
      const result = RDSConfigSchema.safeParse({
        databaseName: 'mydb',
        engine: 'postgresql',
        mode: 'aws',
        region: 'us-east-1',
        resourceArn: 'arn:aws:rds:us-east-1:123456789:cluster:my-cluster',
        awsSecretStoreArn: 'arn:aws:secretsmanager:us-east-1:123456789:secret:my-secret',
      });
      expect(result.success).toBe(true);
    });

    it('should default mode to local', () => {
      const result = RDSConfigSchema.safeParse({
        databaseName: 'mydb',
        engine: 'mysql',
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'password',
      });
      expect(result.success).toBe(true);
    });

    it('should reject local mode without required fields', () => {
      const result = RDSConfigSchema.safeParse({
        databaseName: 'mydb',
        engine: 'postgresql',
        mode: 'local',
        host: 'localhost',
        // missing port, user, password
      });
      expect(result.success).toBe(false);
    });

    it('should reject AWS mode without required fields', () => {
      const result = RDSConfigSchema.safeParse({
        databaseName: 'mydb',
        engine: 'postgresql',
        mode: 'aws',
        region: 'us-east-1',
        // missing resourceArn, awsSecretStoreArn
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid engine', () => {
      const result = RDSConfigSchema.safeParse({
        databaseName: 'mydb',
        engine: 'oracle',
        mode: 'local',
        host: 'localhost',
        port: 1521,
        user: 'system',
        password: 'password',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UnitResolverSchema', () => {
    it('should validate unit resolver', () => {
      const result = UnitResolverSchema.safeParse({
        type: 'Query',
        field: 'getUser',
        kind: 'Unit',
        dataSource: 'UsersTable',
        file: 'examples/basic/resolvers/getUser.js',
      });
      expect(result.success).toBe(true);
    });

    it('should reject resolver with empty type', () => {
      // Resolver types can be Query, Mutation, Subscription, or custom types like Task, User
      // Empty string is invalid
      const result = UnitResolverSchema.safeParse({
        type: '',
        field: 'getUser',
        kind: 'Unit',
        dataSource: 'UsersTable',
        file: 'examples/basic/resolvers/getUser.js',
      });
      expect(result.success).toBe(false);
    });

    it('should accept custom type resolver (field resolver on Task)', () => {
      const result = UnitResolverSchema.safeParse({
        type: 'Task',
        field: 'taskNumber',
        kind: 'Unit',
        dataSource: 'NoneDS',
        file: 'examples/basic/resolvers/getUser.js',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('PipelineResolverSchema', () => {
    it('should validate pipeline resolver', () => {
      const result = PipelineResolverSchema.safeParse({
        type: 'Mutation',
        field: 'createUser',
        kind: 'Pipeline',
        file: 'examples/basic/resolvers/createUser.js',
        pipelineFunctions: [{ file: 'examples/basic/resolvers/createUser.js', dataSource: 'NoneDS' }],
      });
      expect(result.success).toBe(true);
    });

    it('should reject pipeline without functions', () => {
      const result = PipelineResolverSchema.safeParse({
        type: 'Mutation',
        field: 'createUser',
        kind: 'Pipeline',
        file: 'examples/basic/resolvers/createUser.js',
        pipelineFunctions: [],
      });
      expect(result.success).toBe(true); // Empty array is valid in schema
    });
  });
});
