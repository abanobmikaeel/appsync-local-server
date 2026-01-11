import { createContext, extractIdentityFromHeaders } from '../context.js';
import { executeDataSource } from '../datasourceHandlers/index.js';
import { loadResolverModule } from '../imports.js';
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
  dataSources: DataSource[]
): Promise<GraphQLResolverFn> {
  return async (
    parent: unknown,
    args: Record<string, unknown>,
    context: GraphQLContext,
    info: GraphQLInfoType
  ): Promise<unknown> => {
    const mod = await loadResolverModule<ResolverModule>(resolver.file);

    // Extract headers and identity
    const headers = context?.headers ?? {};
    const identity = extractIdentityFromHeaders(headers);

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

    // Execute request handler
    const req = await mod.request(ctx);

    // Execute data source
    const dsResult = await executeDataSource(resolver.dataSource, dataSources, req);

    // Update context with result
    ctx.prev = { result: dsResult };

    // Execute response handler
    return mod.response(ctx);
  };
}
