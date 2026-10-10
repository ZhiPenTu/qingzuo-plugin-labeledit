import { readdir, lstat, open } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
if (process.platform === 'darwin') {
  async function signTree(folder) {
    for (const name of await readdir(folder)) {
      const filename = path.join(folder, name), info = await lstat(filename);
      if (info.isDirectory()) { await signTree(filename); continue; }
      if (!info.isFile() || info.size < 4) continue;
      const file = await open(filename, 'r'), magic = Buffer.alloc(4);
      try { await file.read(magic, 0, 4, 0); } finally { await file.close(); }
      if (['cffaedfe','cefaedfe','feedfacf','feedface','cafebabe','bebafeca','cafebabf'].includes(magic.toString('hex'))) execFileSync('codesign', ['--force', '--sign', '-', '--timestamp=none', filename], { stdio: 'pipe' });
    }
  }
  await signTree('release/plugin/backend');
}
