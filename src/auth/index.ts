import type { IncomingHttpHeaders } from 'http';
import { loadResolverModule } from '../imports.js';
import type { AuthConfig } from '../types/index.js';
import { extractBearerToken, type JwtClaims, validateCognitoToken, validateOidcToken } from './jwtValidator.js';

// Re-export schema directive parser and field authorization
export { type AppSyncAuthMode, parseSchemaDirectives, type SchemaDirectives } from './directiveParser.js';
export {
  authorizeAllFields,
  authorizeField,
  authorizeFields,
  createFieldAuthContext,
  type FieldAuthorizationContext,
  type FieldAuthorizationResult,
  getDefaultAuthMode,
} from './fieldAuthorization.js';
// Re-export JWT validation utilities
export { type JwtClaims, type JwtValidationResult, parseJwt, validateJwt } from './jwtValidator.js';
export {
  formatSchemaAuthWarnings,
  type SchemaAuthWarning,
  validateSchemaAuth,
} from './schemaValidator.js';

export interface AuthResult {
  isAuthorized: boolean;
  deniedFields?: string[];
  resolverContext?: Record<string, unknown>;
  error?: string;
}

export interface AuthContext {
  authType: string;
  isAuthorized: boolean;
  resolverContext?: Record<string, unknown>;
  /** Fields denied by Lambda authorizer (e.g., ["Query.sensitiveData", "Mutation.deleteUser"]) */
  deniedFields?: string[];
  /** JWT claims from Cognito or OIDC token */
  jwtClaims?: JwtClaims;
  /** Mock identity from config (for AWS_LAMBDA auth in local dev mode) */
  mockIdentity?: {
    sub?: string;
    username?: string;
    groups?: string[];
    [key: string]: unknown;
  };
}

interface LambdaAuthModule {
  handler?: (event: LambdaAuthEvent) => Promise<LambdaAuthResponse> | LambdaAuthResponse;
  default?: (event: LambdaAuthEvent) => Promise<LambdaAuthResponse> | LambdaAuthResponse;
}

interface LambdaAuthEvent {
  authorizationToken: string;
  requestContext: {
    apiId: string;
    accountId: string;
    requestId: string;
    queryString: string;
    operationName?: string;
    variables?: Record<string, unknown>;
  };
}

interface LambdaAuthResponse {
  isAuthorized: boolean;
  deniedFields?: string[];
  resolverContext?: Record<string, unknown>;
  ttlOverride?: number;
}

/**
 * Validate an API key against configured auth settings
 */
export function validateApiKey(apiKey: string | undefined, authConfigs: AuthConfig[]): AuthResult {
  const apiKeyConfig = authConfigs.find((auth) => auth.type === 'API_KEY');

  if (!apiKeyConfig) {
    // No API key auth configured
    return { isAuthorized: true };
  }

  if (!apiKey) {
    return {
      isAuthorized: false,
      error: 'Missing API key. Include x-api-key header in your request.',
    };
  }

  if (apiKey !== apiKeyConfig.key) {
    return {
      isAuthorized: false,
      error: 'Invalid API key',
    };
  }

  // Check expiration if configured
  if (apiKeyConfig.expiration) {
    const now = Date.now();
    if (now > apiKeyConfig.expiration) {
      return {
        isAuthorized: false,
        error: 'API key has expired',
      };
    }
  }

  return { isAuthorized: true };
}

/**
 * Execute a Lambda authorizer function
 */
