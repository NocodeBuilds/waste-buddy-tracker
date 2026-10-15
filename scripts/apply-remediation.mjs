import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
export function writeFiles(files) {
  const root = resolve(process.cwd());
  for (const [path, content] of Object.entries(files)) {
    const target = resolve(root, path);
    if (!target.startsWith(root + sep)) throw new Error('Path outside workspace');
    mkdirSync(dirname(target), {recursive: true});
    writeFileSync(target, content);
  }
}
