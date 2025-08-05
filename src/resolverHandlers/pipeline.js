import { loadResolverModule } from '../imports.js';
import { createContext } from '../context.js';
import { executeDataSource } from '../datasourceHandlers/index.js';

/** Create pipeline resolver */
export async function createPipelineResolver(docClient, resolver, dataSources) {
  return async (_p, args) => {
    const ctx = createContext(args);
    let last;

    for (const fn of resolver.pipelineFunctions) {
      const mod = await loadResolverModule(fn.file);
      const req = await mod.request(ctx);
      const dsResult = await executeDataSource(docClient, fn.dataSource, dataSources, req);
      
      ctx.prev = { result: dsResult };
      last = await mod.response(ctx);
      ctx.prev = { result: last };
    }
    return last;
  };
}
