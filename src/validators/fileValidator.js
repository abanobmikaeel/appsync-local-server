import path from 'path';
import fs from 'fs';
import { validateAppSyncJavaScript } from './javascriptValidator.js';

// Function to collect JavaScript files and categorize them
export function collectJavaScriptFiles(config) {
  const appSyncFiles = new Set(); // Files that run in AppSync JS runtime
  const dataSourceFiles = new Set(); // Files that run in their own environments (e.g., Lambda)
  
  // Collect AppSync resolver files (these run in AppSync JS runtime)
  config.resolvers.forEach(resolver => {
    if (resolver.kind === 'Unit') {
      appSyncFiles.add(resolver.file);
    } else if (resolver.kind === 'Pipeline') {
      appSyncFiles.add(resolver.file);
      resolver.pipelineFunctions.forEach(fn => {
        appSyncFiles.add(fn.file);
      });
    }
  });
  
  // Collect data source files (these run in their own environments)
  config.dataSources.forEach(ds => {
    if (ds.type === 'LAMBDA' && ds.config.file) {
      dataSourceFiles.add(ds.config.file);
    }
  });
  
  return { appSyncFiles, dataSourceFiles };
}

// Function to validate all JavaScript files for AppSync compatibility
export function validateAllJavaScriptFiles(config) {
  console.log('🔍 Validating JavaScript files for AppSync compatibility...');
  
  const { appSyncFiles, dataSourceFiles } = collectJavaScriptFiles(config);
  
  // Validate only AppSync resolver files (not data source files)
  let hasErrors = false;
  let hasWarnings = false;
  
  // Validate AppSync resolver files with strict AppSync JS runtime rules
  for (const filePath of appSyncFiles) {
    try {
      const fullPath = path.resolve(process.cwd(), filePath);
      const code = fs.readFileSync(fullPath, 'utf-8');
      const validation = validateAppSyncJavaScript(code, filePath);
      
      if (validation.errors.length > 0) {
        hasErrors = true;
        validation.errors.forEach(error => console.error(error));
      }
      
      if (validation.warnings.length > 0) {
        hasWarnings = true;
        validation.warnings.forEach(warning => console.warn(warning));
      }
    } catch (error) {
      console.error(`❌ Error reading AppSync resolver file ${filePath}: ${error.message}`);
      hasErrors = true;
    }
  }
  
  // For data source files, just check they exist and are readable
  for (const filePath of dataSourceFiles) {
    try {
      const fullPath = path.resolve(process.cwd(), filePath);
      fs.readFileSync(fullPath, 'utf-8');
      console.log(`📁 Data source file ${filePath} exists and is readable`);
    } catch (error) {
      console.error(`❌ Error reading data source file ${filePath}: ${error.message}`);
      hasErrors = true;
    }
  }
  
  if (hasErrors) {
    console.error('\n❌ AppSync compatibility validation failed. Please fix the errors above.');
    process.exit(1);
  }
  
  if (hasWarnings) {
    console.warn('\n⚠️  AppSync compatibility warnings found. Consider addressing them for better compatibility.');
  } else {
    console.log('✅ All AppSync resolver files are compatible!');
  }
  
  return { hasErrors, hasWarnings };
} 