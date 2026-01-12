import fs from 'fs';
import path from 'path';
import { z } from 'zod';

// Base directory for resolving relative paths (set by validateConfig)
let configBaseDir: string = process.cwd();

/**
 * Set the base directory for resolving relative file paths in config.
 * This should be called with the config file's directory before validation.
 */
export function setConfigBaseDir(dir: string): void {
  configBaseDir = dir;
}

/**
 * Get the current config base directory.
 */
export function getConfigBaseDir(): string {
  return configBaseDir;
}

// Helper to resolve and check files exist
const validateFilePath = (p: string): boolean => {
  try {
    // Resolve path relative to config file's directory
    const resolved = path.isAbsolute(p) ? p : path.resolve(configBaseDir, p);
    return fs.existsSync(resolved);
  } catch {
    return false;
  }
};

// Base config schema for AWS credentials
export const AWSConfigSchema = z.object({
  region: z.string(),
  endpoint: z.string().optional(),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
});

// DynamoDB specific config
export const DynamoDBConfigSchema = AWSConfigSchema.extend({
  tableName: z.string(),
});

// Lambda specific config
export const LambdaConfigSchema = AWSConfigSchema.extend({
  functionName: z.string(),
  file: z
    .string()
    .optional()
    .refine((v) => !v || validateFilePath(v), {
      message: 'Lambda function file must exist',
    }),
});

// HTTP specific config
export const HTTPConfigSchema = z.object({
  endpoint: z.string().url(),
  authorizationConfig: z
    .object({
      authorizationType: z.enum(['AWS_IAM', 'API_KEY', 'NONE']),
      awsIamConfig: z
        .object({
          signingRegion: z.string(),
          signingServiceName: z.string(),
        })
        .optional(),
    })
    .optional(),
  defaultHeaders: z.record(z.string(), z.string()).optional(),
});

// RDS specific config - supports both local and AWS Data API modes
export const RDSConfigSchema = z
  .object({
    databaseName: z.string(),
    engine: z.enum(['postgresql', 'mysql']),
    mode: z.enum(['local', 'aws']).optional().default('local'),
    // AWS Data API settings
    region: z.string().optional(),
    dbClusterIdentifier: z.string().optional(),
    awsSecretStoreArn: z.string().optional(),
    resourceArn: z.string().optional(),
    // Local connection parameters
    host: z.string().optional(),
    port: z.number().int().positive().optional(),
    user: z.string().optional(),
    password: z.string().optional(),
    ssl: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.mode === 'aws') {
        return data.region && data.resourceArn && data.awsSecretStoreArn;
      }
      return data.host && data.port && data.user && data.password;
    },
    {
      message:
        'For AWS mode: region, resourceArn, and awsSecretStoreArn are required. For local mode: host, port, user, and password are required.',
    }
  );

// Data source schemas
export const DynamoDataSourceSchema = z.object({
  type: z.literal('DYNAMODB'),
  name: z.string(),
  config: DynamoDBConfigSchema,
});

export const LambdaDataSourceSchema = z.object({
  type: z.literal('LAMBDA'),
  name: z.string(),
  config: LambdaConfigSchema,
});

export const NoneDataSourceSchema = z.object({
  type: z.literal('NONE'),
  name: z.string(),
});

export const HTTPDataSourceSchema = z.object({
  type: z.literal('HTTP'),
  name: z.string(),
  config: HTTPConfigSchema,
});

export const RDSDataSourceSchema = z.object({
  type: z.literal('RDS'),
  name: z.string(),
  config: RDSConfigSchema,
});

// Allow any string for resolver type - supports Query, Mutation, Subscription
// and custom type field resolvers like "Task", "User", "Project"
export const ResolverType = z.string().min(1);

export const FunctionSchema = z.object({
  file: z.string().refine(validateFilePath, { message: 'Function file must exist' }),
  dataSource: z.string(), // Now expects data source name, not type
});

export const PipelineResolverSchema = z.object({
  type: ResolverType,
  field: z.string(),
  kind: z.literal('Pipeline'),
  file: z.string().refine(validateFilePath, { message: 'Pipeline resolver must have a top level file' }),
  pipelineFunctions: z.array(FunctionSchema),
});

