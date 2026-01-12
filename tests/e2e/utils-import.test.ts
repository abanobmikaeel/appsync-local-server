import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { type ChildProcess, spawn } from 'child_process';
import path from 'path';

// Use process.cwd() as project root since ts-jest doesn't support import.meta.url
const projectRoot = process.cwd();

const PORT = 4002;
const GRAPHQL_URL = `http://localhost:${PORT}/`;
const API_KEY = 'test-key'; // Must match the key in examples/with-utils-import/appsync-config.json

// Helper to wait for server to be ready
async function waitForServer(url: string, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify({ query: '{ __typename }' }),
      });
      if (response.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server not ready after ${maxAttempts} attempts`);
}

// Helper to execute GraphQL query
async function graphql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<{ data?: T; errors?: Array<{ message: string }> }> {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });
  return response.json() as Promise<{ data?: T; errors?: Array<{ message: string }> }>;
}

describe('E2E: @aws-appsync/utils Imports', () => {
  let serverProcess: ChildProcess;

  beforeAll(async () => {
    const configPath = path.join(projectRoot, 'examples/with-utils-import/appsync-config.json');

    // Start the server using tsx
    serverProcess = spawn('npx', ['tsx', 'bin/appsync-local.ts', 'start', '-c', configPath, '-p', String(PORT)], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Log server output for debugging
    serverProcess.stdout?.on('data', (data) => {
      console.log(`[server]: ${data}`);
    });
    serverProcess.stderr?.on('data', (data) => {
      console.error(`[server error]: ${data}`);
    });

    // Wait for server to be ready
    await waitForServer(GRAPHQL_URL);
  }, 30000);

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  });

  describe('Resolvers using @aws-appsync/utils', () => {
    it('should work with util import (getUser)', async () => {
      // This resolver uses: import { util } from '@aws-appsync/utils'
      const result = await graphql<{ getUser: { id: string; name: string; createdAt: string } }>(
        `
        query GetUser($id: ID!) {
          getUser(id: $id) {
            id
            name
            createdAt
          }
        }
      `,
        { id: 'test-123' }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.getUser).toBeDefined();
      expect(result.data?.getUser.id).toBe('test-123');
      expect(result.data?.getUser.name).toBe('Test User');
      // createdAt should be a valid ISO timestamp from util.time.nowISO8601()
      expect(result.data?.getUser.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should work with dynamodb helpers (listUsers with scan)', async () => {
      // This resolver uses: import { scan } from '@aws-appsync/utils/dynamodb'
      const result = await graphql<{ listUsers: Array<{ id: string; name: string; email: string }> }>(`
        query ListUsers {
          listUsers {
            id
            name
            email
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data?.listUsers).toBeDefined();
      expect(Array.isArray(result.data?.listUsers)).toBe(true);
      expect(result.data?.listUsers.length).toBeGreaterThan(0);
    });

    it('should work with util + dynamodb put helper (createUser)', async () => {
      // This resolver uses both:
      // - import { util } from '@aws-appsync/utils'
      // - import { put } from '@aws-appsync/utils/dynamodb'
      const result = await graphql<{ createUser: { id: string; name: string; email: string; createdAt: string } }>(
        `
        mutation CreateUser($input: CreateUserInput!) {
          createUser(input: $input) {
            id
            name
            email
            createdAt
          }
        }
      `,
        {
          input: {
            name: 'New User',
            email: 'newuser@example.com',
          },
        }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.createUser).toBeDefined();
      // util.autoId() should generate a valid UUID
      expect(result.data?.createUser.id).toMatch(/^[a-f0-9-]{36}$/);
      expect(result.data?.createUser.name).toBe('New User');
      expect(result.data?.createUser.email).toBe('newuser@example.com');
      // createdAt should be a valid ISO timestamp from util.time.nowISO8601()
      expect(result.data?.createUser.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should work with dynamodb update helper + operations (updateUser)', async () => {
      // This resolver uses:
      // - import { util } from '@aws-appsync/utils'
      // - import { update, operations } from '@aws-appsync/utils/dynamodb'
      const result = await graphql<{
        updateUser: { id: string; name: string; email: string; updatedAt: string };
      }>(
        `
        mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
          updateUser(id: $id, input: $input) {
            id
            name
            email
            updatedAt
          }
        }
      `,
        {
          id: 'user-1',
          input: {
            name: 'Updated Name',
          },
        }
      );

      expect(result.errors).toBeUndefined();
      expect(result.data?.updateUser).toBeDefined();
      expect(result.data?.updateUser.id).toBe('user-1');
      // updatedAt should be set by util.time.nowISO8601()
      expect(result.data?.updateUser.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('Global utilities (no import needed)', () => {
    it('should have util available globally', async () => {
      // The getUser resolver also uses util globally for nowISO8601
      const result = await graphql<{ getUser: { createdAt: string } }>(
        `
        query GetUser($id: ID!) {
          getUser(id: $id) {
            createdAt
          }
        }
      `,
        { id: 'any-id' }
      );

      expect(result.errors).toBeUndefined();
      // util.time.nowISO8601() should produce a valid timestamp
      expect(result.data?.getUser.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
