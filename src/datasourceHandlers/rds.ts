import type { Pool, PoolClient } from 'pg';
import type { RDSDataSource, RDSRequest, RDSResponse } from '../types/index.js';

// Connection pools for each data source
const connectionPools = new Map<string, Pool>();

// Active transactions
const activeTransactions = new Map<string, PoolClient>();

/**
 * Get or create a connection pool for the data source
 */
async function getPool(dataSource: RDSDataSource): Promise<Pool> {
  const poolKey = dataSource.name;

  if (!connectionPools.has(poolKey)) {
    const { engine, host, port, user, password, databaseName, ssl } = dataSource.config;

    if (engine === 'postgresql') {
      const { Pool: PgPool } = await import('pg');
      const pool = new PgPool({
        host,
        port,
        user,
        password,
        database: databaseName,
        // SSL certificate verification is enabled by default for security
        // Set APPSYNC_LOCAL_SSL_REJECT_UNAUTHORIZED=false to disable for self-signed certs
        ssl: ssl ? { rejectUnauthorized: process.env.APPSYNC_LOCAL_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
        max: 10, // Maximum connections in pool
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      connectionPools.set(poolKey, pool);
    } else if (engine === 'mysql') {
      // MySQL support using mysql2 with pg-compatible interface wrapper
      const mysql = await import('mysql2/promise');
      const pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database: databaseName,
        ssl: ssl ? {} : undefined,
        connectionLimit: 10,
        connectTimeout: 5000,
      });

      // Create a wrapper that provides pg-like interface
      const pgLikePool = {
        query: async (sql: string, values?: unknown[]) => {
          const [rows, fields] = await pool.execute(sql, values);
          return {
            rows: rows as unknown[],
            fields,
            rowCount: Array.isArray(rows) ? rows.length : 0,
          };
        },
        connect: async () => {
          const connection = await pool.getConnection();
          return {
            query: async (sql: string, values?: unknown[]) => {
              const [rows, fields] = await connection.execute(sql, values);
              return {
                rows: rows as unknown[],
                fields,
                rowCount: Array.isArray(rows) ? rows.length : 0,
              };
            },
            release: () => connection.release(),
          };
        },
        end: () => pool.end(),
      };

      connectionPools.set(poolKey, pgLikePool as unknown as Pool);
    } else {
      throw new Error(`Unsupported database engine: ${engine}`);
    }
  }

  return connectionPools.get(poolKey)!;
}

/**
 * Convert variable map to positional parameters
 */
function convertVariables(sql: string, variableMap?: Record<string, unknown>): { sql: string; values: unknown[] } {
  if (!variableMap) {
    return { sql, values: [] };
  }

  const values: unknown[] = [];
  let paramIndex = 1;

  // Replace :varName with $1, $2, etc. (PostgreSQL style)
  const convertedSql = sql.replace(/:(\w+)/g, (_, varName) => {
    if (varName in variableMap) {
      values.push(variableMap[varName]);
      return `$${paramIndex++}`;
    }
    return `:${varName}`;
  });

  return { sql: convertedSql, values };
}

/**
 * Format query results to match AppSync RDS Data API format
 */
function formatResults(rows: unknown[], fields?: unknown[]): RDSResponse {
  const columnMetadata = fields
    ? (fields as Array<{ name: string; dataTypeID?: number }>).map((f) => ({
        name: f.name,
        type: String(f.dataTypeID || 'unknown'),
      }))
    : undefined;

  return {
    records: rows.map((row) => Object.values(row as Record<string, unknown>)),
    columnMetadata,
    numberOfRecordsUpdated: 0,
    generatedFields: [],
  };
}

/**
 * Execute a single SQL statement
 */
async function executeStatement(
  pool: Pool,
  sql: string,
  variableMap?: Record<string, unknown>,
  transactionId?: string
): Promise<RDSResponse> {
  const { sql: convertedSql, values } = convertVariables(sql, variableMap);

  // Use transaction client if available
  if (transactionId && activeTransactions.has(transactionId)) {
    const client = activeTransactions.get(transactionId)!;
    const result = await client.query(convertedSql, values);
    return formatResults(result.rows, result.fields as unknown[]);
  }

  const result = await pool.query(convertedSql, values);
  return formatResults(result.rows, result.fields as unknown[]);
}

/**
 * Execute multiple SQL statements as a batch
 */
async function batchExecuteStatement(
  pool: Pool,
  statements: Array<{ sql: string; variableMap?: Record<string, unknown> }>,
  transactionId?: string
): Promise<RDSResponse> {
  const results: unknown[][] = [];
  const client = transactionId ? activeTransactions.get(transactionId) : await pool.connect();

  if (!client) {
    throw new Error(`Transaction ${transactionId} not found`);
  }

  try {
    for (const stmt of statements) {
      const { sql: convertedSql, values } = convertVariables(stmt.sql, stmt.variableMap);
      const result = await client.query(convertedSql, values);
      results.push(result.rows as unknown[]);
    }
  } finally {
    if (!transactionId && 'release' in client) {
      (client as PoolClient).release();
    }
  }

  return {
    records: results.flat().map((row) => Object.values(row as Record<string, unknown>)),
    numberOfRecordsUpdated: results.length,
  };
}

/**
 * Begin a new transaction
 */
async function beginTransaction(pool: Pool): Promise<RDSResponse> {
  const client = await pool.connect();
  await client.query('BEGIN');

  const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  activeTransactions.set(transactionId, client);

  return { transactionId };
}

/**
 * End a transaction (commit or rollback)
 */
async function endTransaction(transactionId: string, action: 'COMMIT' | 'ROLLBACK'): Promise<RDSResponse> {
  if (!transactionId || !activeTransactions.has(transactionId)) {
    throw new Error(`Transaction ${transactionId} not found`);
  }

  const client = activeTransactions.get(transactionId)!;
  await client.query(action);
  client.release();
  activeTransactions.delete(transactionId);

  return { transactionId };
}

/**
 * Execute RDS data source operation
 */
export async function executeRDSOperation(dataSource: RDSDataSource, request: RDSRequest): Promise<RDSResponse> {
  const pool = await getPool(dataSource);
  const { operation, sql, variableMap, transactionId, statements } = request;

  try {
    switch (operation) {
      case 'executeStatement':
        if (!sql) throw new Error('SQL statement is required');
        return executeStatement(pool, sql, variableMap, transactionId);

      case 'batchExecuteStatement':
        if (!statements?.length) throw new Error('Statements array is required');
        return batchExecuteStatement(pool, statements, transactionId);

      case 'beginTransaction':
        return beginTransaction(pool);

      case 'commitTransaction':
        return endTransaction(transactionId!, 'COMMIT');

      case 'rollbackTransaction':
        return endTransaction(transactionId!, 'ROLLBACK');

      default:
        throw new Error(`Unsupported RDS operation: ${operation}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`RDS operation failed for '${dataSource.name}': ${errorMessage}`);
  }
}

/**
 * Helper to create common RDS request structures for AppSync resolvers
 */
export const rdsRequest = {
  /**
   * Create an executeStatement request
   */
  executeStatement(sql: string, variableMap?: Record<string, unknown>, transactionId?: string): RDSRequest {
    return {
      operation: 'executeStatement',
      sql,
      variableMap,
      transactionId,
    };
  },

  /**
   * Create a batchExecuteStatement request
   */
  batchExecuteStatement(
    statements: Array<{ sql: string; variableMap?: Record<string, unknown> }>,
    transactionId?: string
  ): RDSRequest {
    return {
      operation: 'batchExecuteStatement',
      statements,
      transactionId,
    };
  },

  /**
   * Create a beginTransaction request
   */
  beginTransaction(): RDSRequest {
    return {
      operation: 'beginTransaction',
    };
  },

  /**
   * Create a commitTransaction request
   */
  commitTransaction(transactionId: string): RDSRequest {
    return {
      operation: 'commitTransaction',
      transactionId,
    };
  },

  /**
   * Create a rollbackTransaction request
   */
  rollbackTransaction(transactionId: string): RDSRequest {
    return {
      operation: 'rollbackTransaction',
      transactionId,
    };
  },
};

/**
 * Close all connection pools (for cleanup)
 */
export async function closeAllPools(): Promise<void> {
  for (const [name, pool] of connectionPools) {
    try {
      await pool.end();
    } catch (error) {
      console.error(`Error closing pool ${name}:`, error);
    }
  }
  connectionPools.clear();
  activeTransactions.clear();
}
