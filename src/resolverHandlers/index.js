import { createPipelineResolver } from './pipeline.js';
import { createUnitResolver } from './unit.js';

/** Build resolver map */
export async function buildResolverMap(docClient, resolvers, dataSources) {
  const map = { Query: {}, Mutation: {}, Subscription: {} };

  for (const r of resolvers) {
    const { type, field, kind } = r;
    map[type][field] = kind === 'Unit' 
      ? await createUnitResolver(docClient, r, dataSources)
      : await createPipelineResolver(docClient, r, dataSources);
  }

  return map;
}
