import { createContext } from '../../src/context.js';

describe('util.transform.toSubscriptionFilter()', () => {
  it('should convert simple values to eq filter', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toSubscriptionFilter({
      userId: '123',
      status: 'active',
    });

    expect(result).toEqual({
      userId: { eq: '123' },
      status: { eq: 'active' },
    });
  });

  it('should preserve existing filter format', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toSubscriptionFilter({
      userId: { eq: '123' },
      count: { gt: 10 },
    });

    expect(result).toEqual({
      userId: { eq: '123' },
      count: { gt: 10 },
    });
  });

  it('should handle mixed simple and filter values', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toSubscriptionFilter({
      userId: '123',
      count: { gte: 5 },
      status: 'active',
    });

    expect(result).toEqual({
      userId: { eq: '123' },
      count: { gte: 5 },
      status: { eq: 'active' },
    });
  });

  it('should handle numeric values', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toSubscriptionFilter({
      count: 42,
    });

    expect(result).toEqual({
      count: { eq: 42 },
    });
  });

  it('should handle boolean values', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toSubscriptionFilter({
      isActive: true,
    });

    expect(result).toEqual({
      isActive: { eq: true },
    });
  });
});

describe('util.transform.toDynamoDBFilterExpression()', () => {
  it('should generate simple equality expression', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toDynamoDBFilterExpression({
      userId: '123',
    });

    expect(result.expression).toBe('#f0 = :v0');
    expect(result.expressionNames).toEqual({ '#f0': 'userId' });
    expect(result.expressionValues).toEqual({ ':v0': '123' });
  });

  it('should generate eq filter expression', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toDynamoDBFilterExpression({
      status: { eq: 'active' },
    });

    expect(result.expression).toBe('#f0 = :v0');
    expect(result.expressionNames).toEqual({ '#f0': 'status' });
    expect(result.expressionValues).toEqual({ ':v0': 'active' });
  });

  it('should generate ne filter expression', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toDynamoDBFilterExpression({
      status: { ne: 'deleted' },
    });

    expect(result.expression).toBe('#f0 <> :v0');
  });

  it('should generate comparison expressions', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toDynamoDBFilterExpression({
      count: { gt: 10 },
    });

    expect(result.expression).toBe('#f0 > :v0');
    expect(result.expressionValues[':v0']).toBe(10);
  });

  it('should generate lt expression', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toDynamoDBFilterExpression({
      age: { lt: 18 },
    });

    expect(result.expression).toBe('#f0 < :v0');
  });

  it('should generate le expression', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toDynamoDBFilterExpression({
      price: { le: 100 },
    });

    expect(result.expression).toBe('#f0 <= :v0');
  });

  it('should generate ge expression', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toDynamoDBFilterExpression({
      rating: { ge: 4 },
    });

    expect(result.expression).toBe('#f0 >= :v0');
  });

  it('should generate contains expression', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toDynamoDBFilterExpression({
      name: { contains: 'John' },
    });

    expect(result.expression).toBe('contains(#f0, :v0)');
    expect(result.expressionValues[':v0']).toBe('John');
  });

  it('should generate begins_with expression', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toDynamoDBFilterExpression({
      email: { beginsWith: 'admin@' },
    });

    expect(result.expression).toBe('begins_with(#f0, :v0)');
    expect(result.expressionValues[':v0']).toBe('admin@');
  });

  it('should generate between expression', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toDynamoDBFilterExpression({
      age: { between: [18, 65] },
    });

    expect(result.expression).toBe('#f0 BETWEEN :v0 AND :v1');
    expect(result.expressionValues[':v0']).toBe(18);
    expect(result.expressionValues[':v1']).toBe(65);
  });

  it('should combine multiple filters with AND', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toDynamoDBFilterExpression({
      status: { eq: 'active' },
      age: { gt: 18 },
    });

    expect(result.expression).toContain(' AND ');
    expect(Object.keys(result.expressionNames)).toHaveLength(2);
    expect(Object.keys(result.expressionValues)).toHaveLength(2);
  });
});

describe('util.transform.toDynamoDBConditionExpression()', () => {
  it('should generate simple equality condition', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toDynamoDBConditionExpression({
      version: 1,
    });

    expect(result.expression).toBe('#c0 = :v0');
    expect(result.expressionNames).toEqual({ '#c0': 'version' });
    expect(result.expressionValues).toEqual({ ':v0': 1 });
  });

  it('should generate eq condition', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toDynamoDBConditionExpression({
      status: { eq: 'pending' },
    });

    expect(result.expression).toBe('#c0 = :v0');
  });

  it('should generate ne condition', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toDynamoDBConditionExpression({
      status: { ne: 'deleted' },
    });

    expect(result.expression).toBe('#c0 <> :v0');
  });

  it('should generate attribute_exists condition', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toDynamoDBConditionExpression({
      id: { attributeExists: true },
    });

    expect(result.expression).toBe('attribute_exists(#c0)');
  });

  it('should generate attribute_not_exists condition', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toDynamoDBConditionExpression({
      deletedAt: { attributeExists: false },
    });

    expect(result.expression).toBe('attribute_not_exists(#c0)');
  });

  it('should combine multiple conditions with AND', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toDynamoDBConditionExpression({
      version: { eq: 1 },
      status: { ne: 'deleted' },
    });

    expect(result.expression).toContain(' AND ');
    expect(Object.keys(result.expressionNames)).toHaveLength(2);
  });
});

describe('util.transform.toJson()', () => {
  it('should convert object to JSON string', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toJson({ name: 'test', count: 42 });

    expect(result).toBe('{"name":"test","count":42}');
  });

  it('should handle arrays', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toJson([1, 2, 3]);

    expect(result).toBe('[1,2,3]');
  });

  it('should handle null', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toJson(null);

    expect(result).toBe('null');
  });
});

describe('util.transform.toJsonPretty()', () => {
  it('should convert object to pretty JSON string', () => {
    const ctx = createContext({ arguments: {} });

    const result = ctx.util.transform.toJsonPretty({ name: 'test' });

    expect(result).toContain('\n');
    expect(result).toContain('  ');
  });
});
