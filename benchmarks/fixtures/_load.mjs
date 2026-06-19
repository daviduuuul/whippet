// Shared candidate loader for graders. Loads a candidate module whether the
// solution used ESM (`export`) or CommonJS (`module.exports`) — the module
// convention the task never specifies, so it must not be a scoring confound.
// ESM imports directly; a CJS file (which won't import() under a type:module
// package) is loaded via a throwaway `.cjs` copy required through createRequire.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

export async function loadCandidate(dir, relFile) {
  const abs = path.resolve(dir, relFile);
  try {
    return await import(pathToFileURL(abs).href);
  } catch (e) {
    // Only fall back for the "CJS syntax in an ESM scope" case; real bugs rethrow.
    if (!/\b(module|exports|require) is not defined\b/.test(String(e))) throw e;
    const tmp = abs.replace(/\.[mc]?js$/, '.__grader.cjs');
    fs.writeFileSync(tmp, fs.readFileSync(abs));
    try {
      return createRequire(import.meta.url)(tmp);
    } finally {
      try { fs.unlinkSync(tmp); } catch {}
    }
  }
}
