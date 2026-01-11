import { describe, expect, it } from '@jest/globals';
import { rdsRequest } from '../../../src/datasourceHandlers/rds.js';

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

  // Note: Testing actual database operations requires a real database connection
  // These tests would be better suited for integration tests with a test database
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
  });
});
