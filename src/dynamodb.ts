/**
 * DynamoDB helper functions for AppSync JavaScript resolvers
 *
 * These functions build DynamoDB request objects that can be returned from
 * resolver request handlers and executed by the DynamoDB data source.
 *
 * Usage in resolvers:
 * ```javascript
 * import { get, put, query } from '@aws-appsync/utils/dynamodb';
 *
 * export function request(ctx) {
 *   return get({ key: { id: ctx.args.id } });
 * }
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export interface DynamoDBKey {
  [key: string]: string | number;
}

export interface DynamoDBFilterCondition {
  eq?: unknown;
  ne?: unknown;
  lt?: unknown;
  le?: unknown;
  gt?: unknown;
  ge?: unknown;
  between?: [unknown, unknown];
  beginsWith?: string;
  contains?: unknown;
  notContains?: unknown;
  attributeExists?: boolean;
  attributeType?: string;
  size?: { eq?: number; ne?: number; lt?: number; le?: number; gt?: number; ge?: number };
}

export interface DynamoDBFilter {
  [field: string]: DynamoDBFilterCondition | unknown;
}

export interface DynamoDBKeyCondition {
  [field: string]: {
    eq?: string | number;
    le?: string | number;
    lt?: string | number;
    ge?: string | number;
    gt?: string | number;
    between?: [string | number, string | number];
    beginsWith?: string;
  };
}

// Request types
export interface DynamoDBGetItemRequest {
  operation: 'GetItem';
  key: DynamoDBKey;
  consistentRead?: boolean;
  projection?: string[];
}

export interface DynamoDBPutItemRequest {
  operation: 'PutItem';
  key: DynamoDBKey;
  attributeValues: Record<string, unknown>;
  condition?: DynamoDBExpressionInput;
  _version?: number;
}

export interface DynamoDBDeleteItemRequest {
  operation: 'DeleteItem';
  key: DynamoDBKey;
  condition?: DynamoDBExpressionInput;
  _version?: number;
}

export interface DynamoDBUpdateItemRequest {
  operation: 'UpdateItem';
  key: DynamoDBKey;
  update: DynamoDBUpdateExpression;
  condition?: DynamoDBExpressionInput;
  _version?: number;
}

export interface DynamoDBQueryRequest {
  operation: 'Query';
  query: DynamoDBExpressionInput;
  index?: string;
  limit?: number;
  nextToken?: string;
  filter?: DynamoDBExpressionInput;
  consistentRead?: boolean;
  scanIndexForward?: boolean;
  select?: 'ALL_ATTRIBUTES' | 'ALL_PROJECTED_ATTRIBUTES' | 'SPECIFIC_ATTRIBUTES';
  projection?: string[];
}

export interface DynamoDBScanRequest {
  operation: 'Scan';
  index?: string;
  limit?: number;
  nextToken?: string;
  filter?: DynamoDBExpressionInput;
  consistentRead?: boolean;
  select?: 'ALL_ATTRIBUTES' | 'ALL_PROJECTED_ATTRIBUTES' | 'SPECIFIC_ATTRIBUTES';
  projection?: string[];
  totalSegments?: number;
  segment?: number;
}

export interface DynamoDBSyncRequest {
  operation: 'Sync';
  basePartitionKey?: string;
  deltaIndexName?: string;
  limit?: number;
  nextToken?: string;
  lastSync?: number;
  filter?: DynamoDBExpressionInput;
}

export interface DynamoDBBatchGetItemRequest {
  operation: 'BatchGetItem';
  tables: {
    [tableName: string]: {
      keys: DynamoDBKey[];
      consistentRead?: boolean;
      projection?: string[];
    };
  };
}

export interface DynamoDBBatchPutItemRequest {
  operation: 'BatchPutItem';
  tables: {
    [tableName: string]: Array<Record<string, unknown>>;
  };
}

export interface DynamoDBBatchDeleteItemRequest {
  operation: 'BatchDeleteItem';
  tables: {
    [tableName: string]: DynamoDBKey[];
  };
}

export interface DynamoDBTransactGetItemsRequest {
  operation: 'TransactGetItems';
  transactItems: Array<{
    table: string;
    key: DynamoDBKey;
    projection?: string[];
  }>;
}

export interface DynamoDBTransactWriteItemsRequest {
  operation: 'TransactWriteItems';
  transactItems: Array<
    | {
        table: string;
        operation: 'PutItem';
        key: DynamoDBKey;
        attributeValues: Record<string, unknown>;
        condition?: DynamoDBExpressionInput;
      }
    | {
        table: string;
        operation: 'UpdateItem';
        key: DynamoDBKey;
        update: DynamoDBUpdateExpression;
        condition?: DynamoDBExpressionInput;
      }
    | { table: string; operation: 'DeleteItem'; key: DynamoDBKey; condition?: DynamoDBExpressionInput }
    | { table: string; operation: 'ConditionCheck'; key: DynamoDBKey; condition: DynamoDBExpressionInput }
  >;
}

interface DynamoDBExpressionInput {
  expression: string;
  expressionNames?: Record<string, string>;
  expressionValues?: Record<string, unknown>;
}

interface DynamoDBUpdateExpression {
  expression: string;
  expressionNames?: Record<string, string>;
  expressionValues?: Record<string, unknown>;
}

// ============================================================================
// Input Types (what users pass to helper functions)
// ============================================================================

export interface GetInput<T = unknown> {
  key: Partial<T> | DynamoDBKey;
  consistentRead?: boolean;
  projection?: string[];
}

export interface PutInput<T = unknown> {
  key: Partial<T> | DynamoDBKey;
  item: Partial<T>;
  condition?: DynamoDBFilter;
  _version?: number;
}

export interface RemoveInput<T = unknown> {
  key: Partial<T> | DynamoDBKey;
  condition?: DynamoDBFilter;
  _version?: number;
}

export interface UpdateInput<T = unknown> {
  key: Partial<T> | DynamoDBKey;
  /** Update can be an object { field: value } or an array of operations */
  update: Partial<T> | Record<string, unknown> | unknown[];
  condition?: DynamoDBFilter;
  _version?: number;
}

