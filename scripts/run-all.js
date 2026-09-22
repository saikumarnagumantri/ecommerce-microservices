#!/usr/bin/env node
/**
 * Runs one npm script (e.g. "build" or "test") across every package in
 * this repo, in order, and reports a pass/fail summary at the end. Used
 * by the root `build:all` / `test:all` scripts.
 *
 * Plain Node instead of a shell one-liner so this behaves identically on
 * Windows (cmd/PowerShell) and POSIX shells: no `&&` chaining, no
 * platform-specific quoting.
 *
 * Usage: node scripts/run-all.js <script-name> [--bail]
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const scriptName = process.argv[2];
const bail = process.argv.includes('--bail');

if (!scriptName) {
  console.error('Usage: node scripts/run-all.js <npm-script> [--bail]');
  process.exit(1);
}

// libs/common first: every service depends on its packed output.
const TARGETS = [
  'libs/common',
  'apps/products',
  'apps/inventory',
  'apps/cart',
  'apps/users',
  'apps/api-gateway',
  'apps/admin',
  'apps/product-image',
  'apps/orders',
];

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const results = [];

for (const target of TARGETS) {
  const dir = path.join(__dirname, '..', target);
  const pkgPath = path.join(dir, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    results.push({ target, status: 'skipped', reason: 'no package.json' });
    continue;
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (!pkg.scripts || !pkg.scripts[scriptName]) {
    results.push({ target, status: 'skipped', reason: `no "${scriptName}" script` });
    continue;
  }

  console.log(`\n=== ${scriptName}: ${target} ===`);
  const res = spawnSync(npmCmd, ['run', scriptName], { cwd: dir, stdio: 'inherit' });
  const ok = res.status === 0;
  results.push({ target, status: ok ? 'passed' : 'failed', code: res.status });

  if (!ok && bail) break;
}

console.log(`\n=== ${scriptName}:all summary ===`);
for (const r of results) {
  const label = r.status.toUpperCase().padEnd(7);
  const detail = r.reason ? ` (${r.reason})` : r.code != null ? ` (exit ${r.code})` : '';
  console.log(`${label} ${r.target}${detail}`);
}

const failed = results.filter((r) => r.status === 'failed');
if (failed.length > 0) {
  console.error(`\n${failed.length} package(s) failed "${scriptName}".`);
  process.exit(1);
}
console.log(`\nAll packages passed "${scriptName}".`);
