import { loadResolverModule } from '../imports.js';
import { createContext } from '../context.js';
import { executeDataSource } from '../datasourceHandlers/index.js';

/** Create unit resolver */
export async function createUnitResolver(docClient, resolver, dataSources) {
  return async (_p, args) => {
    const mod = await loadResolverModule(resolver.file);
    const ctx = createContext(args);

    const req = await mod.request(ctx);
    const dsResult = await executeDataSource(docClient, resolver.dataSource, dataSources, req);
    
    ctx.prev = { result: dsResult };
    return mod.response(ctx);
  };
}