export interface QueryInput<_T = unknown> {
  query: DynamoDBKeyCondition;
  index?: string;
  limit?: number;
  nextToken?: string;
  filter?: DynamoDBFilter;
  consistentRead?: boolean;
  scanIndexForward?: boolean;
  select?: 'ALL_ATTRIBUTES' | 'ALL_PROJECTED_ATTRIBUTES' | 'SPECIFIC_ATTRIBUTES';
  projection?: string[];
}

export interface ScanInput<_T = unknown> {
  index?: string;
  limit?: number;
  nextToken?: string;
  filter?: DynamoDBFilter;
  consistentRead?: boolean;
  select?: 'ALL_ATTRIBUTES' | 'ALL_PROJECTED_ATTRIBUTES' | 'SPECIFIC_ATTRIBUTES';
  projection?: string[];
  totalSegments?: number;
  segment?: number;
}

export interface SyncInput<_T = unknown> {
  basePartitionKey?: string;
  deltaIndexName?: string;
  limit?: number;
  nextToken?: string;
  lastSync?: number;
  filter?: DynamoDBFilter;
}

export interface BatchGetInput {
  tables: {
    [tableName: string]: {
      keys: DynamoDBKey[];
      consistentRead?: boolean;
      projection?: string[];
    };
  };
}

export interface BatchPutInput<T = unknown> {
  tables: {
    [tableName: string]: Array<Partial<T>>;
  };
}

export interface BatchDeleteInput {
  tables: {
    [tableName: string]: DynamoDBKey[];
  };
}

export interface TransactGetInput {
  items: Array<{
    table: string;
    key: DynamoDBKey;
    projection?: string[];
  }>;
}

export interface TransactWriteItem {
  putItem?: {
    table: string;
    key: DynamoDBKey;
    item: Record<string, unknown>;
    condition?: DynamoDBFilter;
  };
  updateItem?: {
    table: string;
    key: DynamoDBKey;
    update: Record<string, unknown>;
    condition?: DynamoDBFilter;
  };
  deleteItem?: {
    table: string;
    key: DynamoDBKey;
    condition?: DynamoDBFilter;
  };
  conditionCheck?: {
    table: string;
    key: DynamoDBKey;
    condition: DynamoDBFilter;
  };
}

