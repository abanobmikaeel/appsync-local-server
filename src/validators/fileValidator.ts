import fs from 'fs';
import path from 'path';
import type { AppSyncConfig, LambdaDataSource } from '../types/index.js';
import { validateAppSyncJavaScript } from './javascriptValidator.js';

export interface FileCollectionResult {
  appSyncFiles: Set<string>;
  dataSourceFiles: Set<string>;
}

export interface FileValidationResult {
  hasErrors: boolean;
  hasWarnings: boolean;
}

// Function to collect JavaScript files and categorize them
export function collectJavaScriptFiles(config: AppSyncConfig): FileCollectionResult {
  const appSyncFiles = new Set<string>(); // Files that run in AppSync JS runtime
  const dataSourceFiles = new Set<string>(); // Files that run in their own environments (e.g., Lambda)

  // Collect AppSync resolver files (these run in AppSync JS runtime)
  for (const resolver of config.resolvers) {
    if (resolver.kind === 'Unit') {
      appSyncFiles.add(resolver.file);
    } else if (resolver.kind === 'Pipeline') {
      appSyncFiles.add(resolver.file);
      for (const fn of resolver.pipelineFunctions) {
        appSyncFiles.add(fn.file);
      }
    }
  }

  // Collect data source files (these run in their own environments)
  for (const ds of config.dataSources) {
    if (ds.type === 'LAMBDA' && (ds as LambdaDataSource).config.file) {
      dataSourceFiles.add((ds as LambdaDataSource).config.file!);
    }
  }

  return { appSyncFiles, dataSourceFiles };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Validation logic requires multiple checks
export function validateAllJavaScriptFiles(config: AppSyncConfig, configPath?: string): FileValidationResult {
  console.log('Validating JavaScript files for AppSync compatibility...');

  const { appSyncFiles, dataSourceFiles } = collectJavaScriptFiles(config);

  // Resolve paths relative to config file's directory (if provided) or CWD
  const baseDir = configPath ? path.dirname(path.resolve(configPath)) : process.cwd();

  // Validate only AppSync resolver files (not data source files)
  let hasErrors = false;
  let hasWarnings = false;

  // Validate AppSync resolver files with strict AppSync JS runtime rules
  for (const filePath of appSyncFiles) {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(baseDir, filePath);
      const code = fs.readFileSync(fullPath, 'utf-8');
      const validation = validateAppSyncJavaScript(code, filePath);

      if (validation.errors.length > 0) {
        hasErrors = true;
        for (const error of validation.errors) console.error(error);
      }

      if (validation.warnings.length > 0) {
        hasWarnings = true;
        for (const warning of validation.warnings) console.warn(warning);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error reading AppSync resolver file ${filePath}: ${errorMessage}`);
      hasErrors = true;
    }
  }

  // For data source files, just check they exist and are readable
  for (const filePath of dataSourceFiles) {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(baseDir, filePath);
      fs.readFileSync(fullPath, 'utf-8');
      console.log(`Data source file ${filePath} exists and is readable`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error reading data source file ${filePath}: ${errorMessage}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error('\n AppSync compatibility validation failed. Please fix the errors above.');
    process.exit(1);
  }

  if (hasWarnings) {
    console.warn('\n AppSync compatibility warnings found. Consider addressing them for better compatibility.');
  } else {
    console.log('All AppSync resolver files are compatible!');
  }

  return { hasErrors, hasWarnings };
}
