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
export const AWSConfigSchema = z.object({
  region: z.string(),
  endpoint: z.string().optional(),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional()
});

// DynamoDB specific config
export const DynamoDBConfigSchema = AWSConfigSchema.extend({
  tableName: z.string()
});

// Lambda specific config
export const LambdaConfigSchema = AWSConfigSchema.extend({
  functionName: z.string(),
  file: z.string().optional().refine(v => !v || validateFilePath(v), {
    message: "Lambda function file must exist"
  })
});

// Data source schemas
export const DynamoDataSourceSchema = z.object({
  type: z.literal('DYNAMODB'),
  name: z.string(),
  config: DynamoDBConfigSchema
});

export const LambdaDataSourceSchema = z.object({
  type: z.literal('LAMBDA'),
  name: z.string(),
  config: LambdaConfigSchema
});

export const NoneDataSourceSchema = z.object({
  type: z.literal('NONE'),
  name: z.string()
});

export const ResolverType = z.enum(['Query','Mutation','Subscription']);

export const FunctionSchema = z.object({
  file: z.string().refine(validateFilePath, { message: "Function file must exist" }),
  dataSource: z.string() // Now expects data source name, not type
});

export const PipelineResolverSchema = z.object({
  type: ResolverType,
  field: z.string(),
  kind: z.literal('Pipeline'),
  file: z.string().refine(validateFilePath, { message: "Pipeline resolver must have a top level file" }),
  pipelineFunctions: z.array(FunctionSchema)
});

export const UnitResolverSchema = z.object({
  type: ResolverType,
  field: z.string(),
  kind: z.literal('Unit'),
  dataSource: z.string(), // Now expects data source name, not type
  file: z.string().refine(validateFilePath, { message: "Unit resolver must have a file" })
});

export const ResolverSchema = z.discriminatedUnion('kind', [
  PipelineResolverSchema,
  UnitResolverSchema
]);

// Top level data source schema
export const DataSourceSchema = z.discriminatedUnion('type', [
  DynamoDataSourceSchema,
  LambdaDataSourceSchema,
  NoneDataSourceSchema
]);

export const AuthConfigSchema = z.object({
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

export const ConfigSchema = z.object({
  schema: z.string().refine(validateFilePath, { message: "Schema file must exist" }),
  apiConfig: z.object({
    auth: z.array(AuthConfigSchema)
  }),
  resolvers: z.array(ResolverSchema),
  dataSources: z.array(DataSourceSchema),
  port: z.number().default(4000)
}).strict().refine((data) => {
  // Validate that all referenced data sources exist
  const dataSourceNames = data.dataSources.map(ds => ds.name);
  const allReferencedDataSources = new Set();
  
  // Collect all referenced data sources from resolvers
  data.resolvers.forEach(resolver => {
    if (resolver.kind === 'Unit') {
      allReferencedDataSources.add(resolver.dataSource);
    } else if (resolver.kind === 'Pipeline') {
      resolver.pipelineFunctions.forEach(fn => {
        allReferencedDataSources.add(fn.dataSource);
      });
    }
  });
  
  // Check if all referenced data sources exist
  const missingDataSources = Array.from(allReferencedDataSources).filter(name => !dataSourceNames.includes(name));
  if (missingDataSources.length > 0) {
    throw new Error(`Referenced data sources not found: ${missingDataSources.join(', ')}`);
  }
  
  return true;
}, { message: "All referenced data sources must be defined in the dataSources array" }); 