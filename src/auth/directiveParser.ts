import {
  type ArgumentNode,
  type DirectiveNode,
  type DocumentNode,
  type FieldDefinitionNode,
  Kind,
  type ObjectTypeDefinitionNode,
  parse,
  type TypeNode,
  type ValueNode,
  visit,
} from 'graphql';

// ============================================================================
// Types
// ============================================================================

/**
 * AWS AppSync authorization mode types that can be used in directives
 */
export type AppSyncAuthMode = 'API_KEY' | 'AWS_IAM' | 'AMAZON_COGNITO_USER_POOLS' | 'OPENID_CONNECT' | 'AWS_LAMBDA';

/**
 * Mapping from directive name to auth mode
 */
const DIRECTIVE_TO_AUTH_MODE: Record<string, AppSyncAuthMode> = {
  aws_api_key: 'API_KEY',
  aws_iam: 'AWS_IAM',
  aws_cognito_user_pools: 'AMAZON_COGNITO_USER_POOLS',
  aws_oidc: 'OPENID_CONNECT',
  aws_lambda: 'AWS_LAMBDA',
  // @aws_auth is a legacy directive for Cognito with groups
  aws_auth: 'AMAZON_COGNITO_USER_POOLS',
};

/**
 * Parsed authorization directive
 */
export interface AuthDirective {
  /** The auth mode this directive enables */
  authMode: AppSyncAuthMode;
  /** Original directive name (e.g., 'aws_cognito_user_pools') */
  directiveName: string;
  /** Cognito groups allowed (for @aws_auth or @aws_cognito_user_pools with groups) */
  cognitoGroups?: string[];
}

/**
 * Parsed subscription directive
 */
export interface SubscribeDirective {
  /** Mutations that trigger this subscription */
  mutations: string[];
}

/**
 * Authorization requirements for a field
 */
export interface FieldAuthRequirements {
  /** Allowed auth modes for this field */
  allowedModes: AuthDirective[];
  /** Whether this field has explicit directives (vs inherited from type) */
  hasExplicitDirectives: boolean;
}

/**
 * Complete parsed directive information from a schema
 */
export interface SchemaDirectives {
  /** Type-level auth directives: typeName -> directives */
  typeDirectives: Map<string, AuthDirective[]>;
  /** Field-level auth directives: "TypeName.fieldName" -> directives */
  fieldDirectives: Map<string, AuthDirective[]>;
  /** Subscription directives: "Subscription.fieldName" -> mutations */
  subscriptionDirectives: Map<string, SubscribeDirective>;
  /** Field return types: "TypeName.fieldName" -> return type name (unwrapped) */
  fieldReturnTypes: Map<string, string>;
  /** Default auth mode from API config */
  defaultAuthMode?: AppSyncAuthMode;
}

// ============================================================================
// Type Extraction Helpers
// ============================================================================

/**
 * Extract the base type name from a TypeNode, unwrapping NonNull and List wrappers
 * e.g., "User", "[User]!", "[User!]!" all return "User"
 */
function getBaseTypeName(typeNode: TypeNode): string {
  switch (typeNode.kind) {
    case Kind.NAMED_TYPE:
      return typeNode.name.value;
    case Kind.NON_NULL_TYPE:
      return getBaseTypeName(typeNode.type);
    case Kind.LIST_TYPE:
      return getBaseTypeName(typeNode.type);
    default:
      return 'Unknown';
  }
}

// ============================================================================
// Directive Value Extraction Helpers
// ============================================================================

/**
 * Extract a string value from an AST ValueNode
 */
function extractStringValue(value: ValueNode): string | null {
  if (value.kind === Kind.STRING) {
    return value.value;
  }
  return null;
}

/**
 * Extract an array of strings from an AST ValueNode (list)
 */
function extractStringArray(value: ValueNode): string[] {
  if (value.kind === Kind.LIST) {
    return value.values.map((v) => extractStringValue(v)).filter((v): v is string => v !== null);
  }
  return [];
}

/**
 * Get argument value from a directive
 */
function getDirectiveArgument(directive: DirectiveNode, argName: string): ValueNode | null {
  const arg = directive.arguments?.find((a: ArgumentNode) => a.name.value === argName);
  return arg?.value ?? null;
}

// ============================================================================
// Directive Parsing
// ============================================================================

/**
 * Parse an auth directive node into our AuthDirective type
 */
function parseAuthDirective(directive: DirectiveNode): AuthDirective | null {
  const directiveName = directive.name.value;
  const authMode = DIRECTIVE_TO_AUTH_MODE[directiveName];

  if (!authMode) {
    return null; // Not an auth directive
  }

  const result: AuthDirective = {
    authMode,
    directiveName,
  };

  // Check for cognito_groups argument (used by @aws_auth and @aws_cognito_user_pools)
  const groupsArg = getDirectiveArgument(directive, 'cognito_groups');
  if (groupsArg) {
    result.cognitoGroups = extractStringArray(groupsArg);
  }

  return result;
}

