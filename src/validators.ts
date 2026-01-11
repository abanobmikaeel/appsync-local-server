// Re-export everything from the validators module
export {
  APPSYNC_RESTRICTIONS,
  ConfigSchema,
  type ConfigType,
  type FileCollectionResult,
  type FileValidationResult,
  type JavaScriptValidationResult,
  validateAppSyncJavaScript,
  validateConfig,
  validateGraphQL,
} from './validators/index.js';
