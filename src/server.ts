import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { loadTypedefsSync } from '@graphql-tools/load';
import { makeExecutableSchema } from '@graphql-tools/schema';
import fs from 'fs';
import { GraphQLError } from 'graphql';
import path from 'path';
import { parseSchemaDirectives, type SchemaDirectives } from './auth/directiveParser.js';
import { getDefaultAuthMode } from './auth/fieldAuthorization.js';
import { type AuthContext, authenticateRequest } from './auth/index.js';
import { formatSchemaAuthWarnings, validateSchemaAuth } from './auth/schemaValidator.js';
import { buildResolverMap } from './resolverHandlers/index.js';
import type { AppSyncIdentity, ServerConfig } from './types/index.js';

export interface StartServerOptions extends ServerConfig {
  /** Path to the config file (for resolving relative paths) */
  configPath?: string;
}

/** Extended context with auth info and identity */
export interface AppSyncLocalContext {
  headers: Record<string, string>;
  auth: AuthContext;
  identity?: AppSyncIdentity;
  schemaDirectives: SchemaDirectives;
}

export async function startServer({
  port,
  schema,
  apiConfig,
  resolvers,
  dataSources,
  configPath,
}: StartServerOptions): Promise<void> {
  // Resolve paths relative to config file's directory (if provided) or CWD
  const baseDir = configPath ? path.dirname(path.resolve(configPath)) : process.cwd();

  // Load GraphQL schema
  const schemaPath = path.isAbsolute(schema) ? schema : path.resolve(baseDir, schema);
  const [{ document: typeDefs }] = loadTypedefsSync(schemaPath, {
    loaders: [new GraphQLFileLoader()],
  });

  if (!typeDefs) {
    throw new Error(`Failed to load GraphQL schema from: ${schema}`);
  }

  // Read schema content and parse directives for field-level authorization
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  const defaultAuthMode = getDefaultAuthMode(apiConfig.auth);
  const schemaDirectives = parseSchemaDirectives(schemaContent, defaultAuthMode);

  // Log directive info if any are found
  const typeCount = schemaDirectives.typeDirectives.size;
  const fieldCount = schemaDirectives.fieldDirectives.size;
  if (typeCount > 0 || fieldCount > 0) {
    console.log(`Parsed schema directives: ${typeCount} type-level, ${fieldCount} field-level`);
  }

  // Validate schema for common auth misconfigurations
  const authWarnings = validateSchemaAuth(schemaDirectives, apiConfig.auth);
  if (authWarnings.length > 0) {
    console.warn(formatSchemaAuthWarnings(authWarnings));
  }

  // Build resolver map with directive info for field authorization
  const map = await buildResolverMap(resolvers, dataSources, schemaDirectives, baseDir);

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

      // Extract identity from headers (JWT claims, etc.)
      const identity = extractIdentityFromContext(headers, auth);

      return {
        headers,
        auth,
        identity,
        schemaDirectives,
      };
    },
  });

  console.log(`Server ready at ${url}`);
}

/**
 * Extract identity from request headers and auth context
 * Parses JWT tokens to extract claims, groups, etc.
 */
function extractIdentityFromContext(headers: Record<string, string>, auth: AuthContext): AppSyncIdentity | undefined {
  const identity: AppSyncIdentity = {
    sourceIp: [headers['x-forwarded-for'] ?? '127.0.0.1'],
    defaultAuthStrategy: auth.authType,
  };

  // Use mock identity from config (for AWS_LAMBDA local dev mode)
  if (auth.mockIdentity) {
    identity.sub = auth.mockIdentity.sub;
    identity.username = auth.mockIdentity.username;
    identity.groups = auth.mockIdentity.groups;
    identity.claims = auth.mockIdentity;
  }

  // Try to parse JWT from Authorization header
  const authHeader = headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      // Decode JWT payload (middle part, base64)
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));

        identity.sub = payload.sub;
        identity.issuer = payload.iss;
        identity.username = payload['cognito:username'] ?? payload.username ?? payload.preferred_username;
        identity.claims = payload;

        // Extract Cognito groups
        if (Array.isArray(payload['cognito:groups'])) {
          identity.groups = payload['cognito:groups'];
        }
      }
    } catch {
      // Invalid JWT, continue without claims
    }
  }

  // Include resolver context from Lambda authorizer if present
  // This is available as ctx.identity.resolverContext in resolvers
  if (auth.resolverContext) {
    identity.resolverContext = auth.resolverContext;
    identity.claims = { ...identity.claims, ...auth.resolverContext };
  }

  return identity;
}
