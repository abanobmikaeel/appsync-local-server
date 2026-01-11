import { createContext, extractIdentityFromHeaders } from '../context.js';
import { executeDataSource } from '../datasourceHandlers/index.js';
import { loadResolverModule } from '../imports.js';
import type {
  DataSource,
  GraphQLContext,
  GraphQLInfoType,
  GraphQLResolverFn,
  PipelineResolver,
  ResolverModule,
} from '../types/index.js';

/** Create pipeline resolver with full AppSync context support */
export async function createPipelineResolver(
  resolver: PipelineResolver,
  dataSources: DataSource[]
): Promise<GraphQLResolverFn> {
  return async (
    parent: unknown,
    args: Record<string, unknown>,
    context: GraphQLContext,
    info: GraphQLInfoType
  ): Promise<unknown> => {
    // Extract headers and identity
    const headers = context?.headers ?? {};
    const identity = extractIdentityFromHeaders(headers);

    // Create shared context for the entire pipeline
    const ctx = createContext({
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

    // Load and execute the main resolver's request (before pipeline)
    const mainMod = await loadResolverModule<ResolverModule>(resolver.file);
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

    // Execute main resolver's response (after pipeline)
    return mainMod.response(ctx);
  };
}
