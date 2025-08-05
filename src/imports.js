import { pathToFileURL } from 'url';
import path from 'path';

/** Import ESM resolver modules */
export async function loadResolverModule(relPath) {
  const abs = path.resolve(process.cwd(), relPath);
  return import(pathToFileURL(abs).href);
}
