import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// ============================================================================
// Data Source Types
// ============================================================================

export type DataSourceType = 'DYNAMODB' | 'LAMBDA' | 'NONE' | 'HTTP' | 'RDS';

export interface AWSConfig {
  region: string;
  // Optional endpoint for local development (e.g., http://localhost:8000)
  // If not provided, connects to real AWS
  endpoint?: string;
  // Credentials (optional - uses default credential chain if not provided)
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface DynamoDBConfig extends AWSConfig {
  tableName: string;
}

export interface LambdaConfig extends AWSConfig {
  functionName: string;
  file?: string;
}

export interface HTTPConfig {
  endpoint: string;
  authorizationConfig?: {
    authorizationType: 'AWS_IAM' | 'API_KEY' | 'NONE';
    awsIamConfig?: {
      signingRegion: string;
      signingServiceName: string;
    };
  };
  defaultHeaders?: Record<string, string>;
}

export interface RDSConfig {
  databaseName: string;
  engine: 'postgresql' | 'mysql';
  // Connection mode: 'local' for direct DB connection, 'aws' for AWS Data API
  mode?: 'local' | 'aws';
  // AWS Data API (mode: 'aws')
  region?: string;
  dbClusterIdentifier?: string;
  awsSecretStoreArn?: string;
  resourceArn?: string;
  // Local connection parameters (mode: 'local')
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  ssl?: boolean;
}

export interface DynamoDataSource {
  type: 'DYNAMODB';
  name: string;
  config: DynamoDBConfig;
}

export interface LambdaDataSource {
  type: 'LAMBDA';
  name: string;
  config: LambdaConfig;
}

export interface NoneDataSource {
  type: 'NONE';
  name: string;
}

export interface HTTPDataSource {
  type: 'HTTP';
  name: string;
  config: HTTPConfig;
}

export interface RDSDataSource {
  type: 'RDS';
  name: string;
  config: RDSConfig;
}

export type DataSource = DynamoDataSource | LambdaDataSource | NoneDataSource | HTTPDataSource | RDSDataSource;

// ============================================================================
// Resolver Types
// ============================================================================

// Standard GraphQL root types + custom types for field resolvers
export type RootResolverType = 'Query' | 'Mutation' | 'Subscription';
export type ResolverType = string; // Supports Query, Mutation, Subscription, and custom types like "Task", "User"
export type ResolverKind = 'Unit' | 'Pipeline';

export interface PipelineFunction {
  file: string;
  dataSource: string;
}

export interface BaseResolver {
  type: ResolverType;
  field: string;
}

export interface UnitResolver extends BaseResolver {
  kind: 'Unit';
  dataSource: string;
  file: string;
}

export interface PipelineResolver extends BaseResolver {
  kind: 'Pipeline';
  file: string;
  pipelineFunctions: PipelineFunction[];
}

export type Resolver = UnitResolver | PipelineResolver;

// ============================================================================
// Auth Types
// ============================================================================

export interface AuthConfig {
  type: string;
  key?: string;
  description?: string;
  expiration?: number;
  lambdaFunction?: string;
  secret?: string;
  issuer?: string;
  audience?: string;
}

// ============================================================================
// Config Types
// ============================================================================

export interface AppSyncConfig {
  schema: string;
  apiConfig: {
    auth: AuthConfig[];
  };
  resolvers: Resolver[];
  dataSources: DataSource[];
  port?: number;
}

export interface ServerConfig extends AppSyncConfig {
  port: number;
}

// ============================================================================
// Context Types
// ============================================================================

export interface AppSyncIdentity {
  sub?: string;
  issuer?: string;
  username?: string;
  claims?: Record<string, unknown>;
  sourceIp?: string[];
  defaultAuthStrategy?: string;
  /** Cognito groups the user belongs to (for group-based authorization) */
  groups?: string[];
}

export interface AppSyncRequest {
  headers: Record<string, string>;
  domainName?: string;
}

export interface AppSyncInfo {
  fieldName: string;
  parentTypeName: string;
  variables?: Record<string, unknown>;
  selectionSetList?: string[];
  selectionSetGraphQL?: string;
}

export interface AppSyncError {
  message: string;
  type?: string;
  errorInfo?: Record<string, unknown>;
}

export interface AppSyncUtils {
  // Error handling
  appendError: (message: string, errorType?: string, data?: unknown, errorInfo?: Record<string, unknown>) => void;
  error: (message: string, errorType?: string, data?: unknown, errorInfo?: Record<string, unknown>) => never;
  unauthorized: () => never;

  // ID generation
  autoId: () => string;
  autoUlid: () => string;
  autoKsuid: () => string;

  // Encoding utilities
  base64Encode: (data: string) => string;
  base64Decode: (data: string) => string;
  urlEncode: (data: string) => string;
  urlDecode: (data: string) => string;

