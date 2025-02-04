import { rm, cp, mkdir } from 'fs/promises';
import fg from 'fast-glob';
import path from 'path';

async function backend() {
  const to = '../../backend/rust-gbt';
  const files = await fg(['index.js', 'index.d.ts', 'package.json', '*.node']);

  await rm(to, { recursive: true, force: true });
  await mkdir(to, { recursive: true });

  for (const file of files) {
    await cp(file, path.join(to, file));

    console.log(`Copied to ${path.join(to, file)}`);
  }
}

backend();