export interface TransactWriteInput {
  items: TransactWriteItem[];
}

// ============================================================================
// Operation Markers (for update expressions)
// ============================================================================

const ADD_OP = Symbol('add');
const REMOVE_OP = Symbol('remove');
const REPLACE_OP = Symbol('replace');
const INCREMENT_OP = Symbol('increment');
const DECREMENT_OP = Symbol('decrement');
const APPEND_OP = Symbol('append');
const PREPEND_OP = Symbol('prepend');
const UPDATE_LIST_ITEM_OP = Symbol('updateListItem');

interface DynamoDBOperationAdd<T> {
  _type: typeof ADD_OP;
  path: string;
  value: T;
}

interface DynamoDBOperationRemove {
  _type: typeof REMOVE_OP;
  path: string;
}

interface DynamoDBOperationReplace<T> {
  _type: typeof REPLACE_OP;
  path: string;
  value: T;
}

interface DynamoDBOperationIncrement {
  _type: typeof INCREMENT_OP;
  path: string;
  by: number;
}

interface DynamoDBOperationDecrement {
  _type: typeof DECREMENT_OP;
  path: string;
  by: number;
}

interface DynamoDBOperationAppend<T> {
  _type: typeof APPEND_OP;
  path: string;
  values: T[];
}

interface DynamoDBOperationPrepend<T> {
  _type: typeof PREPEND_OP;
  path: string;
  values: T[];
}

interface DynamoDBOperationUpdateListItem<T> {
  _type: typeof UPDATE_LIST_ITEM_OP;
  path: string;
  value: T;
  index: number;
}

type DynamoDBOperation =
  | DynamoDBOperationAdd<unknown>
  | DynamoDBOperationRemove
  | DynamoDBOperationReplace<unknown>
  | DynamoDBOperationIncrement
  | DynamoDBOperationDecrement
  | DynamoDBOperationAppend<unknown>
  | DynamoDBOperationPrepend<unknown>
  | DynamoDBOperationUpdateListItem<unknown>;

/**
 * Operations helper for building DynamoDB update expressions.
 * All operations take path (field name) as first argument, matching AWS AppSync API.
 *
 * Usage:
 * ```javascript
 * import { update, operations } from '@aws-appsync/utils/dynamodb';
 *
 * export function request(ctx) {
 *   return update({
 *     key: { id: ctx.args.id },
 *     update: [
 *       operations.replace('name', ctx.args.name),
 *       operations.increment('viewCount', 1),
 *     ]
 *   });
 * }
 * ```
 */