  // Pattern matching
  matches: (pattern: string, data: string) => boolean;

  // JavaScript escaping
  escapeJavaScript: (data: string) => string;

  // Auth type
  authType: () => string;

  // Check if value is null/undefined
  isNull: (value: unknown) => boolean;
  isNullOrEmpty: (value: unknown) => boolean;
  isNullOrBlank: (value: unknown) => boolean;
  defaultIfNull: <T>(value: T | null | undefined, defaultValue: T) => T;
  defaultIfNullOrEmpty: <T>(value: T | null | undefined, defaultValue: T) => T;
  defaultIfNullOrBlank: <T>(value: T | null | undefined, defaultValue: T) => T;

  // Type conversion
  typeOf: (value: unknown) => string;

  time: {
    nowISO8601: () => string;
    nowEpochSeconds: () => number;
    nowEpochMilliSeconds: () => number;
    nowFormatted: (format: string, timezone?: string) => string;
    parseISO8601ToEpochMilliSeconds: (date: string) => number;
    parseFormattedToEpochMilliSeconds: (date: string, format: string, timezone?: string) => number;
    epochMilliSecondsToSeconds: (epoch: number) => number;
    epochMilliSecondsToISO8601: (epoch: number) => string;
    epochMilliSecondsToFormatted: (epoch: number, format: string, timezone?: string) => string;
  };

  dynamodb: {
    toDynamoDB: (value: unknown) => unknown;
    toMapValues: (value: Record<string, unknown>) => Record<string, unknown>;
    toS3Object: (key: string, bucket: string, region: string, version?: string) => unknown;
    fromS3ObjectJson: (s3String: string) => { key: string; bucket: string; region: string; version?: string };
    // Type-specific conversions
    toString: (value: string) => { S: string };
    toStringSet: (values: string[]) => { SS: string[] };
    toNumber: (value: number) => { N: string };
    toNumberSet: (values: number[]) => { NS: string[] };
    toBinary: (value: string) => { B: string };
    toBinarySet: (values: string[]) => { BS: string[] };
    toBoolean: (value: boolean) => { BOOL: boolean };
    toNull: () => { NULL: true };
    toList: (values: unknown[]) => { L: unknown[] };
    toMap: (value: Record<string, unknown>) => { M: Record<string, unknown> };
  };

  str: {
    toUpper: (str: string) => string;
    toLower: (str: string) => string;
    toReplace: (str: string, substr: string, replacement: string) => string;
    normalize: (str: string, form: string) => string;
  };

  math: {
    roundNum: (num: number, precision?: number) => number;
    minVal: (nums: number[]) => number;
    maxVal: (nums: number[]) => number;
    randomDouble: () => number;
    randomWithinRange: (min: number, max: number) => number;
  };

  transform: {
    toJson: (value: unknown) => string;
    toJsonPretty: (value: unknown) => string;
    /** Convert filter object to AppSync subscription filter format */
    toSubscriptionFilter: (filter: Record<string, unknown>) => SubscriptionFilter;
    /** Convert filter object to DynamoDB filter expression (for scans/queries) */
    toDynamoDBFilterExpression: (filter: Record<string, unknown>) => {
      expression: string;
      expressionNames: Record<string, string>;
      expressionValues: Record<string, unknown>;
    };
    /** Convert filter to DynamoDB condition expression (for conditional writes) */
    toDynamoDBConditionExpression: (condition: Record<string, unknown>) => {
      expression: string;
      expressionNames: Record<string, string>;
      expressionValues: Record<string, unknown>;
    };
  };

  http: {
    copyHeaders: (headers: Record<string, string>) => Record<string, string>;
    addResponseHeader: (key: string, value: string) => void;
    addResponseHeaders: (headers: Record<string, string>) => void;
  };

  xml: {
    toMap: (xml: string) => Record<string, unknown>;
    toJsonString: (xml: string) => string;
  };
}

// ============================================================================
// Runtime Module (for early return from pipeline)
// ============================================================================

export interface AppSyncRuntime {
  /**
   * Early return from a resolver or pipeline function.
   * When called in a pipeline function's request handler, skips remaining functions
   * and goes directly to the resolver's response handler.
   */
  earlyReturn: (data?: unknown) => never;
}

// ============================================================================
// Extensions Module (subscriptions, caching)
// ============================================================================

export interface SubscriptionFilter {
  [field: string]: {
    eq?: unknown;
    ne?: unknown;
    le?: unknown;
    lt?: unknown;
    ge?: unknown;
    gt?: unknown;
    contains?: unknown;
    notContains?: unknown;
    beginsWith?: unknown;
    in?: unknown[];
    between?: [unknown, unknown];
  };
}

export interface SubscriptionInvalidationConfig {
  subscriptionField: string;
  payload: Record<string, unknown>;
}

export interface AppSyncExtensions {
  /**
   * Set a filter for subscription events.
   * Only events matching the filter will be sent to the subscriber.
   */
  setSubscriptionFilter: (filter: SubscriptionFilter | SubscriptionFilter[]) => void;

