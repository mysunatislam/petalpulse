// Lets Node run the app's TypeScript modules directly (node --experimental-strip-types),
// where imports leave out the .ts extension as Metro and Jest expect.
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (err?.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.')) throw err;
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      try { return await next(specifier + ext, context); } catch {}
    }
    throw err;
  }
}`),
  import.meta.url,
);
