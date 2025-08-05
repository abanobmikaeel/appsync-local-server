import { validateAppSyncJavaScript } from '../../../src/validators/javascriptValidator.js';

describe('JavaScript Validator', () => {
  describe('validateAppSyncJavaScript', () => {
    it('should pass for valid AppSync JavaScript code', () => {
      const validCode = `
        export async function request(ctx) {
          return {
            operation: "GetItem",
            params: {
              TableName: "test",
              Key: { id: { S: ctx.arguments.id } }
            }
          };
        }
        
        export async function response(ctx) {
          return ctx.prev.result;
        }
      `;
      
      const result = validateAppSyncJavaScript(validCode, 'test.js');
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect Map usage', () => {
      const invalidCode = `
        export async function request(ctx) {
          var myMap = new Map();
          myMap.set('key', 'value');
          return myMap;
        }
      `;
      
      const result = validateAppSyncJavaScript(invalidCode, 'test.js');
      expect(result.errors).toContain('❌ Map/Set usage found in test.js. AppSync JavaScript resolvers do not support Map or Set.');
    });

    it('should detect Set usage', () => {
      const invalidCode = `
        export async function request(ctx) {
          var mySet = new Set([1, 2, 3]);
          return mySet;
        }
      `;
      
      const result = validateAppSyncJavaScript(invalidCode, 'test.js');
      expect(result.errors).toContain('❌ Map/Set usage found in test.js. AppSync JavaScript resolvers do not support Map or Set.');
    });

    it('should detect Math.random() usage', () => {
      const invalidCode = `
        export async function request(ctx) {
          var random = Math.random();
          return { random };
        }
      `;
      
      const result = validateAppSyncJavaScript(invalidCode, 'test.js');
      expect(result.errors).toContain('❌ Math.random() found in test.js. AppSync JavaScript resolvers do not support Math.random().');
    });

    it('should detect console usage', () => {
      const invalidCode = `
        export async function request(ctx) {
          console.log('test');
          return { message: 'test' };
        }
      `;
      
      const result = validateAppSyncJavaScript(invalidCode, 'test.js');
      expect(result.errors).toContain('❌ Console usage found in test.js. Console is not available in AppSync JavaScript resolvers.');
    });

    it('should detect process usage', () => {
      const invalidCode = `
        export async function request(ctx) {
          var env = process.env.NODE_ENV;
          return { env };
        }
      `;
      
      const result = validateAppSyncJavaScript(invalidCode, 'test.js');
      expect(result.errors).toContain('❌ Process usage found in test.js. Process is not available in AppSync JavaScript resolvers.');
    });

    it('should detect fetch usage', () => {
      const invalidCode = `
        export async function request(ctx) {
          var response = await fetch('https://api.example.com');
          return response.json();
        }
      `;
      
      const result = validateAppSyncJavaScript(invalidCode, 'test.js');
      expect(result.errors).toContain('❌ Fetch usage found in test.js. Fetch is not available in AppSync JavaScript resolvers.');
    });

    it('should detect setTimeout usage', () => {
      const invalidCode = `
        export async function request(ctx) {
          setTimeout(() => {}, 1000);
          return { message: 'test' };
        }
      `;
      
      const result = validateAppSyncJavaScript(invalidCode, 'test.js');
      expect(result.errors).toContain('❌ setTimeout/setInterval found in test.js. These are not available in AppSync JavaScript resolvers.');
    });

    it('should detect try-catch blocks', () => {
      const invalidCode = `
        export async function request(ctx) {
          try {
            var result = 'test';
          } catch (error) {
            var error = 'caught';
          }
          return { result };
        }
      `;
      
      const result = validateAppSyncJavaScript(invalidCode, 'test.js');
      expect(result.errors).toContain('❌ Try-catch blocks found in test.js. AppSync JavaScript resolvers do not support try-catch blocks.');
    });

    it('should detect multiple violations in one file', () => {
      const invalidCode = `
        export async function request(ctx) {
          var myMap = new Map();
          console.log('test');
          var random = Math.random();
          return { test: 'value' };
        }
      `;
      
      const result = validateAppSyncJavaScript(invalidCode, 'test.js');
      console.log('Actual errors:', result.errors);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('❌ Map/Set usage found in test.js. AppSync JavaScript resolvers do not support Map or Set.');
      expect(result.errors).toContain('❌ Console usage found in test.js. Console is not available in AppSync JavaScript resolvers.');
      expect(result.errors).toContain('❌ Math.random() found in test.js. AppSync JavaScript resolvers do not support Math.random().');
    });

    it('should allow valid Math methods', () => {
      const validCode = `
        export async function request(ctx) {
          var max = Math.max(1, 2, 3);
          var min = Math.min(1, 2, 3);
          var floor = Math.floor(3.14);
          return { max, min, floor };
        }
      `;
      
      const result = validateAppSyncJavaScript(validCode, 'test.js');
      expect(result.errors).toHaveLength(0);
    });

    it('should allow valid Date methods', () => {
      const validCode = `
        export async function request(ctx) {
          var date = new Date();
          var iso = date.toISOString();
          var time = date.getTime();
          return { iso, time };
        }
      `;
      
      const result = validateAppSyncJavaScript(validCode, 'test.js');
      expect(result.errors).toHaveLength(0);
    });
  });
}); 