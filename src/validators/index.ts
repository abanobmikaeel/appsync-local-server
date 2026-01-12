import path from 'path';
import { APPSYNC_RESTRICTIONS } from './appsyncRestrictions.js';
import { ConfigSchema, type ConfigType, setConfigBaseDir } from './configSchemas.js';
import { validateAllJavaScriptFiles } from './fileValidator.js';
import { validateGraphQL } from './graphqlValidator.js';
import { validateAppSyncJavaScript } from './javascriptValidator.js';

/**
 * Validate config and return parsed config object.
 * @param raw - Raw config object (parsed JSON)
 * @param configFilePath - Optional path to the config file (for resolving relative paths)
 */
export function validateConfig(raw: unknown, configFilePath?: string): ConfigType {
  // Set the base directory for resolving relative paths
  if (configFilePath) {
    const configDir = path.dirname(path.resolve(configFilePath));
    setConfigBaseDir(configDir);
  }

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    console.error('Invalid config:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  const config = result.data;

  // Validate GraphQL schema and resolver coverage
  const graphqlValidation = validateGraphQL(config, configFilePath);
  if (graphqlValidation.errors.length > 0) {
    console.error('\n GraphQL validation failed. Please fix the errors above.');
    process.exit(1);
  }

  // Validate JavaScript files for AppSync compatibility
  validateAllJavaScriptFiles(config, configFilePath);

  return config;
}

// Export all validation functions and constants
export { validateAppSyncJavaScript, validateAllJavaScriptFiles, validateGraphQL, APPSYNC_RESTRICTIONS, ConfigSchema };

// Re-export types
export type { ConfigType } from './configSchemas.js';
export type { FileCollectionResult, FileValidationResult } from './fileValidator.js';
export type { JavaScriptValidationResult } from './javascriptValidator.js';
