import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const checks = ['browser-check.mjs', ...(await fs.readdir('scripts')).filter(file => file.endsWith('-browser-check.mjs')).sort()];
const results = [];
for (const check of checks) {
  const start = Date.now();
  console.log(`\nRunning ${check}`);
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [`scripts/${check}`], { stdio: 'inherit', env: { ...process.env, VIEWER_URL: process.env.VIEWER_URL ?? 'http://127.0.0.1:5176/' } });
    child.on('error', reject);
    child.on('exit', code => resolve(code));
  });
  results.push({ check, passed: exitCode === 0, seconds: Math.round((Date.now() - start) / 1000) });
}
await fs.mkdir('validation', { recursive: true });
await fs.writeFile('validation/region-regression-check.json', JSON.stringify(results, null, 2));
console.log(`\n${results.filter(result => result.passed).length}/${results.length} browser checks passed`);
process.exitCode = results.every(result => result.passed) ? 0 : 1;