export const operations = {
  /** Add value to attribute if it doesn't exist, or add to number set */
  add: <T>(path: string, value: T): DynamoDBOperationAdd<T> => ({
    _type: ADD_OP,
    path,
    value,
  }),

  /** Remove an attribute */
  remove: (path: string): DynamoDBOperationRemove => ({
    _type: REMOVE_OP,
    path,
  }),

  /** Set/replace an attribute value */
  replace: <T>(path: string, value: T): DynamoDBOperationReplace<T> => ({
    _type: REPLACE_OP,
    path,
    value,
  }),

  /** Increment a numeric attribute */
  increment: (path: string, by = 1): DynamoDBOperationIncrement => ({
    _type: INCREMENT_OP,
    path,
    by,
  }),

  /** Decrement a numeric attribute */
  decrement: (path: string, by = 1): DynamoDBOperationDecrement => ({
    _type: DECREMENT_OP,
    path,
    by,
  }),

  /** Append values to a list attribute */
  append: <T>(path: string, values: T[]): DynamoDBOperationAppend<T> => ({
    _type: APPEND_OP,
    path,
    values,
  }),

  /** Prepend values to a list attribute */
  prepend: <T>(path: string, values: T[]): DynamoDBOperationPrepend<T> => ({
    _type: PREPEND_OP,
    path,
    values,
  }),

  /** Update a specific item in a list by index */
  updateListItem: <T>(path: string, value: T, index: number): DynamoDBOperationUpdateListItem<T> => ({
    _type: UPDATE_LIST_ITEM_OP,
    path,
    value,
    index,
  }),
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build a filter/condition expression from a filter object
 */
function buildExpression(filter: DynamoDBFilter): DynamoDBExpressionInput {
  const expressions: string[] = [];
  const expressionNames: Record<string, string> = {};
  const expressionValues: Record<string, unknown> = {};
  let valueIndex = 0;

  for (const [field, condition] of Object.entries(filter)) {
    const nameKey = `#f${Object.keys(expressionNames).length}`;
    expressionNames[nameKey] = field;

    if (typeof condition === 'object' && condition !== null && !Array.isArray(condition)) {
      const cond = condition as DynamoDBFilterCondition;
      for (const [op, val] of Object.entries(cond)) {
        const valueKey = `:v${valueIndex++}`;

        switch (op) {
          case 'eq':
            expressionValues[valueKey] = val;
            expressions.push(`${nameKey} = ${valueKey}`);
            break;
          case 'ne':
            expressionValues[valueKey] = val;
            expressions.push(`${nameKey} <> ${valueKey}`);
            break;
          case 'lt':
            expressionValues[valueKey] = val;
            expressions.push(`${nameKey} < ${valueKey}`);
            break;
          case 'le':
            expressionValues[valueKey] = val;
            expressions.push(`${nameKey} <= ${valueKey}`);
            break;
          case 'gt':
            expressionValues[valueKey] = val;
            expressions.push(`${nameKey} > ${valueKey}`);
            break;
          case 'ge':
            expressionValues[valueKey] = val;
            expressions.push(`${nameKey} >= ${valueKey}`);
            break;
          case 'between':
            if (Array.isArray(val) && val.length === 2) {
              const valueKey2 = `:v${valueIndex++}`;
              expressionValues[valueKey] = val[0];
              expressionValues[valueKey2] = val[1];
              expressions.push(`${nameKey} BETWEEN ${valueKey} AND ${valueKey2}`);
            }
            break;
          case 'beginsWith':
            expressionValues[valueKey] = val;
            expressions.push(`begins_with(${nameKey}, ${valueKey})`);
            break;
          case 'contains':
            expressionValues[valueKey] = val;
            expressions.push(`contains(${nameKey}, ${valueKey})`);
            break;
          case 'notContains':
            expressionValues[valueKey] = val;
            expressions.push(`NOT contains(${nameKey}, ${valueKey})`);
            break;
          case 'attributeExists':
            expressions.push(val ? `attribute_exists(${nameKey})` : `attribute_not_exists(${nameKey})`);
            break;
          case 'attributeType':
            expressionValues[valueKey] = val;
            expressions.push(`attribute_type(${nameKey}, ${valueKey})`);
            break;
        }
      }
    } else {
      // Simple equality
      const valueKey = `:v${valueIndex++}`;
      expressionValues[valueKey] = condition;
      expressions.push(`${nameKey} = ${valueKey}`);
    }
  }

  return {
    expression: expressions.join(' AND '),
    expressionNames,
    expressionValues,
  };
}

/**
 * Build a key condition expression for Query operations
 */
function buildKeyConditionExpression(query: DynamoDBKeyCondition): DynamoDBExpressionInput {
  const expressions: string[] = [];
  const expressionNames: Record<string, string> = {};
  const expressionValues: Record<string, unknown> = {};
  let valueIndex = 0;

  for (const [field, condition] of Object.entries(query)) {
    const nameKey = `#k${Object.keys(expressionNames).length}`;
    expressionNames[nameKey] = field;

    for (const [op, val] of Object.entries(condition)) {
      const valueKey = `:v${valueIndex++}`;

      switch (op) {
        case 'eq':
          expressionValues[valueKey] = val;
          expressions.push(`${nameKey} = ${valueKey}`);
          break;
        case 'le':
          expressionValues[valueKey] = val;
          expressions.push(`${nameKey} <= ${valueKey}`);
          break;
        case 'lt':
          expressionValues[valueKey] = val;
          expressions.push(`${nameKey} < ${valueKey}`);
          break;
        case 'ge':
          expressionValues[valueKey] = val;
          expressions.push(`${nameKey} >= ${valueKey}`);
          break;
        case 'gt':
          expressionValues[valueKey] = val;
          expressions.push(`${nameKey} > ${valueKey}`);
          break;
        case 'between':
          if (Array.isArray(val) && val.length === 2) {
            const valueKey2 = `:v${valueIndex++}`;
            expressionValues[valueKey] = val[0];
            expressionValues[valueKey2] = val[1];
            expressions.push(`${nameKey} BETWEEN ${valueKey} AND ${valueKey2}`);
          }
          break;
        case 'beginsWith':
          expressionValues[valueKey] = val;
          expressions.push(`begins_with(${nameKey}, ${valueKey})`);
          break;
      }
    }
  }

  return {
    expression: expressions.join(' AND '),
    expressionNames,
    expressionValues,
  };
}

/**
 * Check if a value is a DynamoDB operation marker
 */
function isOperation(value: unknown): value is DynamoDBOperation {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_type' in value &&
    typeof (value as DynamoDBOperation)._type === 'symbol'
  );
}