export async function executeLambdaAuthorizer(
  authorizationToken: string,
  lambdaFile: string,
  requestContext: LambdaAuthEvent['requestContext']
): Promise<AuthResult> {
  try {
    const mod = await loadResolverModule<LambdaAuthModule>(lambdaFile);
    const handler = mod.handler ?? mod.default;

    if (!handler) {
      return {
        isAuthorized: false,
        error: 'Lambda authorizer has no handler function',
      };
    }

    const event: LambdaAuthEvent = {
      authorizationToken,
      requestContext,
    };

    const response = await handler(event);

    return {
      isAuthorized: response.isAuthorized,
      deniedFields: response.deniedFields,
      resolverContext: response.resolverContext,
    };
  } catch (error) {
    return {
      isAuthorized: false,
      error: `Lambda authorizer error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/** Normalize HTTP headers to lowercase keys */
function normalizeHeaders(headers: IncomingHttpHeaders): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      normalized[key.toLowerCase()] = value;
    } else if (Array.isArray(value)) {
      normalized[key.toLowerCase()] = value[0];
    }
  }
  return normalized;
}

/** Try API Key authentication */
function tryApiKeyAuth(headers: Record<string, string>, authConfigs: AuthConfig[]): AuthContext | null {
  const apiKey = headers['x-api-key'];
  const result = validateApiKey(apiKey, authConfigs);
  if (result.isAuthorized) {
    return { authType: 'API_KEY', isAuthorized: true };
  }
  return null;
}

/** Try Lambda authorizer authentication */
async function tryLambdaAuth(
  headers: Record<string, string>,
  authConfig: AuthConfig,
  queryString?: string,
  operationName?: string,
  variables?: Record<string, unknown>
): Promise<AuthContext | null> {
  // If lambdaFunction is specified, execute it
  if (authConfig.lambdaFunction) {
    const authToken = headers.authorization || '';
    const result = await executeLambdaAuthorizer(authToken, authConfig.lambdaFunction, {
      apiId: 'local-api',
      accountId: 'local-account',
      requestId: `req-${Date.now()}`,
      queryString: queryString || '',
      operationName,
      variables,
    });

    if (result.isAuthorized) {
      return {
        authType: 'AWS_LAMBDA',
        isAuthorized: true,
        resolverContext: result.resolverContext,
        deniedFields: result.deniedFields,
      };
    }
    return null;
  }

  // For local dev: if identity or resolverContext is provided in config, use as mock
  // This allows testing without an actual Lambda authorizer
  if (authConfig.identity || authConfig.resolverContext) {
    return {
      authType: 'AWS_LAMBDA',
      isAuthorized: true,
      resolverContext: authConfig.resolverContext,
      mockIdentity: authConfig.identity,
    };
  }

  // AWS_LAMBDA configured but no lambdaFunction, identity, or resolverContext
  // For local development, allow through with a warning
  console.warn(
    '[auth] AWS_LAMBDA auth configured without lambdaFunction or mock identity. ' +
      'For local development, add "identity" or "resolverContext" to your auth config, ' +
      'or specify "lambdaFunction" to point to a local authorizer file.'
  );
  return null;
}

/** Try JWT-based authentication (Cognito/OIDC) */
function tryJwtAuth(headers: Record<string, string>, authType: string, authConfig?: AuthConfig): AuthContext | null {
  const token = extractBearerToken(headers.authorization);
  if (!token) {
    return null;
  }

  // Validate the JWT based on auth type
  const validationResult =
    authType === 'AMAZON_COGNITO_USER_POOLS'
      ? validateCognitoToken(token, authConfig?.userPoolId)
      : validateOidcToken(token, authConfig?.issuer, authConfig?.clientId);

  if (!validationResult.isValid) {
    // For local development, log the warning but still allow if token structure is valid
    if (validationResult.claims) {
      console.warn(`[auth] JWT validation warning: ${validationResult.error}`);
      // Still authorize if we could parse claims (e.g., expired token in dev)
      return {
        authType,
        isAuthorized: true,
        jwtClaims: validationResult.claims,
      };
    }
    // Invalid structure - reject
    console.warn(`[auth] JWT validation failed: ${validationResult.error}`);
    return null;
  }

  return {
    authType,
    isAuthorized: true,
    jwtClaims: validationResult.claims,
  };
}

/** Try IAM authentication */
function tryIamAuth(headers: Record<string, string>): AuthContext | null {
  const hasIamAuth =
    headers['x-amz-security-token'] || headers['x-amz-date'] || headers.authorization?.includes('AWS4-HMAC-SHA256');
  if (hasIamAuth) {
    return { authType: 'AWS_IAM', isAuthorized: true };
  }
  return null;
}

/**
 * Authenticate a request using configured auth methods
 * Tries each auth method in order until one succeeds
 */
export async function authenticateRequest(
  headers: IncomingHttpHeaders,
  authConfigs: AuthConfig[],
  queryString?: string,
  operationName?: string,
  variables?: Record<string, unknown>
): Promise<AuthContext> {
  const normalizedHeaders = normalizeHeaders(headers);

  for (const authConfig of authConfigs) {
    let result: AuthContext | null = null;

    switch (authConfig.type) {
      case 'API_KEY':
        result = tryApiKeyAuth(normalizedHeaders, authConfigs);
        break;
      case 'AWS_LAMBDA':
        result = await tryLambdaAuth(normalizedHeaders, authConfig, queryString, operationName, variables);
        break;
      case 'AMAZON_COGNITO_USER_POOLS':
      case 'OPENID_CONNECT':
        result = tryJwtAuth(normalizedHeaders, authConfig.type, authConfig);
        break;
      case 'AWS_IAM':
        result = tryIamAuth(normalizedHeaders);
        break;
    }

    if (result) return result;
  }

  // If no auth configured, allow through
  if (authConfigs.length === 0) {
    return { authType: 'NONE', isAuthorized: true };
  }

  // Default: not authorized
  return { authType: 'NONE', isAuthorized: false };
}
