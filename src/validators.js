import { z } from 'zod';
import path from 'path';
import fs from 'fs';

// Helper to check files exist
const validateFilePath = (p) => {
  try {
    return fs.existsSync(path.resolve(process.cwd(), p));
  } catch {
    return false;
  }
};

// Base config schema for AWS credentials
const AWSConfigSchema = z.object({
  region: z.string(),
  endpoint: z.string().optional(),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional()
});


// DynamoDB specific config
const DynamoDBConfigSchema = AWSConfigSchema.extend({
  tableName: z.string()
});

// Lambda specific config
const LambdaConfigSchema = AWSConfigSchema.extend({
  functionName: z.string()
});

// Data source schemas
const DynamoDataSourceSchema = z.object({
  type: z.literal('DYNAMODB'),
  name: z.string(),
  config: DynamoDBConfigSchema
});

const LambdaDataSourceSchema = z.object({
  type: z.literal('LAMBDA'),
  name: z.string(),
  config: LambdaConfigSchema
});

const NoneDataSourceSchema = z.object({
  type: z.literal('NONE'),
  name: z.string()
});

const ResolverType   = z.enum(['Query','Mutation','Subscription']);
const DataSourceEnum = z.enum(['LAMBDA','NONE','DYNAMODB']);

const FunctionSchema = z.object({
  file: z.string().refine(validateFilePath, { message: "Function file must exist" }),
  dataSource: DataSourceEnum
});

const PipelineResolverSchema = z.object({
  type: ResolverType,
  field: z.string(),
  kind: z.literal('Pipeline'),
  file: z.string().refine(validateFilePath, { message: "Pipeline resolver must have a top level file" }),
  pipelineFunctions: z.array(FunctionSchema)
});

const UnitResolverSchema = z.object({
  type: ResolverType,
  field: z.string(),
  kind: z.literal('Unit'),
  dataSource: DataSourceEnum,
  file: z.string().refine(validateFilePath, { message: "Unit resolver must have a file" })
});

const ResolverSchema = z.discriminatedUnion('kind', [
  PipelineResolverSchema,
  UnitResolverSchema
]);

// Top level data source schema
const DataSourceSchema = z.discriminatedUnion('type', [
  DynamoDataSourceSchema,
  LambdaDataSourceSchema,
  NoneDataSourceSchema
]);

const AuthConfigSchema = z.object({
  type: z.string(),
  key: z.string().optional(),
  description: z.string().optional(),
  expiration: z.number().optional(),
  lambdaFunction: z.string().optional().refine(v => !v || validateFilePath(v), {
    message: "Lambda function file must exist"
  }),
  secret: z.string().optional(),
  issuer: z.string().optional(),
  audience: z.string().optional()
});

const ConfigSchema = z.object({
  schema: z.string().refine(validateFilePath, { message: "Schema file must exist" }),
  apiConfig: z.object({
    auth: z.array(AuthConfigSchema)
  }),
  resolvers: z.array(ResolverSchema),
  dataSources: z.array(DataSourceSchema),
  port: z.number().default(4000)
}).strict();

export function validateConfig(raw) {
  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    console.error('❌  Invalid config:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }
  return result.data;
}