/**
 * Build an update expression from an update object or array of operations
 *
 * Supports two formats:
 * 1. Object format: { field: value, field2: operations.increment('field2', 1) }
 * 2. Array format: [operations.replace('field', value), operations.increment('field2', 1)]
 */
function buildUpdateExpression(update: Record<string, unknown> | DynamoDBOperation[]): DynamoDBUpdateExpression {
  const setExpressions: string[] = [];
  const removeExpressions: string[] = [];
  const addExpressions: string[] = [];
  const expressionNames: Record<string, string> = {};
  const expressionValues: Record<string, unknown> = {};
  let valueIndex = 0;
  let nameIndex = 0;

  function processOperation(op: DynamoDBOperation): void {
    const nameKey = `#n${nameIndex++}`;
    expressionNames[nameKey] = op.path;

    switch (op._type) {
      case ADD_OP:
        {
          const valueKey = `:v${valueIndex++}`;
          expressionValues[valueKey] = (op as DynamoDBOperationAdd<unknown>).value;
          setExpressions.push(`${nameKey} = if_not_exists(${nameKey}, ${valueKey})`);
        }
        break;
      case REMOVE_OP:
        removeExpressions.push(nameKey);
        break;
      case REPLACE_OP:
        {
          const valueKey = `:v${valueIndex++}`;
          expressionValues[valueKey] = (op as DynamoDBOperationReplace<unknown>).value;
          setExpressions.push(`${nameKey} = ${valueKey}`);
        }
        break;
      case INCREMENT_OP:
        {
          const valueKey = `:v${valueIndex++}`;
          expressionValues[valueKey] = (op as DynamoDBOperationIncrement).by;
          setExpressions.push(`${nameKey} = ${nameKey} + ${valueKey}`);
        }
        break;
      case DECREMENT_OP:
        {
          const valueKey = `:v${valueIndex++}`;
          expressionValues[valueKey] = (op as DynamoDBOperationDecrement).by;
          setExpressions.push(`${nameKey} = ${nameKey} - ${valueKey}`);
        }
        break;
      case APPEND_OP:
        {
          const valueKey = `:v${valueIndex++}`;
          expressionValues[valueKey] = (op as DynamoDBOperationAppend<unknown>).values;
          setExpressions.push(`${nameKey} = list_append(${nameKey}, ${valueKey})`);
        }
        break;
      case PREPEND_OP:
        {
          const valueKey = `:v${valueIndex++}`;
          expressionValues[valueKey] = (op as DynamoDBOperationPrepend<unknown>).values;
          setExpressions.push(`${nameKey} = list_append(${valueKey}, ${nameKey})`);
        }
        break;
      case UPDATE_LIST_ITEM_OP:
        {
          const listOp = op as DynamoDBOperationUpdateListItem<unknown>;
          const valueKey = `:v${valueIndex++}`;
          expressionValues[valueKey] = listOp.value;
          setExpressions.push(`${nameKey}[${listOp.index}] = ${valueKey}`);
        }
        break;
    }
  }

  function processValue(path: string, value: unknown): void {
    if (isOperation(value)) {
      // Operation with path from object key (legacy format)
      // Create a copy with the path set
      const opWithPath = { ...value, path } as DynamoDBOperation;
      processOperation(opWithPath);
    } else {
      // Simple value assignment
      const nameKey = `#n${nameIndex++}`;
      expressionNames[nameKey] = path;
      const valueKey = `:v${valueIndex++}`;
      expressionValues[valueKey] = value;
      setExpressions.push(`${nameKey} = ${valueKey}`);
    }
  }

  // Handle array format (list of operations with paths)
  if (Array.isArray(update)) {
    for (const op of update) {
      if (isOperation(op)) {
        processOperation(op);
      }
    }
  } else {
    // Handle object format
    for (const [key, value] of Object.entries(update)) {
      processValue(key, value);
    }
  }

  const parts: string[] = [];
  if (setExpressions.length > 0) {
    parts.push(`SET ${setExpressions.join(', ')}`);
  }
  if (removeExpressions.length > 0) {
    parts.push(`REMOVE ${removeExpressions.join(', ')}`);
  }
  if (addExpressions.length > 0) {
    parts.push(`ADD ${addExpressions.join(', ')}`);
  }

  return {
    expression: parts.join(' '),
    expressionNames,
    expressionValues,
  };
}

