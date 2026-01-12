import { GraphQLError } from 'graphql';
import type { SchemaDirectives } from '../auth/directiveParser.js';
import { authorizeField, createFieldAuthContext } from '../auth/fieldAuthorization.js';
import type { AppSyncLocalContext } from '../server.js';
import type { DataSource, GraphQLResolverFn, Resolver, ResolverMap } from '../types/index.js';
import { createPipelineResolver } from './pipeline.js';
import { createUnitResolver } from './unit.js';

/**
 * Build resolver map - supports Query, Mutation, Subscription and custom type field resolvers
 * Wraps each resolver with field-level authorization based on schema directives
 */
export async function buildResolverMap(
  resolvers: Resolver[],
  dataSources: DataSource[],
  schemaDirectives?: SchemaDirectives
): Promise<ResolverMap> {
  const map: ResolverMap = {};

  for (const r of resolvers) {
    const { type, field, kind } = r;

    // Initialize type if not exists (e.g., Query, Mutation, Task, User, etc.)
    if (!map[type]) {
      map[type] = {};
    }

    // Create the base resolver
    const baseResolver =
      kind === 'Unit' ? await createUnitResolver(r, dataSources) : await createPipelineResolver(r, dataSources);

    // Wrap with authorization if directives are available
    map[type][field] = schemaDirectives
      ? wrapWithAuthorization(baseResolver, type, field, schemaDirectives)
      : baseResolver;
  }

  return map;
}

/**
 * Wrap a resolver with field-level authorization
 * Checks if the request is authorized to access the field before executing the resolver
 */
function wrapWithAuthorization(
  resolver: GraphQLResolverFn,
  typeName: string,
  fieldName: string,
  schemaDirectives: SchemaDirectives
): GraphQLResolverFn {
  return async (parent, args, context, info) => {
    // Get auth context from Apollo context (set by server.ts)
    const appSyncContext = context as unknown as AppSyncLocalContext;

    // If we have auth context, check field authorization
    if (appSyncContext?.auth && appSyncContext?.schemaDirectives) {
      const authContext = createFieldAuthContext(appSyncContext.auth, appSyncContext.identity, schemaDirectives);

      const authResult = authorizeField(typeName, fieldName, authContext);

      if (!authResult.isAuthorized) {
        throw new GraphQLError(authResult.error ?? `Not Authorized to access ${fieldName} on type ${typeName}`, {
          extensions: {
            code: 'UNAUTHORIZED',
            errorType: 'Unauthorized',
            field: `${typeName}.${fieldName}`,
            allowedModes: authResult.allowedModes,
          },
        });
      }
    }

    // Execute the actual resolver
    return resolver(parent, args, context, info);
  };
}

export { createPipelineResolver } from './pipeline.js';
// Re-export for direct use
export { createUnitResolver } from './unit.js';
