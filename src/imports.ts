import path from 'path';
import { pathToFileURL } from 'url';

/** Import ESM resolver modules */
export async function loadResolverModule<T = Record<string, unknown>>(relPath: string): Promise<T> {
  const abs = path.resolve(process.cwd(), relPath);
  return import(pathToFileURL(abs).href) as Promise<T>;
}