// ============================================================================
// Public Helper Functions
// ============================================================================

/**
 * Build a GetItem request
 */
export function get<T = unknown>(payload: GetInput<T>): DynamoDBGetItemRequest {
  return {
    operation: 'GetItem',
    key: payload.key as DynamoDBKey,
    consistentRead: payload.consistentRead,
    projection: payload.projection,
  };
}

/**
 * Build a PutItem request
 */
export function put<T = unknown>(payload: PutInput<T>): DynamoDBPutItemRequest {
  const result: DynamoDBPutItemRequest = {
    operation: 'PutItem',
    key: payload.key as DynamoDBKey,
    attributeValues: payload.item as Record<string, unknown>,
  };

  if (payload.condition) {
    result.condition = buildExpression(payload.condition);
  }

  if (payload._version !== undefined) {
    result._version = payload._version;
  }

  return result;
}

/**
 * Build a DeleteItem request
 */
export function remove<T = unknown>(payload: RemoveInput<T>): DynamoDBDeleteItemRequest {
  const result: DynamoDBDeleteItemRequest = {
    operation: 'DeleteItem',
    key: payload.key as DynamoDBKey,
  };

  if (payload.condition) {
    result.condition = buildExpression(payload.condition);
  }

  if (payload._version !== undefined) {
    result._version = payload._version;
  }

  return result;
}

/**
 * Build an UpdateItem request
 */
export function update<T = unknown>(payload: UpdateInput<T>): DynamoDBUpdateItemRequest {
  const result: DynamoDBUpdateItemRequest = {
    operation: 'UpdateItem',
    key: payload.key as DynamoDBKey,
    update: buildUpdateExpression(payload.update as Record<string, unknown> | DynamoDBOperation[]),
  };

  if (payload.condition) {
    result.condition = buildExpression(payload.condition);
  }

  if (payload._version !== undefined) {
    result._version = payload._version;
  }

  return result;
}

/**
 * Build a Query request
 */
export function query<T = unknown>(payload: QueryInput<T>): DynamoDBQueryRequest {
  const result: DynamoDBQueryRequest = {
    operation: 'Query',
    query: buildKeyConditionExpression(payload.query),
  };

  if (payload.index) result.index = payload.index;
  if (payload.limit) result.limit = payload.limit;
  if (payload.nextToken) result.nextToken = payload.nextToken;
  if (payload.filter) result.filter = buildExpression(payload.filter);
  if (payload.consistentRead !== undefined) result.consistentRead = payload.consistentRead;
  if (payload.scanIndexForward !== undefined) result.scanIndexForward = payload.scanIndexForward;
  if (payload.select) result.select = payload.select;
  if (payload.projection) result.projection = payload.projection;

  return result;
}

/**
 * Build a Scan request
 */
export function scan<T = unknown>(payload: ScanInput<T> = {}): DynamoDBScanRequest {
  const result: DynamoDBScanRequest = {
    operation: 'Scan',
  };

  if (payload.index) result.index = payload.index;
  if (payload.limit) result.limit = payload.limit;
  if (payload.nextToken) result.nextToken = payload.nextToken;
  if (payload.filter) result.filter = buildExpression(payload.filter);
  if (payload.consistentRead !== undefined) result.consistentRead = payload.consistentRead;
  if (payload.select) result.select = payload.select;
  if (payload.projection) result.projection = payload.projection;
  if (payload.totalSegments !== undefined) result.totalSegments = payload.totalSegments;
  if (payload.segment !== undefined) result.segment = payload.segment;

  return result;
}

