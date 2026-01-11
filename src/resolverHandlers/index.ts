import type { DataSource, Resolver, ResolverMap } from '../types/index.js';
import { createPipelineResolver } from './pipeline.js';
import { createUnitResolver } from './unit.js';

/** Build resolver map - supports Query, Mutation, Subscription and custom type field resolvers */
export async function buildResolverMap(resolvers: Resolver[], dataSources: DataSource[]): Promise<ResolverMap> {
  const map: ResolverMap = {};

  for (const r of resolvers) {
    const { type, field, kind } = r;

    // Initialize type if not exists (e.g., Query, Mutation, Task, User, etc.)
    if (!map[type]) {
      map[type] = {};
    }

    map[type][field] =
      kind === 'Unit' ? await createUnitResolver(r, dataSources) : await createPipelineResolver(r, dataSources);
  }

  return map;
}

export { createPipelineResolver } from './pipeline.js';
// Re-export for direct use
export { createUnitResolver } from './unit.js';
