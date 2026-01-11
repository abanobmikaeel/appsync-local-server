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
  });
});