/**
 * Parse @aws_subscribe directive
 */
function parseSubscribeDirective(directive: DirectiveNode): SubscribeDirective | null {
  if (directive.name.value !== 'aws_subscribe') {
    return null;
  }

  const mutationsArg = getDirectiveArgument(directive, 'mutations');
  if (!mutationsArg) {
    return null;
  }

  return {
    mutations: extractStringArray(mutationsArg),
  };
}

/**
 * Extract all auth directives from a list of directive nodes
 */
function extractAuthDirectives(directives: readonly DirectiveNode[] | undefined): AuthDirective[] {
  if (!directives) return [];

  const authDirectives: AuthDirective[] = [];
  for (const directive of directives) {
    const parsed = parseAuthDirective(directive);
    if (parsed) {
      authDirectives.push(parsed);
    }
  }
  return authDirectives;
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse a GraphQL schema and extract all AWS AppSync directives
 *
 * This extracts:
 * - Auth directives (@aws_api_key, @aws_iam, @aws_cognito_user_pools, @aws_oidc, @aws_lambda, @aws_auth)
 * - Subscription directives (@aws_subscribe)
 *
 * @param schemaContent - The GraphQL schema as a string
 * @param defaultAuthMode - The default auth mode from API config
 * @returns Parsed directive information
 */
export function parseSchemaDirectives(schemaContent: string, defaultAuthMode?: AppSyncAuthMode): SchemaDirectives {
  const result: SchemaDirectives = {
    typeDirectives: new Map(),
    fieldDirectives: new Map(),
    subscriptionDirectives: new Map(),
    fieldReturnTypes: new Map(),
    defaultAuthMode,
  };

  let ast: DocumentNode;
  try {
    ast = parse(schemaContent);
  } catch {
    // If schema parsing fails, return empty directives
    // Schema validation will catch the actual error
    return result;
  }

  visit(ast, {
    ObjectTypeDefinition(node: ObjectTypeDefinitionNode) {
      const typeName = node.name.value;

      // Extract type-level auth directives
      const typeAuthDirectives = extractAuthDirectives(node.directives);
      if (typeAuthDirectives.length > 0) {
        result.typeDirectives.set(typeName, typeAuthDirectives);
      }

      // Process fields
      if (node.fields) {
        for (const field of node.fields) {
          processField(typeName, field, result);
        }
      }
    },
  });

  return result;
}

/**
 * Process a field definition and extract its directives
 */
function processField(typeName: string, field: FieldDefinitionNode, result: SchemaDirectives): void {
  const fieldName = field.name.value;
  const fieldKey = `${typeName}.${fieldName}`;

  // Extract and store the field's return type
  const returnTypeName = getBaseTypeName(field.type);
  result.fieldReturnTypes.set(fieldKey, returnTypeName);

  // Extract field-level auth directives
  const fieldAuthDirectives = extractAuthDirectives(field.directives);
  if (fieldAuthDirectives.length > 0) {
    result.fieldDirectives.set(fieldKey, fieldAuthDirectives);
  }

  // Check for @aws_subscribe on subscription fields
  if (typeName === 'Subscription' && field.directives) {
    for (const directive of field.directives) {
      const subscribeDirective = parseSubscribeDirective(directive);
      if (subscribeDirective) {
        result.subscriptionDirectives.set(fieldKey, subscribeDirective);
      }
    }
  }
}

// ============================================================================
// Authorization Check Functions
// ============================================================================

/**
 * Get the effective auth requirements for a field
 *
 * Resolution order:
 * 1. Field-level directives (if present)
 * 2. Type-level directives (if present)
 * 3. Default auth mode (if set)
 * 4. Allow all (if no auth configured)
 */
export function getFieldAuthRequirements(
  typeName: string,
  fieldName: string,
  directives: SchemaDirectives
): FieldAuthRequirements {
  const fieldKey = `${typeName}.${fieldName}`;

  // Check for field-level directives first
  const fieldDirectives = directives.fieldDirectives.get(fieldKey);
  if (fieldDirectives && fieldDirectives.length > 0) {
    return {
      allowedModes: fieldDirectives,
      hasExplicitDirectives: true,
    };
  }

  // Fall back to type-level directives
  const typeDirectives = directives.typeDirectives.get(typeName);
  if (typeDirectives && typeDirectives.length > 0) {
    return {
      allowedModes: typeDirectives,
      hasExplicitDirectives: false,
    };
  }

  // Fall back to default auth mode
  if (directives.defaultAuthMode) {
    return {
      allowedModes: [
        {
          authMode: directives.defaultAuthMode,
          directiveName: 'default',
        },
      ],
      hasExplicitDirectives: false,
    };
  }

  // No auth configured - allow all
  return {
    allowedModes: [],
    hasExplicitDirectives: false,
  };
}

/**
 * Check if user has any of the required Cognito groups
 */
function hasRequiredCognitoGroup(requiredGroups: string[], userGroups?: string[]): boolean {
  if (!userGroups || userGroups.length === 0) {
    return false;
  }
  return requiredGroups.some((group) => userGroups.includes(group));
}

/**
 * Check if a single auth directive allows the request
 */
function doesModeAllowAccess(
  allowedMode: AuthDirective,
  requestAuthMode: string,
  userCognitoGroups?: string[]
): boolean {
  // Auth mode must match
  if (allowedMode.authMode !== requestAuthMode) {
    return false;
  }

  // If Cognito groups are specified, check group membership
  if (allowedMode.cognitoGroups && allowedMode.cognitoGroups.length > 0) {
    return hasRequiredCognitoGroup(allowedMode.cognitoGroups, userCognitoGroups);
  }

  return true;
}

/**
 * Check if a request's auth mode is allowed for a field
 *
 * @param requestAuthMode - The auth mode of the incoming request
 * @param fieldRequirements - The auth requirements for the field
 * @param userCognitoGroups - The user's Cognito groups (if using Cognito auth)
 * @returns Whether the request is authorized
 */
export function isFieldAuthorized(
  requestAuthMode: string,
  fieldRequirements: FieldAuthRequirements,
  userCognitoGroups?: string[]
): boolean {
  // If no auth modes are specified, allow access
  if (fieldRequirements.allowedModes.length === 0) {
    return true;
  }

  // Check if any allowed mode matches the request
  return fieldRequirements.allowedModes.some((mode) => doesModeAllowAccess(mode, requestAuthMode, userCognitoGroups));
}

/**
 * Get subscription mutations that should trigger a subscription field
 */
export function getSubscriptionMutations(subscriptionFieldName: string, directives: SchemaDirectives): string[] | null {
  const fieldKey = `Subscription.${subscriptionFieldName}`;
  const subscribeDirective = directives.subscriptionDirectives.get(fieldKey);
  return subscribeDirective?.mutations ?? null;
}

/**
 * Map auth config type to AppSyncAuthMode
 */
export function authConfigToAuthMode(authType: string): AppSyncAuthMode | null {
  const mapping: Record<string, AppSyncAuthMode> = {
    API_KEY: 'API_KEY',
    AWS_IAM: 'AWS_IAM',
    AMAZON_COGNITO_USER_POOLS: 'AMAZON_COGNITO_USER_POOLS',
    OPENID_CONNECT: 'OPENID_CONNECT',
    AWS_LAMBDA: 'AWS_LAMBDA',
  };
  return mapping[authType] ?? null;
}

/**
 * Get the return type name for a field
 */
export function getFieldReturnType(typeName: string, fieldName: string, directives: SchemaDirectives): string | null {
  const fieldKey = `${typeName}.${fieldName}`;
  return directives.fieldReturnTypes.get(fieldKey) ?? null;
}

/**
 * Check if a type is a scalar or built-in type (no auth check needed on return type)
 */
export function isScalarOrBuiltinType(typeName: string): boolean {
  const scalarTypes = new Set([
    'String',
    'Int',
    'Float',
    'Boolean',
    'ID',
    'AWSDate',
    'AWSDateTime',
    'AWSTime',
    'AWSTimestamp',
    'AWSJSON',
    'AWSURL',
    'AWSEmail',
    'AWSPhone',
    'AWSIPAddress',
  ]);
  return scalarTypes.has(typeName);
}

/**
 * Get auth requirements for a return type (type-level directives)
 * Used for cascading authorization check
 */
export function getTypeAuthRequirements(typeName: string, directives: SchemaDirectives): FieldAuthRequirements {
  // Get type-level directives
  const typeDirectives = directives.typeDirectives.get(typeName);
  if (typeDirectives && typeDirectives.length > 0) {
    return {
      allowedModes: typeDirectives,
      hasExplicitDirectives: true,
    };
  }

  // Fall back to default auth mode
  if (directives.defaultAuthMode) {
    return {
      allowedModes: [
        {
          authMode: directives.defaultAuthMode,
          directiveName: 'default',
        },
      ],
      hasExplicitDirectives: false,
    };
  }

  // No auth configured - allow all
  return {
    allowedModes: [],
    hasExplicitDirectives: false,
  };
}
