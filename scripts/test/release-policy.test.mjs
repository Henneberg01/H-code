import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
function fixture(check) {
  const dir = mkdtempSync(join(tmpdir(), 'jfh-code-release-'));
  const files = ['LICENSE', 'NOTICE', 'LICENSING.md', 'TRADEMARKS.md', 'COMMERCIAL.md',
    'SECURITY.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'README.md',
    'JFH-CODE-PRINCIPLES.md', 'RELEASE_NOTES.md', 'docs/RELEASING.md',
    'compiler/Cargo.toml', 'compiler/package.json', 'package.json',
    'studio/server.mjs', 'studio/public/index.html', '.gitignore', 'scripts/release-check.mjs'];
  try {
    for (const file of files) {
      mkdirSync(dirname(join(dir, file)), {recursive: true});
      copyFileSync(join(root, file), join(dir, file));
    }
    check(dir, () => spawnSync(process.execPath, ['scripts/release-check.mjs'], {
      cwd: dir, encoding: 'utf8', timeout: 10000
    }));
  } finally { rmSync(dir, {recursive: true, force: true}); }
}

test('release checks accept the coherent JFH-CODE paid-use policy', () => fixture((dir, run) => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /JFH-CODE release checks PASS/);
}));

test('release checks accept Windows CRLF README checkouts', () => fixture((dir, run) => {
  const file = join(dir, 'README.md');
  writeFileSync(file, readFileSync(file, 'utf8').replaceAll('\r\n', '\n').replaceAll('\n', '\r\n'));
  const result = run();
  assert.equal(result.status, 0, result.stderr);
}));

test('release checks reject permissive or copyleft text as the current paid-only license', () => fixture((dir, run) => {
  for (const text of ['Apache License\nVersion 2.0\n', 'GNU AFFERO GENERAL PUBLIC LICENSE\nVersion 3\n']) {
    writeFileSync(join(dir, 'LICENSE'), text);
    const result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Commercial license required/);
  }
}));

test('release checks reject a package metadata license inconsistent with paid-only use', () => fixture((dir, run) => {
  const file = join(dir, 'package.json');
  const value = JSON.parse(readFileSync(file, 'utf8'));
  value.license = 'MIT';
  writeFileSync(file, JSON.stringify(value));
  assert.match(run().stderr, /package.json must use UNLICENSED/);
}));

test('release checks reject the former Studio product title', () => fixture((dir, run) => {
  const file = join(dir, 'studio/public/index.html');
  writeFileSync(file, readFileSync(file, 'utf8').replace('<title>JFH-CODE Studio</title>', '<title>H-Code Studio</title>'));
  assert.match(run().stderr, /Studio must use the JFH-CODE name/);
}));

test('release checks require the current licensing policy document', () => fixture((dir, run) => {
  rmSync(join(dir, 'LICENSING.md'));
  assert.match(run().stderr, /Missing LICENSING.md/);
}));
