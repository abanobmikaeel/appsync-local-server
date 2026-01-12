import type { AuthConfig } from '../types/index.js';
import {
  type AppSyncAuthMode,
  getTypeAuthRequirements,
  isScalarOrBuiltinType,
  type SchemaDirectives,
} from './directiveParser.js';

// ============================================================================
// Types
// ============================================================================

export interface SchemaAuthWarning {
  /** Warning code for categorization */
  code: string;
  /** Human-readable warning message */
  message: string;
  /** Location in schema (e.g., "Query.getPost") */
  location?: string;
  /** Suggested fix */
  suggestion?: string;
}

// ============================================================================
// Warning Detection
// ============================================================================

/**
 * Check for @aws_auth usage with multiple auth providers
 * AWS docs: "@aws_auth only works when Cognito is the sole provider"
 */
function checkAwsAuthWithMultipleProviders(
  directives: SchemaDirectives,
  authConfigs: AuthConfig[]
): SchemaAuthWarning[] {
  const warnings: SchemaAuthWarning[] = [];

  if (authConfigs.length <= 1) {
    return warnings; // Single provider is fine
  }

  // Check type-level directives
  for (const [typeName, typeDirectives] of directives.typeDirectives) {
    for (const directive of typeDirectives) {
      if (directive.directiveName === 'aws_auth') {
        warnings.push({
          code: 'AWS_AUTH_MULTI_PROVIDER',
          message: `@aws_auth directive used on type '${typeName}' with multiple auth providers configured.`,
          location: typeName,
          suggestion: 'Replace @aws_auth with @aws_cognito_user_pools for multi-auth compatibility.',
        });
      }
    }
  }

  // Check field-level directives
  for (const [fieldKey, fieldDirectives] of directives.fieldDirectives) {
    for (const directive of fieldDirectives) {
      if (directive.directiveName === 'aws_auth') {
        warnings.push({
          code: 'AWS_AUTH_MULTI_PROVIDER',
          message: `@aws_auth directive used on field '${fieldKey}' with multiple auth providers configured.`,
          location: fieldKey,
          suggestion: 'Replace @aws_auth with @aws_cognito_user_pools for multi-auth compatibility.',
        });
      }
    }
  }

  return warnings;
}

interface FieldReturnTypeContext {
  fieldKey: string;
  returnTypeName: string;
  fieldModes: Set<AppSyncAuthMode>;
  returnTypeModes: Set<AppSyncAuthMode>;
  hasExplicitDirectives: boolean;
}

/**
 * Check for default auth mode mismatch on return types
 */
function checkDefaultMismatch(ctx: FieldReturnTypeContext, defaultAuthMode: AppSyncAuthMode): SchemaAuthWarning[] {
  const warnings: SchemaAuthWarning[] = [];

  for (const mode of ctx.fieldModes) {
    if (mode !== defaultAuthMode) {
      warnings.push({
        code: 'RETURN_TYPE_DEFAULT_MISMATCH',
        message:
          `Field '${ctx.fieldKey}' allows ${mode} but returns type '${ctx.returnTypeName}' ` +
          `which has no directives (defaults to ${defaultAuthMode} only).`,
        location: ctx.fieldKey,
        suggestion: `Add @${authModeToDirective(mode)} to type ${ctx.returnTypeName}, or ensure callers use ${defaultAuthMode}.`,
      });
    }
  }

  return warnings;
}

/**
 * Check for explicit directive mismatch on return types
 */
function checkExplicitMismatch(ctx: FieldReturnTypeContext): SchemaAuthWarning[] {
  const warnings: SchemaAuthWarning[] = [];

  for (const mode of ctx.fieldModes) {
    if (!ctx.returnTypeModes.has(mode)) {
      warnings.push({
        code: 'RETURN_TYPE_AUTH_MISMATCH',
        message:
          `Field '${ctx.fieldKey}' allows ${mode} but return type '${ctx.returnTypeName}' ` +
          `does not include ${mode} in its directives.`,
        location: ctx.fieldKey,
        suggestion: `Add @${authModeToDirective(mode)} to type ${ctx.returnTypeName}, or remove ${mode} from field.`,
      });
    }
  }

  return warnings;
}

/**
 * Check for return types that might cause unexpected auth denials
 * Warns when a field's return type has stricter auth than the field itself
 */
function checkReturnTypeAuthMismatches(
  directives: SchemaDirectives,
  defaultAuthMode?: AppSyncAuthMode
): SchemaAuthWarning[] {
  const warnings: SchemaAuthWarning[] = [];

  for (const [fieldKey, returnTypeName] of directives.fieldReturnTypes) {
    if (isScalarOrBuiltinType(returnTypeName)) {
      continue;
    }

    const [typeName] = fieldKey.split('.');
    const fieldDirectives = directives.fieldDirectives.get(fieldKey);
    const typeDirectives = directives.typeDirectives.get(typeName);
    const fieldAllowedModes = fieldDirectives ?? typeDirectives ?? [];
    const returnTypeRequirements = getTypeAuthRequirements(returnTypeName, directives);

    if (returnTypeRequirements.allowedModes.length === 0) {
      continue;
    }

    const ctx: FieldReturnTypeContext = {
      fieldKey,
      returnTypeName,
      fieldModes: new Set(fieldAllowedModes.map((d) => d.authMode)),
      returnTypeModes: new Set(returnTypeRequirements.allowedModes.map((d) => d.authMode)),
      hasExplicitDirectives: returnTypeRequirements.hasExplicitDirectives,
    };

    if (!ctx.hasExplicitDirectives && defaultAuthMode) {
      warnings.push(...checkDefaultMismatch(ctx, defaultAuthMode));
    } else if (ctx.hasExplicitDirectives && fieldAllowedModes.length > 0) {
      warnings.push(...checkExplicitMismatch(ctx));
    }
  }

  return warnings;
}

/**
 * Convert auth mode to directive name
 */
function authModeToDirective(mode: AppSyncAuthMode): string {
  const mapping: Record<AppSyncAuthMode, string> = {
    API_KEY: 'aws_api_key',
    AWS_IAM: 'aws_iam',
    AMAZON_COGNITO_USER_POOLS: 'aws_cognito_user_pools',
    OPENID_CONNECT: 'aws_oidc',
    AWS_LAMBDA: 'aws_lambda',
  };
  return mapping[mode] ?? mode.toLowerCase();
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate schema for common auth configuration issues
 * Returns warnings (not errors) to help developers catch issues early
 */
export function validateSchemaAuth(directives: SchemaDirectives, authConfigs: AuthConfig[]): SchemaAuthWarning[] {
  const warnings: SchemaAuthWarning[] = [];

  // Check @aws_auth usage
  warnings.push(...checkAwsAuthWithMultipleProviders(directives, authConfigs));

  // Check return type mismatches
  warnings.push(...checkReturnTypeAuthMismatches(directives, directives.defaultAuthMode));

  return warnings;
}

/**
 * Format warnings for console output
 */
export function formatSchemaAuthWarnings(warnings: SchemaAuthWarning[]): string {
  if (warnings.length === 0) {
    return '';
  }

  const lines: string[] = ['\n=== Schema Authorization Warnings ===\n'];

  for (const warning of warnings) {
    lines.push(`\u26A0 [${warning.code}] ${warning.message}`);
    if (warning.suggestion) {
      lines.push(`  \u21B3 ${warning.suggestion}`);
    }
    lines.push('');
  }

  lines.push(`Total: ${warnings.length} warning(s)\n`);

  return lines.join('\n');
}
