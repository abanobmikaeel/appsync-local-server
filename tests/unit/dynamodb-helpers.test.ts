import { describe, expect, it } from '@jest/globals';
import {
  batchDelete,
  batchGet,
  batchPut,
  get,
  operations,
  put,
  query,
  remove,
  scan,
  sync,
  toBinarySet,
  toNumberSet,
  toStringSet,
  transactGet,
  transactWrite,
  update,
} from '../../src/dynamodb.js';

describe('DynamoDB Helpers', () => {
  describe('get', () => {
    it('should build a basic GetItem request', () => {
      const result = get({ key: { id: '123' } });

      expect(result).toEqual({
        operation: 'GetItem',
        key: { id: '123' },
        consistentRead: undefined,
        projection: undefined,
      });
    });

    it('should include consistentRead when specified', () => {
      const result = get({ key: { id: '123' }, consistentRead: true });

      expect(result.consistentRead).toBe(true);
    });

    it('should include projection when specified', () => {
      const result = get({
        key: { id: '123' },
        projection: ['id', 'name', 'email'],
      });

      expect(result.projection).toEqual(['id', 'name', 'email']);
    });

    it('should handle composite keys', () => {
      const result = get({ key: { pk: 'USER#123', sk: 'PROFILE' } });

      expect(result.key).toEqual({ pk: 'USER#123', sk: 'PROFILE' });
    });
  });

  describe('put', () => {
    it('should build a basic PutItem request', () => {
      const result = put<Record<string, unknown>>({
        key: { id: '123' },
        item: { id: '123', name: 'Test', email: 'test@example.com' },
      });

      expect(result).toEqual({
        operation: 'PutItem',
        key: { id: '123' },
        attributeValues: { id: '123', name: 'Test', email: 'test@example.com' },
      });
    });

    it('should include condition when specified', () => {
      const result = put<Record<string, unknown>>({
        key: { id: '123' },
        item: { id: '123', name: 'Test' },
        condition: { id: { attributeExists: false } },
      });

      expect(result.condition).toBeDefined();
      expect(result.condition?.expression).toContain('attribute_not_exists');
    });

    it('should include _version when specified', () => {
      const result = put<Record<string, unknown>>({
        key: { id: '123' },
        item: { id: '123' },
        _version: 1,
      });

      expect(result._version).toBe(1);
    });
  });

  describe('remove', () => {
    it('should build a basic DeleteItem request', () => {
      const result = remove({ key: { id: '123' } });

      expect(result).toEqual({
        operation: 'DeleteItem',
        key: { id: '123' },
      });
    });

    it('should include condition when specified', () => {
      const result = remove({
        key: { id: '123' },
        condition: { status: { eq: 'DRAFT' } },
      });

      expect(result.condition).toBeDefined();
      expect(result.condition?.expression).toContain('=');
    });
  });

  describe('update', () => {
    it('should build update request with simple values', () => {
      const result = update({
        key: { id: '123' },
        update: { name: 'Updated', status: 'ACTIVE' },
      });

      expect(result.operation).toBe('UpdateItem');
      expect(result.key).toEqual({ id: '123' });
      expect(result.update.expression).toContain('SET');
      expect(result.update.expressionNames).toBeDefined();
      expect(result.update.expressionValues).toBeDefined();
    });

    it('should handle array of operations', () => {
      const result = update({
        key: { id: '123' },
        update: [operations.replace('name', 'New Name'), operations.increment('viewCount', 1)],
      });

      expect(result.update.expression).toContain('SET');
      expect(result.update.expressionNames?.['#n0']).toBe('name');
      expect(result.update.expressionNames?.['#n1']).toBe('viewCount');
    });

    it('should include condition when specified', () => {
      const result = update({
        key: { id: '123' },
        update: { name: 'Test' },
        condition: { version: { eq: 1 } },
      });

      expect(result.condition).toBeDefined();
    });
  });

  describe('query', () => {
    it('should build a basic Query request', () => {
      const result = query({
        query: { userId: { eq: 'user-123' } },
      });

      expect(result.operation).toBe('Query');
      expect(result.query.expression).toContain('=');
      expect(result.query.expressionNames?.['#k0']).toBe('userId');
    });

    it('should include index when specified', () => {
      const result = query({
        query: { gsi1pk: { eq: 'TYPE#USER' } },
        index: 'GSI1',
      });

      expect(result.index).toBe('GSI1');
    });

    it('should include limit and pagination', () => {
      const result = query({
        query: { pk: { eq: 'test' } },
        limit: 10,
        nextToken: 'token123',
      });

      expect(result.limit).toBe(10);
      expect(result.nextToken).toBe('token123');
    });

    it('should include filter when specified', () => {
      const result = query({
        query: { pk: { eq: 'test' } },
        filter: { status: { eq: 'ACTIVE' } },
      });

      expect(result.filter).toBeDefined();
      expect(result.filter?.expression).toContain('=');
    });

    it('should handle between condition', () => {
      const result = query({
        query: { pk: { eq: 'test' }, sk: { between: ['A', 'Z'] } },
      });

      expect(result.query.expression).toContain('BETWEEN');
    });

    it('should handle beginsWith condition', () => {
      const result = query({
        query: { pk: { eq: 'test' }, sk: { beginsWith: 'PREFIX#' } },
      });

      expect(result.query.expression).toContain('begins_with');
    });
  });

  describe('scan', () => {
    it('should build a basic Scan request', () => {
      const result = scan();

      expect(result).toEqual({ operation: 'Scan' });
    });

    it('should include all options', () => {
      const result = scan({
        index: 'GSI1',
        limit: 100,
        filter: { status: { eq: 'ACTIVE' } },
        consistentRead: true,
        projection: ['id', 'name'],
        totalSegments: 4,
        segment: 0,
      });

      expect(result.index).toBe('GSI1');
      expect(result.limit).toBe(100);
      expect(result.filter).toBeDefined();
      expect(result.consistentRead).toBe(true);
      expect(result.projection).toEqual(['id', 'name']);
      expect(result.totalSegments).toBe(4);
      expect(result.segment).toBe(0);
    });
  });

  describe('sync', () => {
    it('should build a basic Sync request', () => {
      const result = sync();

      expect(result).toEqual({ operation: 'Sync' });
    });

    it('should include delta sync options', () => {
      const result = sync({
        basePartitionKey: 'base',
        deltaIndexName: 'delta-index',
        lastSync: 1234567890,
        limit: 50,
      });

      expect(result.basePartitionKey).toBe('base');
      expect(result.deltaIndexName).toBe('delta-index');
      expect(result.lastSync).toBe(1234567890);
      expect(result.limit).toBe(50);
    });
  });

  describe('batchGet', () => {
    it('should build a BatchGetItem request', () => {
      const result = batchGet({
        tables: {
          Users: {
            keys: [{ id: '1' }, { id: '2' }],
            consistentRead: true,
          },
          Posts: {
            keys: [{ id: 'post-1' }],
            projection: ['id', 'title'],
          },
        },
      });

      expect(result.operation).toBe('BatchGetItem');
      expect(result.tables.Users.keys).toHaveLength(2);
      expect(result.tables.Posts.projection).toEqual(['id', 'title']);
    });
  });

  describe('batchPut', () => {
    it('should build a BatchPutItem request', () => {
      const result = batchPut({
        tables: {
          Users: [
            { id: '1', name: 'Alice' },
            { id: '2', name: 'Bob' },
          ],
        },
      });

      expect(result.operation).toBe('BatchPutItem');
      expect(result.tables.Users).toHaveLength(2);
    });
  });

  describe('batchDelete', () => {
    it('should build a BatchDeleteItem request', () => {
      const result = batchDelete({
        tables: {
          Users: [{ id: '1' }, { id: '2' }],
        },
      });

      expect(result.operation).toBe('BatchDeleteItem');
      expect(result.tables.Users).toHaveLength(2);
    });
  });

  describe('transactGet', () => {
    it('should build a TransactGetItems request', () => {
      const result = transactGet({
        items: [
          { table: 'Users', key: { id: '1' } },
          { table: 'Orders', key: { id: 'order-1' }, projection: ['id', 'total'] },
        ],
      });

      expect(result.operation).toBe('TransactGetItems');
      expect(result.transactItems).toHaveLength(2);
      expect(result.transactItems[1].projection).toEqual(['id', 'total']);
    });
  });

  describe('transactWrite', () => {
    it('should build a TransactWriteItems request with put', () => {
      const result = transactWrite({
        items: [
          {
            putItem: {
              table: 'Users',
              key: { id: '1' },
              item: { id: '1', name: 'Test' },
            },
          },
        ],
      });

      expect(result.operation).toBe('TransactWriteItems');
      expect(result.transactItems[0].operation).toBe('PutItem');
    });

    it('should build a TransactWriteItems request with update', () => {
      const result = transactWrite({
        items: [
          {
            updateItem: {
              table: 'Users',
              key: { id: '1' },
              update: { name: 'Updated' },
            },
          },
        ],
      });

      expect(result.transactItems[0].operation).toBe('UpdateItem');
      // Type narrow to check update field
      const item = result.transactItems[0];
      if (item.operation === 'UpdateItem') {
        expect(item.update).toBeDefined();
      }
    });

    it('should build a TransactWriteItems request with delete', () => {
      const result = transactWrite({
        items: [
          {
            deleteItem: {
              table: 'Users',
              key: { id: '1' },
            },
          },
        ],
      });

      expect(result.transactItems[0].operation).toBe('DeleteItem');
    });

    it('should build a TransactWriteItems request with conditionCheck', () => {
      const result = transactWrite({
        items: [
          {
            conditionCheck: {
              table: 'Users',
              key: { id: '1' },
              condition: { status: { eq: 'ACTIVE' } },
            },
          },
        ],
      });

      expect(result.transactItems[0].operation).toBe('ConditionCheck');
      expect(result.transactItems[0].condition).toBeDefined();
    });

    it('should handle mixed transaction items', () => {
      const result = transactWrite({
        items: [
          { putItem: { table: 'T1', key: { id: '1' }, item: { id: '1' } } },
          { updateItem: { table: 'T2', key: { id: '2' }, update: { x: 1 } } },
          { deleteItem: { table: 'T3', key: { id: '3' } } },
        ],
      });

      expect(result.transactItems).toHaveLength(3);
      expect(result.transactItems[0].operation).toBe('PutItem');
      expect(result.transactItems[1].operation).toBe('UpdateItem');
      expect(result.transactItems[2].operation).toBe('DeleteItem');
    });
  });

  describe('operations', () => {
    describe('replace', () => {
      it('should create a replace operation', () => {
        const result = update({
          key: { id: '1' },
          update: [operations.replace('name', 'New Name')],
        });

        expect(result.update.expression).toBe('SET #n0 = :v0');
        expect(result.update.expressionNames?.['#n0']).toBe('name');
        expect(result.update.expressionValues?.[':v0']).toBe('New Name');
      });
    });

    describe('remove', () => {
      it('should create a remove operation', () => {
        const result = update({
          key: { id: '1' },
          update: [operations.remove('deletedField')],
        });

        expect(result.update.expression).toBe('REMOVE #n0');
        expect(result.update.expressionNames?.['#n0']).toBe('deletedField');
      });
    });

    describe('increment', () => {
      it('should create an increment operation', () => {
        const result = update({
          key: { id: '1' },
          update: [operations.increment('viewCount', 1)],
        });

        expect(result.update.expression).toBe('SET #n0 = #n0 + :v0');
        expect(result.update.expressionNames?.['#n0']).toBe('viewCount');
        expect(result.update.expressionValues?.[':v0']).toBe(1);
      });

      it('should default to increment by 1', () => {
        const result = update({
          key: { id: '1' },
          update: [operations.increment('count')],
        });

        expect(result.update.expressionValues?.[':v0']).toBe(1);
      });
    });

    describe('decrement', () => {
      it('should create a decrement operation', () => {
        const result = update({
          key: { id: '1' },
          update: [operations.decrement('stock', 5)],
        });

        expect(result.update.expression).toBe('SET #n0 = #n0 - :v0');
        expect(result.update.expressionNames?.['#n0']).toBe('stock');
        expect(result.update.expressionValues?.[':v0']).toBe(5);
      });
    });

    describe('append', () => {
      it('should create an append operation', () => {
        const result = update({
          key: { id: '1' },
          update: [operations.append('tags', ['new-tag'])],
        });

        expect(result.update.expression).toBe('SET #n0 = list_append(#n0, :v0)');
        expect(result.update.expressionValues?.[':v0']).toEqual(['new-tag']);
      });
    });

    describe('prepend', () => {
      it('should create a prepend operation', () => {
        const result = update({
          key: { id: '1' },
          update: [operations.prepend('history', ['latest'])],
        });

        expect(result.update.expression).toBe('SET #n0 = list_append(:v0, #n0)');
        expect(result.update.expressionValues?.[':v0']).toEqual(['latest']);
      });
    });

    describe('add', () => {
      it('should create an add operation (if_not_exists)', () => {
        const result = update({
          key: { id: '1' },
          update: [operations.add('defaultValue', 100)],
        });

        expect(result.update.expression).toBe('SET #n0 = if_not_exists(#n0, :v0)');
        expect(result.update.expressionValues?.[':v0']).toBe(100);
      });
    });

    describe('updateListItem', () => {
      it('should create an updateListItem operation', () => {
        const result = update({
          key: { id: '1' },
          update: [operations.updateListItem('items', 'updated value', 2)],
        });

        expect(result.update.expression).toBe('SET #n0[2] = :v0');
        expect(result.update.expressionValues?.[':v0']).toBe('updated value');
      });
    });

    describe('multiple operations', () => {
      it('should combine multiple SET operations', () => {
        const result = update({
          key: { id: '1' },
          update: [
            operations.replace('name', 'New'),
            operations.increment('count', 1),
            operations.append('tags', ['tag']),
          ],
        });

        expect(result.update.expression).toContain('SET');
        // Should have 3 operations in SET clause
        expect(result.update.expressionNames).toHaveProperty('#n0', 'name');
        expect(result.update.expressionNames).toHaveProperty('#n1', 'count');
        expect(result.update.expressionNames).toHaveProperty('#n2', 'tags');
      });

      it('should combine SET and REMOVE operations', () => {
        const result = update({
          key: { id: '1' },
          update: [operations.replace('name', 'New'), operations.remove('oldField')],
        });

        expect(result.update.expression).toContain('SET');
        expect(result.update.expression).toContain('REMOVE');
      });
    });
  });

  describe('Type Converters', () => {
    describe('toStringSet', () => {
      it('should convert array to DynamoDB string set', () => {
        const result = toStringSet(['a', 'b', 'c']);

        expect(result).toEqual({ SS: ['a', 'b', 'c'] });
      });
    });

    describe('toNumberSet', () => {
      it('should convert array to DynamoDB number set', () => {
        const result = toNumberSet([1, 2, 3]);

        expect(result).toEqual({ NS: ['1', '2', '3'] });
      });

      it('should handle decimals', () => {
        const result = toNumberSet([1.5, 2.75]);

        expect(result).toEqual({ NS: ['1.5', '2.75'] });
      });
    });

    describe('toBinarySet', () => {
      it('should convert array to DynamoDB binary set', () => {
        const result = toBinarySet(['base64data1', 'base64data2']);

        expect(result).toEqual({ BS: ['base64data1', 'base64data2'] });
      });
    });
  });

  describe('Filter expressions', () => {
    it('should handle eq condition', () => {
      const result = query({
        query: { pk: { eq: 'test' } },
        filter: { status: { eq: 'ACTIVE' } },
      });

      expect(result.filter?.expression).toContain('=');
    });

    it('should handle ne condition', () => {
      const result = scan({
        filter: { status: { ne: 'DELETED' } },
      });

      expect(result.filter?.expression).toContain('<>');
    });

    it('should handle comparison conditions', () => {
      const result = scan({
        filter: {
          age: { gt: 18 },
          score: { le: 100 },
        },
      });

      expect(result.filter?.expression).toContain('>');
      expect(result.filter?.expression).toContain('<=');
    });

    it('should handle contains condition', () => {
      const result = scan({
        filter: { tags: { contains: 'important' } },
      });

      expect(result.filter?.expression).toContain('contains');
    });

    it('should handle attributeExists condition', () => {
      const result = scan({
        filter: { email: { attributeExists: true } },
      });

      expect(result.filter?.expression).toContain('attribute_exists');
    });

    it('should handle attributeExists false condition', () => {
      const result = scan({
        filter: { deletedAt: { attributeExists: false } },
      });

      expect(result.filter?.expression).toContain('attribute_not_exists');
    });

    it('should handle between condition in filter', () => {
      const result = scan({
        filter: { price: { between: [10, 100] } },
      });

      expect(result.filter?.expression).toContain('BETWEEN');
    });

    it('should handle beginsWith condition in filter', () => {
      const result = scan({
        filter: { name: { beginsWith: 'Test' } },
      });

      expect(result.filter?.expression).toContain('begins_with');
    });

    it('should combine multiple filter conditions with AND', () => {
      const result = scan({
        filter: {
          status: { eq: 'ACTIVE' },
          age: { gt: 18 },
        },
      });

      expect(result.filter?.expression).toContain('AND');
    });
  });
});
