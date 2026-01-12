import { describe, expect, it } from '@jest/globals';

describe('AppSync Utils Shim', () => {
  describe('exports', () => {
    it('should export util object', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      expect(util).toBeDefined();
      expect(typeof util).toBe('object');
    });

    it('should export runtime object', async () => {
      const { runtime } = await import('../../src/appsyncUtilsShim.js');
      expect(runtime).toBeDefined();
      expect(typeof runtime).toBe('object');
    });

    it('should export extensions object', async () => {
      const { extensions } = await import('../../src/appsyncUtilsShim.js');
      expect(extensions).toBeDefined();
      expect(typeof extensions).toBe('object');
    });
  });

  describe('util functions', () => {
    it('should have autoId function', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      expect(typeof util.autoId).toBe('function');
    });

    it('should generate unique IDs with autoId', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      const id1 = util.autoId();
      const id2 = util.autoId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      // Should be UUID format
      expect(id1).toMatch(/^[a-f0-9-]{36}$/);
    });

    it('should have time utilities', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      expect(util.time).toBeDefined();
      expect(typeof util.time.nowISO8601).toBe('function');
      expect(typeof util.time.nowEpochSeconds).toBe('function');
      expect(typeof util.time.nowEpochMilliSeconds).toBe('function');
    });

    it('should return valid ISO8601 timestamp', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      const timestamp = util.time.nowISO8601();

      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should return epoch seconds as number', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      const seconds = util.time.nowEpochSeconds();

      expect(typeof seconds).toBe('number');
      expect(seconds).toBeGreaterThan(1700000000); // After 2023
    });

    it('should have error function', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      expect(typeof util.error).toBe('function');
    });

    it('should have appendError function', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      expect(typeof util.appendError).toBe('function');
    });

    it('should have transform utilities', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      expect(util.transform).toBeDefined();
      expect(typeof util.transform.toSubscriptionFilter).toBe('function');
    });

    it('should have base64 encode/decode', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      expect(typeof util.base64Encode).toBe('function');
      expect(typeof util.base64Decode).toBe('function');

      const original = 'Hello World';
      const encoded = util.base64Encode(original);
      const decoded = util.base64Decode(encoded);

      expect(decoded).toBe(original);
    });

    it('should have urlEncode/urlDecode', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      expect(typeof util.urlEncode).toBe('function');
      expect(typeof util.urlDecode).toBe('function');

      const original = 'hello world&foo=bar';
      const encoded = util.urlEncode(original);
      const decoded = util.urlDecode(encoded);

      expect(decoded).toBe(original);
    });
  });

  describe('runtime functions', () => {
    it('should have earlyReturn function', async () => {
      const { runtime } = await import('../../src/appsyncUtilsShim.js');
      expect(typeof runtime.earlyReturn).toBe('function');
    });

    it('should throw special error on earlyReturn', async () => {
      const { runtime } = await import('../../src/appsyncUtilsShim.js');

      try {
        runtime.earlyReturn({ result: 'early' });
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect((e as Error).message).toBe('EarlyReturn');
        expect((e as { data: unknown }).data).toEqual({ result: 'early' });
      }
    });
  });

  describe('extensions functions', () => {
    it('should have setSubscriptionFilter function', async () => {
      const { extensions } = await import('../../src/appsyncUtilsShim.js');
      expect(typeof extensions.setSubscriptionFilter).toBe('function');
    });

    it('should have setSubscriptionInvalidationFilter function', async () => {
      const { extensions } = await import('../../src/appsyncUtilsShim.js');
      expect(typeof extensions.setSubscriptionInvalidationFilter).toBe('function');
    });

    it('should have invalidateSubscriptions function', async () => {
      const { extensions } = await import('../../src/appsyncUtilsShim.js');
      expect(typeof extensions.invalidateSubscriptions).toBe('function');
    });

    it('should have evictFromApiCache function', async () => {
      const { extensions } = await import('../../src/appsyncUtilsShim.js');
      expect(typeof extensions.evictFromApiCache).toBe('function');
    });
  });

  describe('util.str functions', () => {
    it('should have string utilities', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      expect(util.str).toBeDefined();
      expect(typeof util.str.toUpper).toBe('function');
      expect(typeof util.str.toLower).toBe('function');
      expect(typeof util.str.toReplace).toBe('function');
      expect(typeof util.str.normalize).toBe('function');
    });

    it('should convert to uppercase', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      expect(util.str.toUpper('hello')).toBe('HELLO');
    });

    it('should convert to lowercase', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      expect(util.str.toLower('HELLO')).toBe('hello');
    });

    it('should replace strings', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      expect(util.str.toReplace('hello world', 'world', 'there')).toBe('hello there');
    });
  });

  describe('util.math functions', () => {
    it('should have math utilities', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      expect(util.math).toBeDefined();
      expect(typeof util.math.roundNum).toBe('function');
      expect(typeof util.math.minVal).toBe('function');
      expect(typeof util.math.maxVal).toBe('function');
      expect(typeof util.math.randomDouble).toBe('function');
      expect(typeof util.math.randomWithinRange).toBe('function');
    });

    it('should round numbers', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      expect(util.math.roundNum(3.7)).toBe(4);
      expect(util.math.roundNum(3.2)).toBe(3);
    });

    it('should find min value', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      expect(util.math.minVal([5, 3, 8, 1])).toBe(1);
    });

    it('should find max value', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      expect(util.math.maxVal([5, 3, 8, 1])).toBe(8);
    });

    it('should generate random double between 0 and 1', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      const rand = util.math.randomDouble();
      expect(rand).toBeGreaterThanOrEqual(0);
      expect(rand).toBeLessThan(1);
    });

    it('should generate random within range', async () => {
      const { util } = await import('../../src/appsyncUtilsShim.js');
      const rand = util.math.randomWithinRange(10, 20);
      expect(rand).toBeGreaterThanOrEqual(10);
      expect(rand).toBeLessThanOrEqual(20);
    });
  });
});
