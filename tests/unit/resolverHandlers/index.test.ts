import { describe, expect, it } from '@jest/globals';
import type { DataSource, PipelineFunction, PipelineResolver, UnitResolver } from '../../../src/types/index.js';

describe('buildResolverMap', () => {
  it('should create resolver map for unit resolvers', async () => {
    const { buildResolverMap } = await import('../../../src/resolverHandlers/index.js');

    const resolvers: UnitResolver[] = [
      {
        type: 'Query',
        field: 'echo',
        kind: 'Unit',
        dataSource: 'TestDS',
        file: 'examples/basic/resolvers/echo.js',
      },
    ];

    const dataSources: DataSource[] = [{ type: 'NONE', name: 'TestDS' }];

    const map = await buildResolverMap(resolvers, dataSources);

    expect(map).toBeDefined();
    expect(map.Query).toBeDefined();
    expect(map.Query.echo).toBeDefined();
    expect(typeof map.Query.echo).toBe('function');
  });

  it('should create resolver map for multiple types', async () => {
    const { buildResolverMap } = await import('../../../src/resolverHandlers/index.js');

    const resolvers: UnitResolver[] = [
      {
        type: 'Query',
        field: 'getUser',
        kind: 'Unit',
        dataSource: 'TestDS',
        file: 'examples/basic/resolvers/echo.js',
      },
      {
        type: 'Mutation',
        field: 'createUser',
        kind: 'Unit',
        dataSource: 'TestDS',
        file: 'examples/basic/resolvers/echo.js',
      },
    ];

    const dataSources: DataSource[] = [{ type: 'NONE', name: 'TestDS' }];

    const map = await buildResolverMap(resolvers, dataSources);

    expect(map.Query).toBeDefined();
    expect(map.Query.getUser).toBeDefined();
    expect(map.Mutation).toBeDefined();
    expect(map.Mutation.createUser).toBeDefined();
  });

  it('should create resolver map for pipeline resolvers', async () => {
    const { buildResolverMap } = await import('../../../src/resolverHandlers/index.js');

    const pipelineFunctions: PipelineFunction[] = [{ dataSource: 'TestDS', file: 'examples/basic/resolvers/echo.js' }];

    const resolvers: PipelineResolver[] = [
      {
        type: 'Query',
        field: 'pipelineQuery',
        kind: 'Pipeline',
        file: 'examples/basic/resolvers/echo.js',
        pipelineFunctions,
      },
    ];

    const dataSources: DataSource[] = [{ type: 'NONE', name: 'TestDS' }];

    const map = await buildResolverMap(resolvers, dataSources);

    expect(map.Query).toBeDefined();
    expect(map.Query.pipelineQuery).toBeDefined();
    expect(typeof map.Query.pipelineQuery).toBe('function');
  });

  it('should support custom type field resolvers', async () => {
    const { buildResolverMap } = await import('../../../src/resolverHandlers/index.js');

    const resolvers: UnitResolver[] = [
      {
        type: 'User',
        field: 'fullName',
        kind: 'Unit',
        dataSource: 'TestDS',
        file: 'examples/basic/resolvers/echo.js',
      },
      {
        type: 'Task',
        field: 'assignee',
        kind: 'Unit',
        dataSource: 'TestDS',
        file: 'examples/basic/resolvers/echo.js',
      },
    ];

    const dataSources: DataSource[] = [{ type: 'NONE', name: 'TestDS' }];

    const map = await buildResolverMap(resolvers, dataSources);

    expect(map.User).toBeDefined();
    expect(map.User.fullName).toBeDefined();
    expect(map.Task).toBeDefined();
    expect(map.Task.assignee).toBeDefined();
  });

  it('should handle empty resolver array', async () => {
    const { buildResolverMap } = await import('../../../src/resolverHandlers/index.js');

    const dataSources: DataSource[] = [{ type: 'NONE', name: 'TestDS' }];

    const map = await buildResolverMap([], dataSources);

    expect(map).toEqual({});
  });

  it('should initialize type namespace only once per type', async () => {
    const { buildResolverMap } = await import('../../../src/resolverHandlers/index.js');

    const resolvers: UnitResolver[] = [
      {
        type: 'Query',
        field: 'field1',
        kind: 'Unit',
        dataSource: 'TestDS',
        file: 'examples/basic/resolvers/echo.js',
      },
      {
        type: 'Query',
        field: 'field2',
        kind: 'Unit',
        dataSource: 'TestDS',
        file: 'examples/basic/resolvers/echo.js',
      },
      {
        type: 'Query',
        field: 'field3',
        kind: 'Unit',
        dataSource: 'TestDS',
        file: 'examples/basic/resolvers/echo.js',
      },
    ];

    const dataSources: DataSource[] = [{ type: 'NONE', name: 'TestDS' }];

    const map = await buildResolverMap(resolvers, dataSources);

    expect(Object.keys(map).length).toBe(1);
    expect(Object.keys(map.Query).length).toBe(3);
  });
});
