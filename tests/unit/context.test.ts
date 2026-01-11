import { describe, expect, it } from '@jest/globals';
import { createContext, decodeJwt, extractIdentityFromHeaders } from '../../src/context.js';

describe('Context', () => {
  describe('createContext', () => {
    it('should create context with arguments', () => {
      const ctx = createContext({ id: '123', name: 'Test' });
      expect(ctx.arguments).toEqual({ id: '123', name: 'Test' });
    });

    it('should initialize empty stash', () => {
      const ctx = createContext({});
      expect(ctx.stash).toEqual({});
    });

    it('should allow stash modifications', () => {
      const ctx = createContext({});
      ctx.stash.key = 'value';
      expect(ctx.stash.key).toBe('value');
    });

    it('should initialize prev as empty object', () => {
      const ctx = createContext({});
      expect(ctx.prev).toEqual({});
    });

    it('should provide env from process.env', () => {
      const ctx = createContext({});
      expect(ctx.env).toBeDefined();
    });
  });

  describe('util.time', () => {
    it('should return current timestamp with nowISO8601', () => {
      const ctx = createContext({});
      const iso = ctx.util.time.nowISO8601();
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should return epoch milliseconds with nowEpochMilliSeconds', () => {
      const ctx = createContext({});
      const now = Date.now();
      const epoch = ctx.util.time.nowEpochMilliSeconds();
      expect(epoch).toBeGreaterThanOrEqual(now - 100);
      expect(epoch).toBeLessThanOrEqual(now + 100);
    });

    it('should return epoch seconds with nowEpochSeconds', () => {
      const ctx = createContext({});
      const nowSeconds = Math.floor(Date.now() / 1000);
      const epoch = ctx.util.time.nowEpochSeconds();
      expect(epoch).toBeGreaterThanOrEqual(nowSeconds - 1);
      expect(epoch).toBeLessThanOrEqual(nowSeconds + 1);
    });

    it('should format date with nowFormatted', () => {
      const ctx = createContext({});
      const formatted = ctx.util.time.nowFormatted('yyyy-MM-dd');
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should parse ISO date with parseISO8601ToEpochMilliSeconds', () => {
      const ctx = createContext({});
      const epoch = ctx.util.time.parseISO8601ToEpochMilliSeconds('2024-01-01T00:00:00.000Z');
      expect(epoch).toBe(1704067200000);
    });

    it('should convert epoch to ISO with epochMilliSecondsToISO8601', () => {
      const ctx = createContext({});
      const iso = ctx.util.time.epochMilliSecondsToISO8601(1704067200000);
      expect(iso).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should convert epoch millis to seconds', () => {
      const ctx = createContext({});
      const seconds = ctx.util.time.epochMilliSecondsToSeconds(1704067200000);
      expect(seconds).toBe(1704067200);
    });
  });

  describe('util.autoId', () => {
    it('should generate unique IDs', () => {
      const ctx = createContext({});
      const id1 = ctx.util.autoId();
      const id2 = ctx.util.autoId();
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    it('should generate UUID format', () => {
      const ctx = createContext({});
      const id = ctx.util.autoId();
      expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
    });
  });

  describe('util.autoUlid', () => {
    it('should generate ULID-like string', () => {
      const ctx = createContext({});
      const ulid = ctx.util.autoUlid();
      expect(ulid).toHaveLength(26);
    });

    it('should generate unique ULIDs', () => {
      const ctx = createContext({});
      const ulid1 = ctx.util.autoUlid();
      const ulid2 = ctx.util.autoUlid();
      expect(ulid1).not.toBe(ulid2);
    });
  });

  describe('util.autoKsuid', () => {
    it('should generate KSUID-like string', () => {
      const ctx = createContext({});
      const ksuid = ctx.util.autoKsuid();
      expect(ksuid.length).toBeGreaterThan(0);
    });
  });

  describe('util.error', () => {
    it('should throw error with message', () => {
      const ctx = createContext({});
      expect(() => ctx.util.error('Test error')).toThrow('Test error');
    });

    it('should throw error with type', () => {
      const ctx = createContext({});
      try {
        ctx.util.error('Test error', 'ValidationError');
      } catch (e) {
        expect((e as Error).message).toBe('Test error');
        expect((e as Error & { type?: string }).type).toBe('ValidationError');
      }
    });
  });

  describe('util.unauthorized', () => {
    it('should throw Unauthorized error', () => {
      const ctx = createContext({});
      try {
        ctx.util.unauthorized();
      } catch (e) {
        expect((e as Error).message).toBe('Unauthorized');
        expect((e as Error & { type?: string }).type).toBe('Unauthorized');
      }
    });
  });

  describe('util.appendError', () => {
    it('should not throw', () => {
      const ctx = createContext({});
      expect(() => ctx.util.appendError('Non-fatal error')).not.toThrow();
    });
  });

  describe('util.base64Encode/Decode', () => {
    it('should encode to base64', () => {
      const ctx = createContext({});
      expect(ctx.util.base64Encode('Hello World')).toBe('SGVsbG8gV29ybGQ=');
    });

    it('should decode from base64', () => {
      const ctx = createContext({});
      expect(ctx.util.base64Decode('SGVsbG8gV29ybGQ=')).toBe('Hello World');
    });

    it('should round-trip encode/decode', () => {
      const ctx = createContext({});
      const original = 'Test data with special chars: äöü';
      expect(ctx.util.base64Decode(ctx.util.base64Encode(original))).toBe(original);
    });
  });

  describe('util.urlEncode/Decode', () => {
    it('should encode URL', () => {
      const ctx = createContext({});
      expect(ctx.util.urlEncode('hello world')).toBe('hello%20world');
    });

    it('should decode URL', () => {
      const ctx = createContext({});
      expect(ctx.util.urlDecode('hello%20world')).toBe('hello world');
    });

    it('should encode special characters', () => {
      const ctx = createContext({});
      expect(ctx.util.urlEncode('a=b&c=d')).toBe('a%3Db%26c%3Dd');
    });
  });

  describe('util.matches', () => {
    it('should match regex pattern', () => {
      const ctx = createContext({});
      expect(ctx.util.matches('^[a-z]+$', 'hello')).toBe(true);
      expect(ctx.util.matches('^[a-z]+$', 'Hello')).toBe(false);
    });

    it('should support complex patterns', () => {
      const ctx = createContext({});
      expect(ctx.util.matches('^[\\w._%+-]+@[\\w.-]+\\.[a-zA-Z]{2,}$', 'test@example.com')).toBe(true);
    });
  });

  describe('util.escapeJavaScript', () => {
    it('should escape quotes', () => {
      const ctx = createContext({});
      expect(ctx.util.escapeJavaScript("it's")).toBe("it\\'s");
      expect(ctx.util.escapeJavaScript('say "hello"')).toBe('say \\"hello\\"');
    });

    it('should escape newlines', () => {
      const ctx = createContext({});
      expect(ctx.util.escapeJavaScript('line1\nline2')).toBe('line1\\nline2');
    });

    it('should escape backslashes', () => {
      const ctx = createContext({});
      expect(ctx.util.escapeJavaScript('path\\to\\file')).toBe('path\\\\to\\\\file');
    });
  });

  describe('util.isNull/isNullOrEmpty/isNullOrBlank', () => {
    it('should detect null values', () => {
      const ctx = createContext({});
      expect(ctx.util.isNull(null)).toBe(true);
      expect(ctx.util.isNull(undefined)).toBe(true);
      expect(ctx.util.isNull('')).toBe(false);
      expect(ctx.util.isNull(0)).toBe(false);
    });

    it('should detect null or empty', () => {
      const ctx = createContext({});
      expect(ctx.util.isNullOrEmpty(null)).toBe(true);
      expect(ctx.util.isNullOrEmpty('')).toBe(true);
      expect(ctx.util.isNullOrEmpty([])).toBe(true);
      expect(ctx.util.isNullOrEmpty('hello')).toBe(false);
      expect(ctx.util.isNullOrEmpty([1])).toBe(false);
    });

    it('should detect null or blank', () => {
      const ctx = createContext({});
      expect(ctx.util.isNullOrBlank(null)).toBe(true);
      expect(ctx.util.isNullOrBlank('   ')).toBe(true);
      expect(ctx.util.isNullOrBlank('')).toBe(true);
      expect(ctx.util.isNullOrBlank('hello')).toBe(false);
    });
  });

  describe('util.defaultIfNull variants', () => {
    it('should return default if null', () => {
      const ctx = createContext({});
      expect(ctx.util.defaultIfNull(null, 'default')).toBe('default');
      expect(ctx.util.defaultIfNull(undefined, 'default')).toBe('default');
      expect(ctx.util.defaultIfNull('value', 'default')).toBe('value');
    });

    it('should return default if null or empty', () => {
      const ctx = createContext({});
      expect(ctx.util.defaultIfNullOrEmpty('', 'default')).toBe('default');
      expect(ctx.util.defaultIfNullOrEmpty([] as string[], ['fallback'])).toEqual(['fallback']);
      expect(ctx.util.defaultIfNullOrEmpty('value', 'default')).toBe('value');
    });

    it('should return default if null or blank', () => {
      const ctx = createContext({});
      expect(ctx.util.defaultIfNullOrBlank('   ', 'default')).toBe('default');
      expect(ctx.util.defaultIfNullOrBlank('value', 'default')).toBe('value');
    });
  });

  describe('util.typeOf', () => {
    it('should return correct type names', () => {
      const ctx = createContext({});
      expect(ctx.util.typeOf(null)).toBe('Null');
      expect(ctx.util.typeOf('hello')).toBe('String');
      expect(ctx.util.typeOf(123)).toBe('Number');
      expect(ctx.util.typeOf(true)).toBe('Boolean');
      expect(ctx.util.typeOf([])).toBe('List');
      expect(ctx.util.typeOf({})).toBe('Map');
    });
  });

  describe('util.str', () => {
    it('should convert to lower case', () => {
      const ctx = createContext({});
      expect(ctx.util.str.toLower('HELLO')).toBe('hello');
    });

    it('should convert to upper case', () => {
      const ctx = createContext({});
      expect(ctx.util.str.toUpper('hello')).toBe('HELLO');
    });

    it('should replace strings', () => {
      const ctx = createContext({});
      expect(ctx.util.str.toReplace('hello world', 'world', 'there')).toBe('hello there');
    });

    it('should normalize strings', () => {
      const ctx = createContext({});
      const result = ctx.util.str.normalize('cafe\u0301', 'NFC');
      expect(result).toBe('caf\u00e9');
    });
  });

  describe('util.math', () => {
    it('should round numbers', () => {
      const ctx = createContext({});
      expect(ctx.util.math.roundNum(2.5678, 2)).toBe(2.57);
      expect(ctx.util.math.roundNum(7.9, 0)).toBe(8);
    });

    it('should find min value', () => {
      const ctx = createContext({});
      expect(ctx.util.math.minVal([5, 2, 8, 1, 9])).toBe(1);
    });

    it('should find max value', () => {
      const ctx = createContext({});
      expect(ctx.util.math.maxVal([5, 2, 8, 1, 9])).toBe(9);
    });

    it('should generate random double between 0 and 1', () => {
      const ctx = createContext({});
      const random = ctx.util.math.randomDouble();
      expect(random).toBeGreaterThanOrEqual(0);
      expect(random).toBeLessThan(1);
    });

    it('should generate random within range', () => {
      const ctx = createContext({});
      const random = ctx.util.math.randomWithinRange(10, 20);
      expect(random).toBeGreaterThanOrEqual(10);
      expect(random).toBeLessThan(20);
    });
  });

  describe('util.transform', () => {
    it('should convert to JSON string', () => {
      const ctx = createContext({});
      const json = ctx.util.transform.toJson({ key: 'value' });
      expect(json).toBe('{"key":"value"}');
    });

    it('should handle arrays', () => {
      const ctx = createContext({});
      const json = ctx.util.transform.toJson([1, 2, 3]);
      expect(json).toBe('[1,2,3]');
    });

    it('should pretty print JSON', () => {
      const ctx = createContext({});
      const json = ctx.util.transform.toJsonPretty({ key: 'value' });
      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });
  });

  describe('util.dynamodb', () => {
    it('should convert string to DynamoDB format', () => {
      const ctx = createContext({});
      expect(ctx.util.dynamodb.toString('hello')).toEqual({ S: 'hello' });
    });

    it('should convert string set', () => {
      const ctx = createContext({});
      expect(ctx.util.dynamodb.toStringSet(['a', 'b'])).toEqual({ SS: ['a', 'b'] });
    });

    it('should convert number to DynamoDB format', () => {
      const ctx = createContext({});
      expect(ctx.util.dynamodb.toNumber(42)).toEqual({ N: '42' });
    });

    it('should convert number set', () => {
      const ctx = createContext({});
      expect(ctx.util.dynamodb.toNumberSet([1, 2, 3])).toEqual({ NS: ['1', '2', '3'] });
    });

    it('should convert boolean', () => {
      const ctx = createContext({});
      expect(ctx.util.dynamodb.toBoolean(true)).toEqual({ BOOL: true });
      expect(ctx.util.dynamodb.toBoolean(false)).toEqual({ BOOL: false });
    });

    it('should convert null', () => {
      const ctx = createContext({});
      expect(ctx.util.dynamodb.toNull()).toEqual({ NULL: true });
    });

    it('should convert binary', () => {
      const ctx = createContext({});
      expect(ctx.util.dynamodb.toBinary('base64data')).toEqual({ B: 'base64data' });
    });

    it('should convert binary set', () => {
      const ctx = createContext({});
      expect(ctx.util.dynamodb.toBinarySet(['a', 'b'])).toEqual({ BS: ['a', 'b'] });
    });

    it('should convert list with nested types', () => {
      const ctx = createContext({});
      const result = ctx.util.dynamodb.toList(['hello', 42]);
      expect(result).toEqual({
        L: [{ S: 'hello' }, { N: '42' }],
      });
    });

    it('should convert map with nested types', () => {
      const ctx = createContext({});
      const result = ctx.util.dynamodb.toMap({ name: 'test', count: 5 });
      expect(result).toEqual({
        M: {
          name: { S: 'test' },
          count: { N: '5' },
        },
      });
    });

    it('should create S3 object reference', () => {
      const ctx = createContext({});
      const result = ctx.util.dynamodb.toS3Object('mykey', 'mybucket', 'us-east-1', 'v1');
      expect(result).toEqual({
        key: 'mykey',
        bucket: 'mybucket',
        region: 'us-east-1',
        version: 'v1',
      });
    });

    it('should parse S3 object JSON', () => {
      const ctx = createContext({});
      const s3Json = JSON.stringify({ s3: { key: 'k', bucket: 'b', region: 'r' } });
      const result = ctx.util.dynamodb.fromS3ObjectJson(s3Json);
      expect(result).toEqual({ key: 'k', bucket: 'b', region: 'r' });
    });

    it('should use toDynamoDB for complex objects', () => {
      const ctx = createContext({});
      const result = ctx.util.dynamodb.toDynamoDB({ name: 'test', active: true, count: 5 });
      expect(result).toEqual({
        M: {
          name: { S: 'test' },
          active: { BOOL: true },
          count: { N: '5' },
        },
      });
    });
  });

  describe('util.http', () => {
    it('should copy headers', () => {
      const ctx = createContext({});
      const headers = { 'Content-Type': 'application/json' };
      const copied = ctx.util.http.copyHeaders(headers);
      expect(copied).toEqual(headers);
      expect(copied).not.toBe(headers); // Should be a new object
    });

    it('should add response header', () => {
      const ctx = createContext({});
      ctx.util.http.addResponseHeader('X-Custom', 'value');
      // Headers are stored internally - this just tests it doesn't throw
    });

    it('should add multiple response headers', () => {
      const ctx = createContext({});
      ctx.util.http.addResponseHeaders({ 'X-One': '1', 'X-Two': '2' });
      // Headers are stored internally - this just tests it doesn't throw
    });
  });

  describe('util.xml', () => {
    it('should parse simple XML to map', () => {
      const ctx = createContext({});
      const xml = '<root><name>Test</name><value>123</value></root>';
      const result = ctx.util.xml.toMap(xml);
      expect(result.name).toBe('Test');
      expect(result.value).toBe('123');
    });

    it('should convert XML to JSON string', () => {
      const ctx = createContext({});
      const xml = '<data><id>1</id></data>';
      const json = ctx.util.xml.toJsonString(xml);
      expect(JSON.parse(json)).toEqual({ id: '1' });
    });
  });

  describe('util.authType', () => {
    it('should return auth type string', () => {
      const ctx = createContext({});
      expect(ctx.util.authType()).toBe('API Key Authorization');
    });
  });

  describe('createContext with full options', () => {
    it('should create context with source (for nested resolvers)', () => {
      const ctx = createContext({
        arguments: { id: '123' },
        source: { taskType: 'bug', priority: 'high' },
      });
      expect(ctx.arguments).toEqual({ id: '123' });
      expect(ctx.source).toEqual({ taskType: 'bug', priority: 'high' });
    });

    it('should create context with identity', () => {
      const ctx = createContext({
        arguments: {},
        identity: {
          sub: 'user-123',
          username: 'testuser',
          claims: { role: 'admin' },
        },
      });
      expect(ctx.identity?.sub).toBe('user-123');
      expect(ctx.identity?.username).toBe('testuser');
      expect(ctx.identity?.claims?.role).toBe('admin');
    });

    it('should create context with request headers', () => {
      const ctx = createContext({
        arguments: {},
        request: {
          headers: { 'content-type': 'application/json', 'x-custom': 'value' },
          domainName: 'api.example.com',
        },
      });
      expect(ctx.request?.headers['content-type']).toBe('application/json');
      expect(ctx.request?.domainName).toBe('api.example.com');
    });

    it('should create context with info', () => {
      const ctx = createContext({
        arguments: { id: '1' },
        info: {
          fieldName: 'getTask',
          parentTypeName: 'Query',
          variables: { limit: 10 },
        },
      });
      expect(ctx.info?.fieldName).toBe('getTask');
      expect(ctx.info?.parentTypeName).toBe('Query');
      expect(ctx.info?.variables?.limit).toBe(10);
    });

    it('should preserve stash across context', () => {
      const ctx = createContext({
        arguments: {},
        stash: { cachedData: 'value' },
      });
      expect(ctx.stash.cachedData).toBe('value');
    });
  });

  describe('decodeJwt', () => {
    // Test JWT: header.payload.signature
    // Payload: { "sub": "1234567890", "name": "Test User", "iat": 1516239022 }
    const testJwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

    it('should decode a valid JWT', () => {
      const identity = decodeJwt(testJwt);
      expect(identity).not.toBeNull();
      expect(identity?.sub).toBe('1234567890');
      expect(identity?.claims?.name).toBe('Test User');
    });

    it('should handle Bearer prefix', () => {
      const identity = decodeJwt(`Bearer ${testJwt}`);
      expect(identity).not.toBeNull();
      expect(identity?.sub).toBe('1234567890');
    });

    it('should return null for invalid JWT', () => {
      expect(decodeJwt('invalid')).toBeNull();
      expect(decodeJwt('only.two.parts')).toBeNull();
      expect(decodeJwt('')).toBeNull();
    });

    it('should return null for malformed base64', () => {
      expect(decodeJwt('a.!!!invalid!!!.c')).toBeNull();
    });
  });

  describe('extractIdentityFromHeaders', () => {
    const testJwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

    it('should extract identity from Authorization header', () => {
      const identity = extractIdentityFromHeaders({
        Authorization: `Bearer ${testJwt}`,
      });
      expect(identity?.sub).toBe('1234567890');
    });

    it('should handle lowercase authorization header', () => {
      const identity = extractIdentityFromHeaders({
        authorization: `Bearer ${testJwt}`,
      });
      expect(identity?.sub).toBe('1234567890');
    });

    it('should extract identity from x-api-key header', () => {
      const identity = extractIdentityFromHeaders({
        'x-api-key': 'my-api-key',
      });
      expect(identity?.sub).toBe('api-key-user');
      expect(identity?.claims?.authType).toBe('API_KEY');
    });

    it('should return undefined for no auth headers', () => {
      const identity = extractIdentityFromHeaders({
        'content-type': 'application/json',
      });
      expect(identity).toBeUndefined();
    });

    it('should prefer JWT over API key', () => {
      const identity = extractIdentityFromHeaders({
        Authorization: `Bearer ${testJwt}`,
        'x-api-key': 'my-api-key',
      });
      expect(identity?.sub).toBe('1234567890'); // JWT sub, not api-key-user
    });
  });
});
