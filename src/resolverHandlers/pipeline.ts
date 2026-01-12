import { createContext, extractIdentityFromHeaders, isEarlyReturn, resetExtensionsState } from '../context.js';
import { executeDataSource } from '../datasourceHandlers/index.js';
import { loadResolverModule } from '../imports.js';
import { checkPipelineFunctionCount, checkResolverCodeSize, checkResponseSize, withTimeout } from '../limits.js';
import type {
  DataSource,
  GraphQLContext,
  GraphQLInfoType,
  GraphQLResolverFn,
  PipelineResolver,
  ResolverContext,
  ResolverModule,
} from '../types/index.js';

/** Create pipeline resolver with full AppSync context support */
export async function createPipelineResolver(
  resolver: PipelineResolver,
  dataSources: DataSource[]
): Promise<GraphQLResolverFn> {
  const fieldName = `${resolver.type}.${resolver.field}`;

  // Check pipeline function count at creation time
  checkPipelineFunctionCount(resolver.pipelineFunctions.length, fieldName);

  // Check main resolver code size
  checkResolverCodeSize(resolver.file);

  // Check each pipeline function code size
  for (const fn of resolver.pipelineFunctions) {
    checkResolverCodeSize(fn.file);
  }

  return async (
    parent: unknown,
    args: Record<string, unknown>,
    context: GraphQLContext,
    info: GraphQLInfoType
  ): Promise<unknown> => {
    const resolverFieldName = `${info.parentType.name}.${info.fieldName}`;

    // Wrap the entire pipeline execution in a timeout
    return withTimeout(
      executePipeline(resolver, dataSources, parent, args, context, info),
      undefined, // Use default 30s timeout
      `Pipeline resolver ${resolverFieldName}`
    );
  };
}

/** Internal pipeline execution logic */
async function executePipeline(
  resolver: PipelineResolver,
  dataSources: DataSource[],
  parent: unknown,
  args: Record<string, unknown>,
  context: GraphQLContext,
  info: GraphQLInfoType
): Promise<unknown> {
  // Reset extensions state for this request
  resetExtensionsState();

  // Extract headers and identity
  const headers = context?.headers ?? {};
  const identity = extractIdentityFromHeaders(headers);

  // Create shared context for the entire pipeline
  const ctx: ResolverContext = createContext({
    arguments: args,
    source: parent, // Parent resolver result
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

  // Load main resolver module
  const mainMod = await loadResolverModule<ResolverModule>(resolver.file);

  try {
    // Execute the main resolver's request (before pipeline)
    await mainMod.request(ctx);

    // Execute each pipeline function in sequence
    let lastResult: unknown;
    for (const fn of resolver.pipelineFunctions) {
      const mod = await loadResolverModule<ResolverModule>(fn.file);

      // Execute function's request handler
      const req = await mod.request(ctx);

      // Execute data source
      const dsResult = await executeDataSource(fn.dataSource, dataSources, req);

      // Update context with result for response handler
      ctx.prev = { result: dsResult };

      // Execute function's response handler
      lastResult = await mod.response(ctx);

      // Update prev.result for next function in pipeline
      ctx.prev = { result: lastResult };
    }
  } catch (error) {
    // Handle runtime.earlyReturn() - skip to response handler
    if (isEarlyReturn(error)) {
      ctx.prev = { result: error.data };
    } else {
      throw error;
    }
  }

  // Execute main resolver's response (after pipeline)
  const result = await mainMod.response(ctx);

  // Check response size
  checkResponseSize(result, `${info.parentType.name}.${info.fieldName}`);

  return result;
}
