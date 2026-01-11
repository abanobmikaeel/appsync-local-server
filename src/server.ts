import path from 'path';

import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { loadTypedefsSync } from '@graphql-tools/load';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { GraphQLError } from 'graphql';

import { type AuthContext, authenticateRequest } from './auth/index.js';
import { buildResolverMap } from './resolverHandlers/index.js';
import type { ServerConfig } from './types/index.js';

export interface StartServerOptions extends ServerConfig {}

/** Extended context with auth info */
export interface AppSyncLocalContext {
  headers: Record<string, string>;
  auth: AuthContext;
}

export async function startServer({
  port,
  schema,
  apiConfig,
  resolvers,
  dataSources,
}: StartServerOptions): Promise<void> {
  // Load GraphQL schema
  const [{ document: typeDefs }] = loadTypedefsSync(path.resolve(process.cwd(), schema), {
    loaders: [new GraphQLFileLoader()],
  });

  if (!typeDefs) {
    throw new Error(`Failed to load GraphQL schema from: ${schema}`);
  }

  // Build resolver map
  const map = await buildResolverMap(resolvers, dataSources);

  // Setup Apollo Server v5
  const server = new ApolloServer({
    // biome-ignore lint/suspicious/noExplicitAny: Apollo resolver types don't match exactly
    schema: makeExecutableSchema({ typeDefs, resolvers: map as any }),
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port },
    context: async ({ req }): Promise<AppSyncLocalContext> => {
      // Authenticate the request
      const auth = await authenticateRequest(
        req.headers,
        apiConfig.auth,
        undefined, // query string not available in standalone server context
        undefined, // operationName
        undefined // variables
      );

      // If not authorized, throw an error
      if (!auth.isAuthorized) {
        throw new GraphQLError('Unauthorized', {
          extensions: {
            code: 'UNAUTHORIZED',
            authType: auth.authType,
          },
        });
      }

      // Convert headers to Record<string, string>
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') {
          headers[key] = value;
        } else if (Array.isArray(value)) {
          headers[key] = value[0];
        }
      }

      return {
        headers,
        auth,
      };
    },
  });

  console.log(`Server ready at ${url}`);
}
