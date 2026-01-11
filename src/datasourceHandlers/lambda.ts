import { createContext } from '../context.js';
import { loadResolverModule } from '../imports.js';
import type { LambdaDataSource, LambdaModule, LambdaRequest } from '../types/index.js';

/** Execute Lambda data source operation */
export async function executeLambdaOperation(dataSource: LambdaDataSource, request: LambdaRequest): Promise<unknown> {
  try {
    // Check if this is a proper Lambda invoke request
    if (!request.operation || request.operation !== 'Invoke' || !request.payload) {
      throw new Error('Lambda data source request must return { operation: "Invoke", payload: ... }');
    }

    const payload = request.payload;

    // If a local file is specified, load and execute it
    if (dataSource.config.file) {
      const lambdaModule = await loadResolverModule<LambdaModule>(dataSource.config.file);

      // Create context for the Lambda function
      const ctx = createContext(payload as Record<string, unknown>);

      // Execute the Lambda function
      if (typeof lambdaModule.handler === 'function') {
        return await lambdaModule.handler(ctx);
      }
      if (typeof lambdaModule.default === 'function') {
        return await lambdaModule.default(ctx);
      }
      throw new Error(`Lambda function ${dataSource.config.file} must export a handler function`);
    }

    // For now, return the payload as-is if no local file is specified
    // In a real implementation, this would call AWS Lambda
    console.warn(`Lambda data source '${dataSource.name}' has no local file specified. Returning payload as-is.`);
    return payload;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Lambda execution failed for '${dataSource.name}': ${errorMessage}`);
  }
}
