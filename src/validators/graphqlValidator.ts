import fs from 'fs';
import { buildSchema } from 'graphql';
import path from 'path';
import type { AppSyncConfig, SchemaFields, SchemaValidationResult, ValidationResult } from '../types/index.js';

// Function to validate GraphQL schema syntax
export function validateGraphQLSchema(schemaPath: string, configPath?: string): SchemaValidationResult {
  try {
    // Resolve schema path relative to config file's directory (if provided) or CWD
    const baseDir = configPath ? path.dirname(path.resolve(configPath)) : process.cwd();
    const fullPath = path.isAbsolute(schemaPath) ? schemaPath : path.resolve(baseDir, schemaPath);
    const schemaContent = fs.readFileSync(fullPath, 'utf-8');

    // Try to build the schema to catch syntax errors
    const schema = buildSchema(schemaContent);

    return {
      isValid: true,
      schema,
      schemaContent,
      errors: [],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      isValid: false,
      schema: undefined,
      schemaContent: undefined,
      errors: [errorMessage],
    };
  }
}

// Function to extract field definitions from schema
// Extracts fields from all types: Query, Mutation, Subscription, and custom types
export function extractSchemaFields(schemaContent: string): SchemaFields {
  const fields: SchemaFields = {};

  // Regex to extract field names from type definitions
  // Handles AWS directives like @aws_api_key, @aws_cognito_user_pools, @aws_lambda etc.
  // Pattern: type TypeName [directives] { fields }
  const typeRegex = /type\s+(\w+)(?:\s+@[\w_]+(?:\([^)]*\))?)*\s*\{([^}]+)\}/g;
  const matches = schemaContent.matchAll(typeRegex);

  for (const match of matches) {
    const typeName = match[1];
    const typeBody = match[2];

    // Initialize the type if not exists
    if (!fields[typeName]) {
      fields[typeName] = new Set();
    }

    // Split type body into lines and extract field names
    const lines = typeBody.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip comments and empty lines
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // Extract field name (everything before the first colon or opening parenthesis)
      const fieldMatch = trimmedLine.match(/^(\w+)(?:\s*[:(]|$)/);
      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        fields[typeName].add(fieldName);
      }
    }
  }

  return fields;
}

// Check resolvers reference valid schema fields
function checkResolverFields(config: AppSyncConfig, schemaFields: SchemaFields): string[] {
  const errors: string[] = [];
  for (const resolver of config.resolvers) {
    const { type, field } = resolver;
    if (!schemaFields[type]) {
      errors.push(`Resolver for ${type}.${field} references non-existent type '${type}' in schema`);
    } else if (!schemaFields[type].has(field)) {
      errors.push(`Resolver for ${type}.${field} references non-existent field '${field}' in ${type} type`);
    }
  }
  return errors;
}

// Check for schema fields without resolvers
// Only warns for root types (Query, Mutation, Subscription) - custom type field resolvers are optional
function checkMissingResolvers(config: AppSyncConfig, schemaFields: SchemaFields): string[] {
  const warnings: string[] = [];
  const rootTypes = ['Query', 'Mutation', 'Subscription'];

  for (const typeName of rootTypes) {
    const fields = schemaFields[typeName];
    if (!fields) continue;

    const resolverFields = new Set(config.resolvers.filter((r) => r.type === typeName).map((r) => r.field));
    for (const field of fields) {
      if (!resolverFields.has(field)) {
        warnings.push(`Field ${typeName}.${field} has no resolver defined`);
      }
    }
  }
  return warnings;
}

// Function to validate resolver coverage
export function validateResolverCoverage(config: AppSyncConfig, schemaFields: SchemaFields): ValidationResult {
  return {
    errors: checkResolverFields(config, schemaFields),
    warnings: checkMissingResolvers(config, schemaFields),
  };
}

// Function to validate data source references
export function validateDataSourceReferences(config: AppSyncConfig): string[] {
  const errors: string[] = [];

  // Check if all data sources referenced in resolvers exist
  const dataSourceNames = new Set(config.dataSources.map((ds) => ds.name));

  for (const resolver of config.resolvers) {
    if (resolver.kind === 'Unit') {
      if (!dataSourceNames.has(resolver.dataSource)) {
        errors.push(
          `Unit resolver ${resolver.type}.${resolver.field} references non-existent data source '${resolver.dataSource}'`
        );
      }
    } else if (resolver.kind === 'Pipeline') {
      for (const fn of resolver.pipelineFunctions) {
        if (!dataSourceNames.has(fn.dataSource)) {
          errors.push(
            `Pipeline function in ${resolver.type}.${resolver.field} references non-existent data source '${fn.dataSource}'`
          );
        }
      }
    }
  }

  return errors;
}

// Main GraphQL validation function
export function validateGraphQL(config: AppSyncConfig, configPath?: string): ValidationResult {
  console.log('Validating GraphQL schema and resolver coverage...');

  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate schema syntax
  const schemaValidation = validateGraphQLSchema(config.schema, configPath);
  if (!schemaValidation.isValid) {
    errors.push(`GraphQL schema syntax error: ${schemaValidation.errors.join(', ')}`);
    return { errors, warnings };
  }

  // Extract fields from schema
  const schemaFields = extractSchemaFields(schemaValidation.schemaContent!);

  // Validate resolver coverage
  const coverageValidation = validateResolverCoverage(config, schemaFields);
  errors.push(...coverageValidation.errors);
  warnings.push(...coverageValidation.warnings);

  // Validate data source references
  const dataSourceErrors = validateDataSourceReferences(config);
  errors.push(...dataSourceErrors);

  if (errors.length > 0) {
    console.error('GraphQL validation errors:');
    for (const error of errors) console.error(error);
  }

  if (warnings.length > 0) {
    console.warn('GraphQL validation warnings:');
    for (const warning of warnings) console.warn(warning);
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('GraphQL schema and resolver coverage validation passed!');
  }

  return { errors, warnings };
}
