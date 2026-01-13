import { describe, expect, it, jest } from '@jest/globals';
import type { LambdaDataSource, LambdaRequest } from '../../../src/types/index.js';

describe('Lambda Handler', () => {
  describe('executeLambdaOperation', () => {
    it('should be importable', async () => {
      const { executeLambdaOperation } = await import('../../../src/datasourceHandlers/lambda.js');
      expect(typeof executeLambdaOperation).toBe('function');
    });

    it('should throw error for missing operation', async () => {
      const { executeLambdaOperation } = await import('../../../src/datasourceHandlers/lambda.js');

      const dataSource: LambdaDataSource = {
        name: 'TestLambda',
        type: 'LAMBDA',
        config: { functionName: 'test', region: 'us-east-1' },
      };

      const request = { payload: {} } as LambdaRequest;

      await expect(executeLambdaOperation(dataSource, request)).rejects.toThrow(
        'Lambda data source request must return { operation: "Invoke", payload: ... }'
      );
    });

    it('should throw error for wrong operation', async () => {
      const { executeLambdaOperation } = await import('../../../src/datasourceHandlers/lambda.js');

      const dataSource: LambdaDataSource = {
        name: 'TestLambda',
        type: 'LAMBDA',
        config: { functionName: 'test', region: 'us-east-1' },
      };

      const request = { operation: 'WrongOp', payload: {} } as unknown as LambdaRequest;

      await expect(executeLambdaOperation(dataSource, request)).rejects.toThrow(
        'Lambda data source request must return { operation: "Invoke", payload: ... }'
      );
    });

    it('should throw error for missing payload', async () => {
      const { executeLambdaOperation } = await import('../../../src/datasourceHandlers/lambda.js');

      const dataSource: LambdaDataSource = {
        name: 'TestLambda',
        type: 'LAMBDA',
        config: { functionName: 'test', region: 'us-east-1' },
      };

      const request = { operation: 'Invoke' } as LambdaRequest;

      await expect(executeLambdaOperation(dataSource, request)).rejects.toThrow(
        'Lambda data source request must return { operation: "Invoke", payload: ... }'
      );
    });

    it('should return payload when no local file specified', async () => {
      const { executeLambdaOperation } = await import('../../../src/datasourceHandlers/lambda.js');

      const originalWarn = console.warn;
      console.warn = jest.fn();

      const dataSource: LambdaDataSource = {
        name: 'RemoteLambda',
        type: 'LAMBDA',
        config: { functionName: 'remote-function', region: 'us-east-1' },
      };

      const request: LambdaRequest = {
        operation: 'Invoke',
        payload: { data: 'test-payload' },
      };

      const result = await executeLambdaOperation(dataSource, request);

      expect(result).toEqual({ data: 'test-payload' });
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("Lambda data source 'RemoteLambda' has no local file specified")
      );

      console.warn = originalWarn;
    });

    it('should execute local Lambda file with handler export', async () => {
      const { executeLambdaOperation } = await import('../../../src/datasourceHandlers/lambda.js');

      const dataSource: LambdaDataSource = {
        name: 'LocalLambda',
        type: 'LAMBDA',
        config: {
          functionName: 'local-function',
          region: 'us-east-1',
          file: 'tests/fixtures/testLambda.js',
        },
      };

      const request: LambdaRequest = {
        operation: 'Invoke',
        payload: { action: 'getUser', userId: 'user-123' },
      };

      const result = await executeLambdaOperation(dataSource, request);

      // Result should be an object with success: true and received context
      expect(result).toMatchObject({
        success: true,
      });
      // The received object should be a context with arguments containing the payload
      expect((result as { received: { arguments: Record<string, unknown> } }).received).toHaveProperty('arguments');
    });

    it('should execute local Lambda file with default export', async () => {
      const { executeLambdaOperation } = await import('../../../src/datasourceHandlers/lambda.js');

      const dataSource: LambdaDataSource = {
        name: 'DefaultLambda',
        type: 'LAMBDA',
        config: {
          functionName: 'default-function',
          region: 'us-east-1',
          file: 'tests/fixtures/testLambdaDefault.js',
        },
      };

      const request: LambdaRequest = {
        operation: 'Invoke',
        payload: { test: 'data' },
      };

      const result = await executeLambdaOperation(dataSource, request);

      // Result should be an object with success: true and type: default
      expect(result).toMatchObject({
        success: true,
        type: 'default',
      });
      // The received object should be a context with arguments containing the payload
      expect((result as { received: { arguments: Record<string, unknown> } }).received).toHaveProperty('arguments');
    });

    it('should throw error for Lambda file without handler function', async () => {
      const { executeLambdaOperation } = await import('../../../src/datasourceHandlers/lambda.js');

      // Create a temp module path that doesn't export handler
      const dataSource: LambdaDataSource = {
        name: 'BadLambda',
        type: 'LAMBDA',
        config: {
          functionName: 'bad-function',
          region: 'us-east-1',
          file: 'package.json', // Not a valid Lambda file
        },
      };

      const request: LambdaRequest = {
        operation: 'Invoke',
        payload: {},
      };

      await expect(executeLambdaOperation(dataSource, request)).rejects.toThrow(
        /Lambda function.*must export a handler function|Lambda execution failed/
      );
    });

    it('should throw error for non-existent Lambda file', async () => {
      const { executeLambdaOperation } = await import('../../../src/datasourceHandlers/lambda.js');

      const dataSource: LambdaDataSource = {
        name: 'MissingLambda',
        type: 'LAMBDA',
        config: {
          functionName: 'missing-function',
          region: 'us-east-1',
          file: 'nonexistent/lambda.js',
        },
      };

      const request: LambdaRequest = {
        operation: 'Invoke',
        payload: {},
      };

      await expect(executeLambdaOperation(dataSource, request)).rejects.toThrow(/Lambda execution failed/);
    });

    it('should include data source name in error messages', async () => {
      const { executeLambdaOperation } = await import('../../../src/datasourceHandlers/lambda.js');

      const dataSource: LambdaDataSource = {
        name: 'NamedLambda',
        type: 'LAMBDA',
        config: {
          functionName: 'named-function',
          region: 'us-east-1',
          file: 'nonexistent.js',
        },
      };

      const request: LambdaRequest = {
        operation: 'Invoke',
        payload: {},
      };

      await expect(executeLambdaOperation(dataSource, request)).rejects.toThrow(/NamedLambda/);
    });
  });
});
