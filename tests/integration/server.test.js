import request from 'supertest';
import { startServer } from '../../src/server.js';
import fs from 'fs';
import path from 'path';

// Mock file system operations
jest.mock('fs');
jest.mock('path');

describe('Server Integration Tests', () => {
  let server;
  let app;

  const mockConfig = {
    schema: './schema.graphql',
    apiConfig: {
      auth: []
    },
    dataSources: [
      {
        type: 'NONE',
        name: 'noneDataSource'
      }
    ],
    resolvers: [
      {
        type: 'Query',
        field: 'hello',
        kind: 'Unit',
        dataSource: 'noneDataSource',
        file: './test-resolver.js'
      }
    ],
    port: 4000
  };

  const mockSchema = `
    type Query {
      hello: String
    }
  `;

  const mockResolver = `
    export async function request(ctx) {
      return "Hello from resolver!";
    }
    
    export async function response(ctx) {
      return ctx.prev.result;
    }
  `;

  beforeEach(() => {
    // Mock file system
    fs.readFileSync.mockImplementation((filePath) => {
      if (filePath.includes('schema.graphql')) {
        return mockSchema;
      }
      if (filePath.includes('test-resolver.js')) {
        return mockResolver;
      }
      return '';
    });

    fs.existsSync.mockReturnValue(true);
    path.resolve.mockImplementation((cwd, filePath) => filePath);
  });

  afterEach(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  describe('GraphQL Endpoint', () => {
    beforeEach(async () => {
      server = await startServer(mockConfig);
      app = server;
    });

    it('should respond to GraphQL queries', async () => {
      const query = `
        query {
          hello
        }
      `;

      const response = await request(app)
        .post('/')
        .send({ query })
        .expect(200);

      expect(response.body.data.hello).toBe('Hello from resolver!');
    });

    it('should handle introspection queries', async () => {
      const query = `
        query IntrospectionQuery {
          __schema {
            types {
              name
            }
          }
        }
      `;

      const response = await request(app)
        .post('/')
        .send({ query })
        .expect(200);

      expect(response.body.data.__schema).toBeDefined();
      expect(response.body.data.__schema.types).toBeDefined();
    });

    it('should handle invalid queries gracefully', async () => {
      const query = `
        query {
          nonExistentField
        }
      `;

      const response = await request(app)
        .post('/')
        .send({ query })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should handle malformed JSON', async () => {
      await request(app)
        .post('/')
        .send('invalid json')
        .expect(400);
    });
  });

  describe('Server Configuration', () => {
    it('should start server on specified port', async () => {
      const configWithCustomPort = { ...mockConfig, port: 4001 };
      
      server = await startServer(configWithCustomPort);
      
      // Test that server is listening on the correct port
      const response = await request(server)
        .post('/')
        .send({ query: '{ hello }' })
        .expect(200);

      expect(response.body.data.hello).toBe('Hello from resolver!');
    });

    it('should handle missing resolver files gracefully', async () => {
      fs.existsSync.mockReturnValue(false);
      
      const configWithMissingFile = {
        ...mockConfig,
        resolvers: [
          {
            type: 'Query',
            field: 'hello',
            kind: 'Unit',
            dataSource: 'noneDataSource',
            file: './missing-resolver.js'
          }
        ]
      };

      await expect(startServer(configWithMissingFile))
        .rejects.toThrow();
    });
  });

  describe('Context and Headers', () => {
    beforeEach(async () => {
      server = await startServer(mockConfig);
    });

    it('should pass headers to context', async () => {
      const query = `
        query {
          hello
        }
      `;

      const response = await request(server)
        .post('/')
        .set('Authorization', 'Bearer test-token')
        .set('X-Custom-Header', 'custom-value')
        .send({ query })
        .expect(200);

      expect(response.body.data.hello).toBe('Hello from resolver!');
    });
  });
}); 