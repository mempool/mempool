import { rm } from 'fs/promises';
import fg from 'fast-glob';

async function clean() {
  const nodeFiles = await fg(['*.node', 'package-lock.json', 'index.js', 'index.d.ts']);
  
  for (const nodeFile of nodeFiles) {
    await rm(nodeFile, { force: true });
  }

  await rm('./target', { recursive: true, force: true });
  await rm('./node_modules', { recursive: true, force: true });
}

clean();