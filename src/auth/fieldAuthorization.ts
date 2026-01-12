import type { AppSyncIdentity, AuthConfig } from '../types/index.js';
import {
  type AppSyncAuthMode,
  authConfigToAuthMode,
  getFieldAuthRequirements,
  getFieldReturnType,
  getTypeAuthRequirements,
  isFieldAuthorized,
  isScalarOrBuiltinType,
  type SchemaDirectives,
} from './directiveParser.js';
import type { AuthContext } from './index.js';

// ============================================================================
// Types
// ============================================================================

export interface FieldAuthorizationResult {
  /** Whether access to the field is authorized */
  isAuthorized: boolean;
  /** Error message if not authorized */
  error?: string;
  /** The auth modes that would have been allowed */
  allowedModes?: AppSyncAuthMode[];
}

export interface FieldAuthorizationContext {
  /** The auth context from request authentication */
  authContext: AuthContext;
  /** The user's identity (may contain Cognito groups) */
  identity?: AppSyncIdentity;
  /** Parsed schema directives */
  schemaDirectives: SchemaDirectives;
}

// ============================================================================
// Field Authorization Helpers
// ============================================================================

/**
 * Check if the return type of a field allows access
 * AWS AppSync requires permission on both the field AND the return type
 */
function checkReturnTypeAuthorization(
  typeName: string,
  fieldName: string,
  authType: string,
  userGroups: string[] | undefined,
  schemaDirectives: SchemaDirectives
): FieldAuthorizationResult | null {
  const returnTypeName = getFieldReturnType(typeName, fieldName, schemaDirectives);

  // No return type info or scalar type - no check needed
  if (!returnTypeName || isScalarOrBuiltinType(returnTypeName)) {
    return null;
  }

  const returnTypeRequirements = getTypeAuthRequirements(returnTypeName, schemaDirectives);

  // No auth requirements on return type - allow access
  if (returnTypeRequirements.allowedModes.length === 0) {
    return null;
  }

  // Check if auth mode is allowed for this return type
  const returnTypeAuthorized = isFieldAuthorized(authType, returnTypeRequirements, userGroups);
  if (returnTypeAuthorized) {
    return null;
  }

  // Not authorized - return error
  const allowedModeNames = returnTypeRequirements.allowedModes.map((m) => m.authMode);
  const source = returnTypeRequirements.hasExplicitDirectives ? 'directive' : 'API default';
  return {
    isAuthorized: false,
    error:
      `Not authorized to access return type '${returnTypeName}' of field ${typeName}.${fieldName}. ` +
      `Type requires ${source} auth mode(s): [${allowedModeNames.join(', ')}], ` +
      `but request uses '${authType}'`,
    allowedModes: allowedModeNames,
  };
}

// ============================================================================
// Field Authorization
// ============================================================================

/**
 * Check if a request is authorized to access a specific field
 *
 * This implements AWS AppSync's field-level authorization model:
 * 1. Check Lambda authorizer's deniedFields first (dynamic per-request denial)
 * 2. Field-level directives take precedence over type-level
 * 3. Type-level directives apply to all fields without explicit directives
 * 4. Default auth mode applies if no directives are present
 * 5. Multiple directives mean any matching mode grants access
 * 6. **Cascading check**: Return type must also allow the auth mode
 *
 * @param typeName - The GraphQL type name (e.g., "Query", "User")
 * @param fieldName - The field name being accessed
 * @param context - The authorization context
 * @returns Authorization result
 */
export function authorizeField(
  typeName: string,
  fieldName: string,
  context: FieldAuthorizationContext
): FieldAuthorizationResult {
  const { authContext, identity, schemaDirectives } = context;
  const fieldKey = `${typeName}.${fieldName}`;

  // First, check if Lambda authorizer explicitly denied this field
  if (authContext.deniedFields?.includes(fieldKey)) {
    return {
      isAuthorized: false,
      error: `Field ${fieldKey} was denied by Lambda authorizer`,
    };
  }

  // Get user's Cognito groups from identity
  const userGroups = identity?.groups ?? extractGroupsFromClaims(identity?.claims);

  // Check field-level authorization
  const requirements = getFieldAuthRequirements(typeName, fieldName, schemaDirectives);
  if (requirements.allowedModes.length > 0) {
    const authorized = isFieldAuthorized(authContext.authType, requirements, userGroups);
    if (!authorized) {
      const allowedModeNames = requirements.allowedModes.map((m) => m.authMode);
      return {
        isAuthorized: false,
        error:
          `Not authorized to access ${typeName}.${fieldName}. ` +
          `Request auth type '${authContext.authType}' is not in allowed modes: [${allowedModeNames.join(', ')}]`,
        allowedModes: allowedModeNames,
      };
    }
  }

  // Cascading check: Verify the return type also allows access
  const returnTypeResult = checkReturnTypeAuthorization(
    typeName,
    fieldName,
    authContext.authType,
    userGroups,
    schemaDirectives
  );
  if (returnTypeResult) {
    return returnTypeResult;
  }

  return { isAuthorized: true };
}

/**
 * Extract Cognito groups from JWT claims
 * Cognito puts groups in 'cognito:groups' claim
 */
function extractGroupsFromClaims(claims?: Record<string, unknown>): string[] | undefined {
  if (!claims) return undefined;

  const groups = claims['cognito:groups'];
  if (Array.isArray(groups)) {
    return groups.filter((g): g is string => typeof g === 'string');
  }

  return undefined;
}

/**
 * Create a field authorization context from auth config and request auth
 */
export function createFieldAuthContext(
  authContext: AuthContext,
  identity: AppSyncIdentity | undefined,
  schemaDirectives: SchemaDirectives
): FieldAuthorizationContext {
  return {
    authContext,
    identity,
    schemaDirectives,
  };
}

/**
 * Get the default auth mode from API config
 * The first auth config is considered the default/primary
 */
export function getDefaultAuthMode(authConfigs: AuthConfig[]): AppSyncAuthMode | undefined {
  if (authConfigs.length === 0) return undefined;
  return authConfigToAuthMode(authConfigs[0].type) ?? undefined;
}

// ============================================================================
// Batch Authorization (for efficiency)
// ============================================================================

/**
 * Pre-check authorization for multiple fields at once
 * Useful for validating an entire query before execution
 *
 * @param fields - Array of {typeName, fieldName} to check
 * @param context - The authorization context
 * @returns Map of "TypeName.fieldName" -> authorization result
 */
export function authorizeFields(
  fields: Array<{ typeName: string; fieldName: string }>,
  context: FieldAuthorizationContext
): Map<string, FieldAuthorizationResult> {
  const results = new Map<string, FieldAuthorizationResult>();

  for (const { typeName, fieldName } of fields) {
    const key = `${typeName}.${fieldName}`;
    results.set(key, authorizeField(typeName, fieldName, context));
  }

  return results;
}

/**
 * Check if all fields in a list are authorized
 * Returns the first unauthorized field if any
 */
export function authorizeAllFields(
  fields: Array<{ typeName: string; fieldName: string }>,
  context: FieldAuthorizationContext
): { authorized: true } | { authorized: false; field: string; error: string } {
  for (const { typeName, fieldName } of fields) {
    const result = authorizeField(typeName, fieldName, context);
    if (!result.isAuthorized) {
      return {
        authorized: false,
        field: `${typeName}.${fieldName}`,
        error: result.error ?? 'Not authorized',
      };
    }
  }

  return { authorized: true };
}