/**
 * Build a Sync request (for versioned tables)
 */
export function sync<T = unknown>(payload: SyncInput<T> = {}): DynamoDBSyncRequest {
  const result: DynamoDBSyncRequest = {
    operation: 'Sync',
  };

  if (payload.basePartitionKey) result.basePartitionKey = payload.basePartitionKey;
  if (payload.deltaIndexName) result.deltaIndexName = payload.deltaIndexName;
  if (payload.limit) result.limit = payload.limit;
  if (payload.nextToken) result.nextToken = payload.nextToken;
  if (payload.lastSync !== undefined) result.lastSync = payload.lastSync;
  if (payload.filter) result.filter = buildExpression(payload.filter);

  return result;
}

/**
 * Build a BatchGetItem request
 */
export function batchGet(payload: BatchGetInput): DynamoDBBatchGetItemRequest {
  return {
    operation: 'BatchGetItem',
    tables: payload.tables,
  };
}

/**
 * Build a BatchPutItem request
 */
export function batchPut<T = unknown>(payload: BatchPutInput<T>): DynamoDBBatchPutItemRequest {
  return {
    operation: 'BatchPutItem',
    tables: payload.tables as { [tableName: string]: Array<Record<string, unknown>> },
  };
}

/**
 * Build a BatchDeleteItem request
 */
export function batchDelete(payload: BatchDeleteInput): DynamoDBBatchDeleteItemRequest {
  return {
    operation: 'BatchDeleteItem',
    tables: payload.tables,
  };
}

/**
 * Build a TransactGetItems request
 */
export function transactGet(payload: TransactGetInput): DynamoDBTransactGetItemsRequest {
  return {
    operation: 'TransactGetItems',
    transactItems: payload.items,
  };
}

/**
 * Build a TransactWriteItems request
 */
export function transactWrite(payload: TransactWriteInput): DynamoDBTransactWriteItemsRequest {
  const transactItems: DynamoDBTransactWriteItemsRequest['transactItems'] = [];

  for (const item of payload.items) {
    if (item.putItem) {
      transactItems.push({
        table: item.putItem.table,
        operation: 'PutItem',
        key: item.putItem.key,
        attributeValues: item.putItem.item,
        condition: item.putItem.condition ? buildExpression(item.putItem.condition) : undefined,
      });
    } else if (item.updateItem) {
      transactItems.push({
        table: item.updateItem.table,
        operation: 'UpdateItem',
        key: item.updateItem.key,
        update: buildUpdateExpression(item.updateItem.update),
        condition: item.updateItem.condition ? buildExpression(item.updateItem.condition) : undefined,
      });
    } else if (item.deleteItem) {
      transactItems.push({
        table: item.deleteItem.table,
        operation: 'DeleteItem',
        key: item.deleteItem.key,
        condition: item.deleteItem.condition ? buildExpression(item.deleteItem.condition) : undefined,
      });
    } else if (item.conditionCheck) {
      transactItems.push({
        table: item.conditionCheck.table,
        operation: 'ConditionCheck',
        key: item.conditionCheck.key,
        condition: buildExpression(item.conditionCheck.condition),
      });
    }
  }

  return {
    operation: 'TransactWriteItems',
    transactItems,
  };
}

// ============================================================================
// Type Converters
// ============================================================================

export interface DynamoDBStringSetResult {
  SS: string[];
}

export interface DynamoDBNumberSetResult {
  NS: string[];
}

export interface DynamoDBBinarySetResult {
  BS: string[];
}

/**
 * Convert a list of strings to DynamoDB string set format
 */
export function toStringSet(list: string[]): DynamoDBStringSetResult {
  return { SS: list };
}

/**
 * Convert a list of numbers to DynamoDB number set format
 */
export function toNumberSet(numbers: number[]): DynamoDBNumberSetResult {
  return { NS: numbers.map((n) => n.toString()) };
}

/**
 * Convert base64 encoded strings to DynamoDB binary set format
 */
export function toBinarySet(values: string[]): DynamoDBBinarySetResult {
  return { BS: values };
}
