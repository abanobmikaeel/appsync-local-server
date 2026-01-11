// Main entry point for appsync-local

// CLI exports
export { runCli } from './src/cli.js';
// Context exports
export { createContext } from './src/context.js';
// Data source handler exports
export {
  closeAllPools,
  executeDataSource,
  executeDynamoOperation,
  executeHTTPOperation,
  executeLambdaOperation,
  executeRDSOperation,
  httpRequest,
  isSuccessResponse,
  rdsRequest,
} from './src/datasourceHandlers/index.js';
// Module loader exports
export { loadResolverModule } from './src/imports.js';

// Resolver handler exports
export { buildResolverMap, createPipelineResolver, createUnitResolver } from './src/resolverHandlers/index.js';
// Server exports
export { type StartServerOptions, startServer } from './src/server.js';
// Type exports
export type {
  // Config types
  AppSyncConfig,
  AppSyncError,
  AppSyncIdentity,
  AppSyncInfo,
  AppSyncRequest,
  // AppSync restrictions
  AppSyncRestrictions,
  AppSyncUtils,
  // Auth types
  AuthConfig,
  AWSConfig,
  BaseResolver,
  DataSource,
  // Data source types
  DataSourceType,
  // Utility types
  DocClient,
  DynamoDataSource,
  DynamoDBConfig,
  // Request/Response types
  DynamoOperation,
  DynamoRequest,
  // Resolver map types
  GraphQLResolverFn,
  HTTPConfig,
  HTTPDataSource,
  HTTPMethod,
  HTTPRequest,
  HTTPResponse,
  LambdaConfig,
  LambdaDataSource,
  LambdaModule,
  LambdaRequest,
  NoneDataSource,
  PipelineFunction,
  PipelineResolver,
  RDSConfig,
  RDSDataSource,
  RDSOperation,
  RDSRequest,
  RDSResponse,
  Resolver,
  // Context types
  ResolverContext,
  ResolverKind,
  ResolverMap,
  // Module types
  ResolverModule,
  // Resolver types
  ResolverType,
  SchemaFields,
  SchemaValidationResult,
  ServerConfig,
  UnitResolver,
  // Validation types
  ValidationResult,
} from './src/types/index.js';
// Validation exports
export {
  APPSYNC_RESTRICTIONS,
  ConfigSchema,
  type ConfigType,
  validateAppSyncJavaScript,
  validateConfig,
  validateGraphQL,
} from './src/validators.js';
