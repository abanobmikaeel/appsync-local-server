import { ConfigSchema } from './configSchemas.js';
import { validateAllJavaScriptFiles } from './fileValidator.js';
import { validateAppSyncJavaScript } from './javascriptValidator.js';
import { validateGraphQL } from './graphqlValidator.js';
import { APPSYNC_RESTRICTIONS } from './appsyncRestrictions.js';

export function validateConfig(raw) {
  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    console.error('❌  Invalid config:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }
  
  const config = result.data;
  
  // Validate GraphQL schema and resolver coverage
  const graphqlValidation = validateGraphQL(config);
  if (graphqlValidation.errors.length > 0) {
    console.error('\n❌ GraphQL validation failed. Please fix the errors above.');
    process.exit(1);
  }
  
  // Validate JavaScript files for AppSync compatibility
  validateAllJavaScriptFiles(config);
  
  return config;
}

// Export all validation functions and constants
export { 
  validateAppSyncJavaScript, 
  validateAllJavaScriptFiles, 
  validateGraphQL,
  APPSYNC_RESTRICTIONS,
  ConfigSchema 
}; 