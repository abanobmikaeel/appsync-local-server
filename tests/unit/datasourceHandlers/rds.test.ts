import { beforeEach, describe, expect, it } from '@jest/globals';
import { closeAllPools, executeRDSOperation, rdsRequest } from '../../../src/datasourceHandlers/rds.js';
import type { RDSDataSource, RDSRequest } from '../../../src/types/index.js';

describe('RDS Data Source Handler', () => {
  describe('rdsRequest helpers', () => {
    it('should create executeStatement request', () => {
      const request = rdsRequest.executeStatement('SELECT * FROM users WHERE id = :id', { id: '123' });
      expect(request).toEqual({
        operation: 'executeStatement',
        sql: 'SELECT * FROM users WHERE id = :id',
        variableMap: { id: '123' },
        transactionId: undefined,
      });
    });

    it('should create executeStatement request with transaction', () => {
      const request = rdsRequest.executeStatement(
        'UPDATE users SET name = :name WHERE id = :id',
        { id: '123', name: 'Test' },
        'txn_123'
      );
      expect(request).toEqual({
        operation: 'executeStatement',
        sql: 'UPDATE users SET name = :name WHERE id = :id',
        variableMap: { id: '123', name: 'Test' },
        transactionId: 'txn_123',
      });
    });

    it('should create executeStatement request without variableMap', () => {
      const request = rdsRequest.executeStatement('SELECT NOW()');
      expect(request).toEqual({
        operation: 'executeStatement',
        sql: 'SELECT NOW()',
        variableMap: undefined,
        transactionId: undefined,
      });
    });

    it('should create batchExecuteStatement request', () => {
      const statements = [
        { sql: 'INSERT INTO users (id, name) VALUES (:id, :name)', variableMap: { id: '1', name: 'Alice' } },
        { sql: 'INSERT INTO users (id, name) VALUES (:id, :name)', variableMap: { id: '2', name: 'Bob' } },
      ];
      const request = rdsRequest.batchExecuteStatement(statements);
      expect(request).toEqual({
        operation: 'batchExecuteStatement',
        statements,
        transactionId: undefined,
      });
    });

    it('should create batchExecuteStatement request with transaction', () => {
      const statements = [{ sql: 'DELETE FROM users WHERE id = :id', variableMap: { id: '1' } }];
      const request = rdsRequest.batchExecuteStatement(statements, 'txn_456');
      expect(request).toEqual({
        operation: 'batchExecuteStatement',
        statements,
        transactionId: 'txn_456',
      });
    });

    it('should create beginTransaction request', () => {
      const request = rdsRequest.beginTransaction();
      expect(request).toEqual({
        operation: 'beginTransaction',
      });
    });

    it('should create commitTransaction request', () => {
      const request = rdsRequest.commitTransaction('txn_123');
      expect(request).toEqual({
        operation: 'commitTransaction',
        transactionId: 'txn_123',
      });
    });

    it('should create rollbackTransaction request', () => {
      const request = rdsRequest.rollbackTransaction('txn_123');
      expect(request).toEqual({
        operation: 'rollbackTransaction',
        transactionId: 'txn_123',
      });
    });
  });

  describe('SQL variable conversion', () => {
    it('should handle SQL without variables', () => {
      const request = rdsRequest.executeStatement('SELECT * FROM users');
      expect(request.sql).toBe('SELECT * FROM users');
      expect(request.variableMap).toBeUndefined();
    });

    it('should support named parameters', () => {
      const request = rdsRequest.executeStatement('SELECT * FROM users WHERE name = :name AND status = :status', {
        name: 'John',
        status: 'active',
      });
      expect(request.variableMap).toEqual({ name: 'John', status: 'active' });
    });

    it('should support various data types in variableMap', () => {
      const request = rdsRequest.executeStatement(
        'INSERT INTO items (name, price, active, metadata) VALUES (:name, :price, :active, :metadata)',
        {
          name: 'Widget',
          price: 19.99,
          active: true,
          metadata: { category: 'tools' },
        }
      );
      expect(request.variableMap).toEqual({
        name: 'Widget',
        price: 19.99,
        active: true,
        metadata: { category: 'tools' },
      });
    });

    it('should handle empty variableMap', () => {
      const request = rdsRequest.executeStatement('SELECT 1', {});
      expect(request.variableMap).toEqual({});
    });

    it('should handle null values in variableMap', () => {
      const request = rdsRequest.executeStatement('UPDATE users SET deleted_at = :deleted WHERE id = :id', {
        deleted: null,
        id: '123',
      });
      expect(request.variableMap).toEqual({ deleted: null, id: '123' });
    });

    it('should handle array values in variableMap', () => {
      const request = rdsRequest.executeStatement('SELECT * FROM users WHERE id = ANY(:ids)', {
        ids: ['1', '2', '3'],
      });
      expect(request.variableMap).toEqual({ ids: ['1', '2', '3'] });
    });

    it('should handle date values in variableMap', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const request = rdsRequest.executeStatement('SELECT * FROM logs WHERE created_at > :date', {
        date,
      });
      expect(request.variableMap?.date).toEqual(date);
    });
  });

  describe('executeRDSOperation error handling', () => {
    const mockDataSource: RDSDataSource = {
      name: 'TestRDS',
      type: 'RDS',
      config: {
        engine: 'postgresql',
        databaseName: 'testdb',
        host: 'localhost',
        port: 5432,
        user: 'test',
        password: 'test',
      },
    };

    beforeEach(async () => {
      await closeAllPools();
    });

    it('should throw error for missing SQL in executeStatement', async () => {
      const request: RDSRequest = {
        operation: 'executeStatement',
      };

      await expect(executeRDSOperation(mockDataSource, request)).rejects.toThrow('SQL statement is required');
    });

    it('should throw error for missing statements in batchExecuteStatement', async () => {
      const request: RDSRequest = {
        operation: 'batchExecuteStatement',
        statements: [],
      };

      await expect(executeRDSOperation(mockDataSource, request)).rejects.toThrow('Statements array is required');
    });

    it('should throw error for undefined statements in batchExecuteStatement', async () => {
      const request: RDSRequest = {
        operation: 'batchExecuteStatement',
      };

      await expect(executeRDSOperation(mockDataSource, request)).rejects.toThrow('Statements array is required');
    });

    it('should throw error for unsupported operation', async () => {
      const request = {
        operation: 'unknownOperation',
      } as unknown as RDSRequest;

      await expect(executeRDSOperation(mockDataSource, request)).rejects.toThrow(
        'Unsupported RDS operation: unknownOperation'
      );
    });

    it('should throw error for unsupported database engine', async () => {
      const badDataSource: RDSDataSource = {
        ...mockDataSource,
        config: {
          ...mockDataSource.config,
          engine: 'oracle' as 'postgresql',
        },
      };

      const request: RDSRequest = {
        operation: 'executeStatement',
        sql: 'SELECT 1',
      };

      await expect(executeRDSOperation(badDataSource, request)).rejects.toThrow('Unsupported database engine: oracle');
    });

    it('should throw error for commitTransaction with non-existent transaction', async () => {
      const request: RDSRequest = {
        operation: 'commitTransaction',
        transactionId: 'non_existent_txn',
      };

      await expect(executeRDSOperation(mockDataSource, request)).rejects.toThrow(
        'Transaction non_existent_txn not found'
      );
    });

    it('should throw error for rollbackTransaction with non-existent transaction', async () => {
      const request: RDSRequest = {
        operation: 'rollbackTransaction',
        transactionId: 'non_existent_txn',
      };

      await expect(executeRDSOperation(mockDataSource, request)).rejects.toThrow(
        'Transaction non_existent_txn not found'
      );
    });

    it('should include data source name in error messages', async () => {
      const request: RDSRequest = {
        operation: 'executeStatement',
      };

      await expect(executeRDSOperation(mockDataSource, request)).rejects.toThrow(/TestRDS/);
    });
  });

  describe('closeAllPools', () => {
    it('should be callable without error', async () => {
      await expect(closeAllPools()).resolves.not.toThrow();
    });

    it('should clear all pools when called multiple times', async () => {
      await closeAllPools();
      await closeAllPools();
      expect(true).toBe(true);
    });
  });

  describe('RDS request structure validation', () => {
    it('should create proper structure for complex queries', () => {
      const request = rdsRequest.executeStatement(
        `
        SELECT u.id, u.name, o.total
        FROM users u
        JOIN orders o ON u.id = o.user_id
        WHERE u.status = :status
        AND o.created_at > :date
        ORDER BY o.total DESC
        LIMIT :limit
        `,
        {
          status: 'active',
          date: '2024-01-01',
          limit: 10,
        }
      );

      expect(request.operation).toBe('executeStatement');
      expect(request.variableMap).toHaveProperty('status', 'active');
      expect(request.variableMap).toHaveProperty('date', '2024-01-01');
      expect(request.variableMap).toHaveProperty('limit', 10);
    });

    it('should create batch statements for bulk inserts', () => {
      const users = [
        { id: '1', name: 'Alice', email: 'alice@test.com' },
        { id: '2', name: 'Bob', email: 'bob@test.com' },
        { id: '3', name: 'Charlie', email: 'charlie@test.com' },
      ];

      const statements = users.map((user) => ({
        sql: 'INSERT INTO users (id, name, email) VALUES (:id, :name, :email)',
        variableMap: user,
      }));

      const request = rdsRequest.batchExecuteStatement(statements);

      expect(request.operation).toBe('batchExecuteStatement');
      expect(request.statements).toHaveLength(3);
      expect(request.statements?.[0].variableMap).toEqual(users[0]);
    });

    it('should handle transaction workflow', () => {
      const begin = rdsRequest.beginTransaction();
      const stmt1 = rdsRequest.executeStatement('INSERT INTO users (id) VALUES (:id)', { id: '1' }, 'txn_test');
      const stmt2 = rdsRequest.executeStatement('INSERT INTO users (id) VALUES (:id)', { id: '2' }, 'txn_test');
      const commit = rdsRequest.commitTransaction('txn_test');
      const rollback = rdsRequest.rollbackTransaction('txn_test');

      expect(begin.operation).toBe('beginTransaction');
      expect(stmt1.transactionId).toBe('txn_test');
      expect(stmt2.transactionId).toBe('txn_test');
      expect(commit.transactionId).toBe('txn_test');
      expect(rollback.transactionId).toBe('txn_test');
    });
  });
});
