import { buildSchema, GraphQLError } from 'graphql';
import fs from 'fs';
import path from 'path';

// Function to validate GraphQL schema syntax
export function validateGraphQLSchema(schemaPath) {
  try {
    const fullPath = path.resolve(process.cwd(), schemaPath);
    const schemaContent = fs.readFileSync(fullPath, 'utf-8');
    
    // Try to build the schema to catch syntax errors
    const schema = buildSchema(schemaContent);
    
    return {
      isValid: true,
      schema,
      schemaContent,
      errors: []
    };
  } catch (error) {
    return {
      isValid: false,
      schema: null,
      schemaContent: null,
      errors: [error.message]
    };
  }
}

// Function to extract field definitions from schema
export function extractSchemaFields(schemaContent) {
  const fields = {
    Query: new Set(),
    Mutation: new Set(),
    Subscription: new Set()
  };
  
  // Regex to extract field names from type definitions
  const typeRegex = /type\s+(\w+)\s*\{([^}]+)\}/g;
  
  let match;
  while ((match = typeRegex.exec(schemaContent)) !== null) {
    const typeName = match[1];
    const typeBody = match[2];
    
    if (fields[typeName]) {
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
  }
  
  return fields;
}

// Function to validate resolver coverage
export function validateResolverCoverage(config, schemaFields) {
  const errors = [];
  const warnings = [];
  
  // Check if all resolvers have corresponding schema fields
  config.resolvers.forEach(resolver => {
    const { type, field } = resolver;
    
    if (!schemaFields[type]) {
      errors.push(`❌ Resolver for ${type}.${field} references non-existent type '${type}' in schema`);
      return;
    }
    
    if (!schemaFields[type].has(field)) {
      errors.push(`❌ Resolver for ${type}.${field} references non-existent field '${field}' in ${type} type`);
    }
  });
  
  // Check for required fields without resolvers (warnings)
  Object.entries(schemaFields).forEach(([typeName, fields]) => {
    if (typeName === 'Query' || typeName === 'Mutation' || typeName === 'Subscription') {
      const resolverFields = new Set(
        config.resolvers
          .filter(r => r.type === typeName)
          .map(r => r.field)
      );
      
      fields.forEach(field => {
        if (!resolverFields.has(field)) {
          warnings.push(`⚠️  Field ${typeName}.${field} has no resolver defined`);
        }
      });
    }
  });
  
  return { errors, warnings };
}

// Function to validate data source references
export function validateDataSourceReferences(config) {
  const errors = [];
  
  // Check if all data sources referenced in resolvers exist
  const dataSourceNames = new Set(config.dataSources.map(ds => ds.name));
  
  config.resolvers.forEach(resolver => {
    if (resolver.kind === 'Unit') {
      if (!dataSourceNames.has(resolver.dataSource)) {
        errors.push(`❌ Unit resolver ${resolver.type}.${resolver.field} references non-existent data source '${resolver.dataSource}'`);
      }
    } else if (resolver.kind === 'Pipeline') {
      resolver.pipelineFunctions.forEach(fn => {
        if (!dataSourceNames.has(fn.dataSource)) {
          errors.push(`❌ Pipeline function in ${resolver.type}.${resolver.field} references non-existent data source '${fn.dataSource}'`);
        }
      });
    }
  });
  
  return errors;
}

// Main GraphQL validation function
export function validateGraphQL(config) {
  console.log('🔍 Validating GraphQL schema and resolver coverage...');
  
  const errors = [];
  const warnings = [];
  
  // Validate schema syntax
  const schemaValidation = validateGraphQLSchema(config.schema);
  if (!schemaValidation.isValid) {
    errors.push(`❌ GraphQL schema syntax error: ${schemaValidation.errors.join(', ')}`);
    return { errors, warnings };
  }
  
  // Extract fields from schema
  const schemaFields = extractSchemaFields(schemaValidation.schemaContent);
  
  // Validate resolver coverage
  const coverageValidation = validateResolverCoverage(config, schemaFields);
  errors.push(...coverageValidation.errors);
  warnings.push(...coverageValidation.warnings);
  
  // Validate data source references
  const dataSourceErrors = validateDataSourceReferences(config);
  errors.push(...dataSourceErrors);
  
  if (errors.length > 0) {
    console.error('❌ GraphQL validation errors:');
    errors.forEach(error => console.error(error));
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️  GraphQL validation warnings:');
    warnings.forEach(warning => console.warn(warning));
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ GraphQL schema and resolver coverage validation passed!');
  }
  
  return { errors, warnings };
} 