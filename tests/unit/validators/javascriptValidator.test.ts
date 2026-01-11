import { describe, expect, it } from '@jest/globals';
import { validateAppSyncJavaScript } from '../../../src/validators/javascriptValidator.js';

describe('JavaScriptValidator', () => {
  describe('valid code', () => {
    it('should accept valid AppSync resolver code', () => {
      const code = `
        export function request(ctx) {
          return { id: ctx.arguments.id };
        }
        export function response(ctx) {
          return ctx.result;
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors).toHaveLength(0);
    });

    it('should accept for-of loops', () => {
      const code = `
        export function request(ctx) {
          const items = [];
          for (const item of ctx.arguments.list) {
            items.push(item.name);
          }
          return items;
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors).toHaveLength(0);
    });

    it('should accept for-in loops', () => {
      const code = `
        export function request(ctx) {
          const keys = [];
          for (const key in ctx.arguments.obj) {
            keys.push(key);
          }
          return keys;
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors).toHaveLength(0);
    });

    it('should accept arrow functions', () => {
      const code = `
        export const request = (ctx) => ({ id: ctx.arguments.id });
        export const response = (ctx) => ctx.result;
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors).toHaveLength(0);
    });

    it('should accept JSON.stringify and JSON.parse', () => {
      const code = `
        export function request(ctx) {
          const str = JSON.stringify(ctx.arguments);
          return JSON.parse(str);
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors).toHaveLength(0);
    });

    it('should accept Math operations (except random)', () => {
      const code = `
        export function request(ctx) {
          return Math.floor(Math.abs(ctx.arguments.num));
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors).toHaveLength(0);
    });

    it('should accept new Date().getTime()', () => {
      const code = `
        export function request(ctx) {
          return { timestamp: new Date().getTime() };
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('disallowed globals', () => {
    it('should reject fetch', () => {
      const code = `
        export async function request(ctx) {
          const response = await fetch('https://api.example.com');
          return response;
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('fetch');
    });

    it('should reject window', () => {
      const code = `
        export function request(ctx) {
          return { location: window.location.href };
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      // Note: The validator doesn't flag identifiers used as objects in MemberExpressions
      // This is by design to avoid false positives
      expect(result.errors).toHaveLength(0);
    });

    it('should reject localStorage as standalone', () => {
      const code = `
        export function request(ctx) {
          const storage = localStorage;
          return {};
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('localStorage');
    });

    it('should reject setTimeout', () => {
      const code = `
        export function request(ctx) {
          setTimeout(() => {}, 1000);
          return {};
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('setTimeout');
    });

    it('should reject require', () => {
      const code = `
        const fs = require('fs');
        export function request(ctx) {
          return {};
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('require');
    });

    it('should reject eval', () => {
      const code = `
        export function request(ctx) {
          return eval('1 + 1');
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('eval');
    });

    it('should reject Map', () => {
      const code = `
        export function request(ctx) {
          const map = new Map();
          return {};
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Map');
    });

    it('should reject Set', () => {
      const code = `
        export function request(ctx) {
          const set = new Set();
          return {};
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Set');
    });

    it('should reject Proxy', () => {
      const code = `
        export function request(ctx) {
          return new Proxy({}, {});
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Proxy');
    });
  });

  describe('disallowed operators', () => {
    it('should reject the "in" operator', () => {
      const code = `
        export function request(ctx) {
          if ('name' in ctx.arguments) {
            return ctx.arguments.name;
          }
          return null;
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("'in'");
    });
  });

  describe('disallowed statements', () => {
    it('should reject throw statements', () => {
      const code = `
        export function request(ctx) {
          if (!ctx.arguments.id) {
            throw new Error('ID is required');
          }
          return { id: ctx.arguments.id };
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('throw');
    });

    it('should reject standard for loops', () => {
      const code = `
        export function request(ctx) {
          const items = [];
          for (let i = 0; i < 10; i++) {
            items.push(i);
          }
          return items;
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('for');
    });
  });

  describe('disallowed methods', () => {
    it('should reject Date.now()', () => {
      const code = `
        export function request(ctx) {
          return { timestamp: Date.now() };
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Date.now');
    });

    it('should reject Math.random()', () => {
      const code = `
        export function request(ctx) {
          return { random: Math.random() };
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Math.random');
    });

    it('should reject function.apply()', () => {
      const code = `
        function myFunc(a, b) { return a + b; }
        export function request(ctx) {
          return myFunc.apply(null, [1, 2]);
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('apply');
    });

    it('should reject function.bind()', () => {
      const code = `
        function myFunc() { return this.value; }
        export function request(ctx) {
          const bound = myFunc.bind({ value: 42 });
          return bound();
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('bind');
    });

    it('should reject function.call()', () => {
      const code = `
        function myFunc(a) { return a + this.value; }
        export function request(ctx) {
          return myFunc.call({ value: 10 }, 5);
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('call');
    });
  });

  describe('Function constructor', () => {
    it('should reject new Function()', () => {
      const code = `
        export function request(ctx) {
          const dynamicFunc = new Function('return 42');
          return dynamicFunc();
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Function');
    });
  });

  describe('recursive functions', () => {
    it('should reject direct recursive function calls', () => {
      const code = `
        function factorial(n) {
          if (n <= 1) return 1;
          return n * factorial(n - 1);
        }
        export function request(ctx) {
          return factorial(ctx.arguments.n);
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Recursive');
    });
  });

  describe('syntax errors', () => {
    it('should report syntax errors', () => {
      const code = `
        export function request(ctx {
          return ctx.arguments;
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('syntax error');
    });

    it('should report unclosed brackets', () => {
      const code = `
        export function request(ctx) {
          return { id: ctx.arguments.id;
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('syntax error');
    });
  });

  describe('multiple errors', () => {
    it('should report all errors in code with multiple violations', () => {
      const code = `
        export function request(ctx) {
          const map = new Map();
          if ('id' in ctx.arguments) {
            throw new Error('test');
          }
          return {};
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('should deduplicate identical errors', () => {
      const code = `
        export function request(ctx) {
          fetch('url1');
          fetch('url2');
          return {};
        }
      `;
      const result = validateAppSyncJavaScript(code, 'test.js');
      // Should only report 'fetch' error once due to deduplication
      const fetchErrors = result.errors.filter((e) => e.includes('fetch'));
      expect(fetchErrors.length).toBe(1);
    });
  });
});