  /**
   * Set a filter for subscription invalidation.
   * Subscriptions matching this filter will be invalidated when triggered.
   */
  setSubscriptionInvalidationFilter: (filter: SubscriptionFilter | SubscriptionFilter[]) => void;

  /**
   * Invalidate (close) subscriptions matching the given criteria.
   * Can be called up to 5 times per request.
   */
  invalidateSubscriptions: (config: SubscriptionInvalidationConfig) => void;

  /**
   * Evict an item from the AppSync server-side cache.
   * Only works in mutation resolvers.
   */
  evictFromApiCache: (typeName: string, fieldName: string, keys: Record<string, unknown>) => void;
}

export interface ResolverContext<TArgs = Record<string, unknown>> {
  arguments: TArgs;
  stash: Record<string, unknown>;
  prev: {
    result?: unknown;
  };
  source?: unknown;
  identity?: AppSyncIdentity;
  request?: AppSyncRequest;
  info?: AppSyncInfo;
  error?: AppSyncError;
  util: AppSyncUtils;
  runtime: AppSyncRuntime;
  extensions: AppSyncExtensions;
  env: Record<string, string | undefined>;
}

// ============================================================================
// Data Source Request/Response Types
// ============================================================================

// DynamoDB
export type DynamoOperation =
  | 'GetItem'
  | 'PutItem'
  | 'UpdateItem'
  | 'DeleteItem'
  | 'Query'
  | 'Scan'
  | 'BatchGetItem'
  | 'BatchPutItem'
  | 'BatchDeleteItem'
  | 'TransactGetItems'
  | 'TransactWriteItems'
  | 'Sync';

export interface DynamoRequest {
  operation: DynamoOperation;
  params: Record<string, unknown>;
}

// Lambda
export interface LambdaRequest {
  operation: 'Invoke';
  payload: unknown;
}

// HTTP
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface HTTPRequest {
  method: HTTPMethod;
  resourcePath: string;
  params?: {
    query?: Record<string, string | string[]>;
    headers?: Record<string, string>;
    body?: unknown;
  };
}

export interface HTTPResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: unknown;
}

// RDS
export type RDSOperation =
  | 'executeStatement'
  | 'batchExecuteStatement'
  | 'beginTransaction'
  | 'commitTransaction'
  | 'rollbackTransaction';

export interface RDSRequest {
  operation: RDSOperation;
  sql?: string;
  statements?: Array<{
    sql: string;
    variableMap?: Record<string, unknown>;
  }>;
  variableMap?: Record<string, unknown>;
  transactionId?: string;
}

export interface RDSResponse {
  records?: unknown[][];
  columnMetadata?: Array<{
    name: string;
    type: string;
  }>;
  numberOfRecordsUpdated?: number;
  generatedFields?: unknown[];
  transactionId?: string;
}

// ============================================================================
// Resolver Module Types
// ============================================================================

export interface ResolverModule {
  request: (ctx: ResolverContext) => Promise<unknown> | unknown;
  response: (ctx: ResolverContext) => Promise<unknown> | unknown;
}

export interface LambdaModule {
  handler?: (ctx: ResolverContext) => Promise<unknown> | unknown;
  default?: (ctx: ResolverContext) => Promise<unknown> | unknown;
}

// ============================================================================
// Resolver Map Types
// ============================================================================

/** GraphQL resolver context from Apollo */
export interface GraphQLContext {
  headers?: Record<string, string>;
}

/** GraphQL info object from Apollo */
export interface GraphQLInfoType {
  fieldName: string;
  parentType: { name: string };
  variableValues?: Record<string, unknown>;
}

export type GraphQLResolverFn = (
  parent: unknown,
  args: Record<string, unknown>,
  context: GraphQLContext,
  info: GraphQLInfoType
) => Promise<unknown>;

// Resolver map supports Query, Mutation, Subscription, and custom type field resolvers
export type ResolverMap = Record<string, Record<string, GraphQLResolverFn>>;

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export interface SchemaValidationResult {
  isValid: boolean;
  schema?: unknown;
  schemaContent?: string;
  errors: string[];
}

// Schema fields map - includes Query, Mutation, Subscription, and custom types
export type SchemaFields = Record<string, Set<string>>;

// ============================================================================
// AppSync Restrictions
// ============================================================================

export interface AppSyncRestrictions {
  disallowedGlobals: string[];
  disallowedOperators: string[];
  disallowedStatements: string[];
  disallowedFunctionFeatures: string[];
  allowedGlobals: string[];
  disallowedMethods: Record<string, string[]>;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DocClient = DynamoDBDocumentClient;

// Re-export for convenience
export type { DynamoDBDocumentClient };
