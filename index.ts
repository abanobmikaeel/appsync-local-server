// Main entry point for appsync-local

// Server exports
export { startServer, type StartServerOptions } from './src/server.js';

// CLI exports
export { runCli } from './src/cli.js';

// Validation exports
export {
  validateConfig,
  validateAppSyncJavaScript,
  validateGraphQL,
  APPSYNC_RESTRICTIONS,
  ConfigSchema,
  type ConfigType,
} from './src/validators.js';

// Data source handler exports
export {
  executeDataSource,
  executeDynamoOperation,
  executeLambdaOperation,
  executeHTTPOperation,
  executeRDSOperation,
  httpRequest,
  rdsRequest,
  isSuccessResponse,
  closeAllPools,
} from './src/datasourceHandlers/index.js';

// Resolver handler exports
export { buildResolverMap, createUnitResolver, createPipelineResolver } from './src/resolverHandlers/index.js';

// Context exports
export { createContext } from './src/context.js';

// Module loader exports
export { loadResolverModule } from './src/imports.js';

// Type exports
export type {
  // Data source types
  DataSourceType,
  AWSConfig,
  DynamoDBConfig,
  LambdaConfig,
  HTTPConfig,
  RDSConfig,
  DataSource,
  DynamoDataSource,
  LambdaDataSource,
  NoneDataSource,
  HTTPDataSource,
  RDSDataSource,
  // Resolver types
  ResolverType,
  ResolverKind,
  PipelineFunction,
  BaseResolver,
  UnitResolver,
  PipelineResolver,
  Resolver,
  // Auth types
  AuthConfig,
  // Config types
  AppSyncConfig,
  ServerConfig,
  // Context types
  ResolverContext,
  AppSyncIdentity,
  AppSyncRequest,
  AppSyncInfo,
  AppSyncError,
  AppSyncUtils,
  // Request/Response types
  DynamoOperation,
  DynamoRequest,
  LambdaRequest,
  HTTPMethod,
  HTTPRequest,
  HTTPResponse,
  RDSOperation,
  RDSRequest,
  RDSResponse,
  // Module types
  ResolverModule,
  LambdaModule,
  // Resolver map types
  GraphQLResolverFn,
  ResolverMap,
  // Validation types
  ValidationResult,
  SchemaValidationResult,
  SchemaFields,
  // AppSync restrictions
  AppSyncRestrictions,
  // Utility types
  DocClient,
} from './src/types/index.js';
