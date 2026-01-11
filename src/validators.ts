// Re-export everything from the validators module
export {
  validateConfig,
  validateAppSyncJavaScript,
  validateGraphQL,
  APPSYNC_RESTRICTIONS,
  ConfigSchema,
  type ConfigType,
  type JavaScriptValidationResult,
  type FileCollectionResult,
  type FileValidationResult,
} from './validators/index.js';
