import path from 'path';
import {
  cleanupGlobals,
  createContext,
  extractIdentityFromHeaders,
  injectGlobals,
  isEarlyReturn,
  resetExtensionsState,
} from '../context.js';
import { executeDataSource } from '../datasourceHandlers/index.js';
import { loadResolverModule } from '../imports.js';
import { checkResolverCodeSize, checkResponseSize, withTimeout } from '../limits.js';
import type {
  DataSource,
  GraphQLContext,
  GraphQLInfoType,
  GraphQLResolverFn,
  ResolverModule,
  UnitResolver,
} from '../types/index.js';

/** Create unit resolver with full AppSync context support */
export async function createUnitResolver(
  resolver: UnitResolver,
  dataSources: DataSource[],
  baseDir?: string
): Promise<GraphQLResolverFn> {
  // Resolve file path relative to baseDir (if provided) or CWD
  const resolverFile =
    baseDir && !path.isAbsolute(resolver.file) ? path.resolve(baseDir, resolver.file) : resolver.file;

  // Check resolver code size at creation time
  checkResolverCodeSize(resolverFile);

  return async (
    parent: unknown,
    args: Record<string, unknown>,
    context: GraphQLContext,
    info: GraphQLInfoType
  ): Promise<unknown> => {
    const fieldName = `${info.parentType.name}.${info.fieldName}`;

    // Wrap the entire resolver execution in a timeout
    return withTimeout(
      executeResolver(resolver, dataSources, parent, args, context, info, resolverFile),
      undefined, // Use default 30s timeout
      `Resolver ${fieldName}`
    );
  };
}

/** Internal resolver execution logic */
async function executeResolver(
  resolver: UnitResolver,
  dataSources: DataSource[],
  parent: unknown,
  args: Record<string, unknown>,
  context: GraphQLContext,
  info: GraphQLInfoType,
  resolverFile: string
): Promise<unknown> {
  // Reset extensions state for this request
  resetExtensionsState();

  const mod = await loadResolverModule<ResolverModule>(resolverFile);

  // Extract headers and identity (use context.identity if already set by server)
  const headers = context?.headers ?? {};
  const identity = context?.identity ?? extractIdentityFromHeaders(headers);

  // Create full AppSync-compatible context
  const ctx = createContext({
    arguments: args,
    source: parent, // Parent resolver result (for nested field resolvers)
    identity,
    request: {
      headers,
      domainName: headers.host,
    },
    info: {
      fieldName: info.fieldName,
      parentTypeName: info.parentType.name,
      variables: info.variableValues,
    },
  });

  // Inject globals (util, runtime, extensions) for AWS AppSync compatibility
  injectGlobals(ctx);

  try {
    // Execute request handler
    const req = await mod.request(ctx);

    // Execute data source
    const dsResult = await executeDataSource(resolver.dataSource, dataSources, req);

    // Update context with result
    ctx.prev = { result: dsResult };
  } catch (error) {
    // Handle runtime.earlyReturn() - skip to response handler
    if (isEarlyReturn(error)) {
      ctx.prev = { result: error.data };
    } else {
      cleanupGlobals();
      throw error;
    }
  }

  // Execute response handler
  const result = await mod.response(ctx);

  // Clean up globals
  cleanupGlobals();

  // Check response size
  checkResponseSize(result, `${info.parentType.name}.${info.fieldName}`);

  return result;
}