export const UnitResolverSchema = z.object({
  type: ResolverType,
  field: z.string(),
  kind: z.literal('Unit'),
  dataSource: z.string(), // Now expects data source name, not type
  file: z.string().refine(validateFilePath, { message: 'Unit resolver must have a file' }),
});

export const ResolverSchema = z.discriminatedUnion('kind', [PipelineResolverSchema, UnitResolverSchema]);

// Top level data source schema
export const DataSourceSchema = z.discriminatedUnion('type', [
  DynamoDataSourceSchema,
  LambdaDataSourceSchema,
  NoneDataSourceSchema,
  HTTPDataSourceSchema,
  RDSDataSourceSchema,
]);

export const AuthConfigSchema = z.object({
  type: z.string(),
  key: z.string().optional(),
  description: z.string().optional(),
  expiration: z.number().optional(),
  lambdaFunction: z
    .string()
    .optional()
    .refine((v) => !v || validateFilePath(v), {
      message: 'Lambda function file must exist',
    }),
  secret: z.string().optional(),
  issuer: z.string().optional(),
  audience: z.string().optional(),
  // Cognito User Pool ID
  userPoolId: z.string().optional(),
  // OIDC client ID (alias for audience)
  clientId: z.string().optional(),
  // Mock identity for local development (AWS_LAMBDA auth without lambdaFunction)
  identity: z
    .object({
      sub: z.string().optional(),
      username: z.string().optional(),
      groups: z.array(z.string()).optional(),
    })
    .catchall(z.unknown())
    .optional(),
  // Mock resolver context for local development (AWS_LAMBDA auth)
  resolverContext: z.record(z.string(), z.unknown()).optional(),
});

export const ConfigSchema = z
  .object({
    $schema: z.string().optional(), // JSON Schema reference for IDE support
    schema: z.string().refine(validateFilePath, { message: 'Schema file must exist' }),
    apiConfig: z.object({
      auth: z.array(AuthConfigSchema),
    }),
    resolvers: z.array(ResolverSchema),
    dataSources: z.array(DataSourceSchema),
    port: z.number().default(4000),
  })
  .strict()
  .refine(
    (data) => {
      // Validate that all referenced data sources exist
      const dataSourceNames = data.dataSources.map((ds) => ds.name);
      const allReferencedDataSources = new Set<string>();

      // Collect all referenced data sources from resolvers
      for (const resolver of data.resolvers) {
        if (resolver.kind === 'Unit') {
          allReferencedDataSources.add(resolver.dataSource);
        } else if (resolver.kind === 'Pipeline') {
          for (const fn of resolver.pipelineFunctions) {
            allReferencedDataSources.add(fn.dataSource);
          }
        }
      }

      // Check if all referenced data sources exist
      const missingDataSources = Array.from(allReferencedDataSources).filter((name) => !dataSourceNames.includes(name));
      if (missingDataSources.length > 0) {
        throw new Error(`Referenced data sources not found: ${missingDataSources.join(', ')}`);
      }

      return true;
    },
    { message: 'All referenced data sources must be defined in the dataSources array' }
  );

// Export inferred types from Zod schemas
export type AWSConfigType = z.infer<typeof AWSConfigSchema>;
export type DynamoDBConfigType = z.infer<typeof DynamoDBConfigSchema>;
export type LambdaConfigType = z.infer<typeof LambdaConfigSchema>;
export type HTTPConfigType = z.infer<typeof HTTPConfigSchema>;
export type RDSConfigType = z.infer<typeof RDSConfigSchema>;
export type DataSourceType = z.infer<typeof DataSourceSchema>;
export type ResolverTypeEnum = z.infer<typeof ResolverType>;
export type FunctionType = z.infer<typeof FunctionSchema>;
export type PipelineResolverType = z.infer<typeof PipelineResolverSchema>;
export type UnitResolverType = z.infer<typeof UnitResolverSchema>;
export type ResolverSchemaType = z.infer<typeof ResolverSchema>;
export type AuthConfigType = z.infer<typeof AuthConfigSchema>;
export type ConfigType = z.infer<typeof ConfigSchema>;
