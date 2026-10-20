import assert from 'node:assert/strict';
import {spawnSync, type SpawnSyncOptions} from 'node:child_process';
import {copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const moduleUrl = new URL('../deploy/sqlite-native.mjs', import.meta.url);
const {ensureSQLite} = await import(moduleUrl.href);
const project = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const installedPackage = path.dirname(require.resolve('better-sqlite3/package.json'));
const {getPrebuildPath} = require(path.join(installedPackage, 'lib', 'binding.js'));
const nativeBinary = getPrebuildPath() ?? path.join(installedPackage, 'build', 'Release', 'better_sqlite3.node');
const linuxMusl = process.platform === 'linux'
  && !(process.report.getReport() as {header: {glibcVersionRuntime?: string}}).header.glibcVersionRuntime;
const target = linuxMusl ? 'linuxmusl' : process.platform;

function fixture(t: import('node:test').TestContext, withGyp = true) {
  const directory = mkdtempSync(path.join(tmpdir(), 'dragonet-native-test-'));
  t.after(() => {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
    assert.ok(path.basename(resolved).startsWith('dragonet-native-test-'));
    rmSync(resolved, {recursive: true, force: true});
  });
  const sqlite = path.join(directory, 'node_modules', 'better-sqlite3');
  mkdirSync(path.join(sqlite, 'prebuilds'), {recursive: true});
  // Use the installed loader unchanged, with an intentionally invalid native file.
  // This catches accidentally continuing to prefer prebuilds after a local build.
  cpSync(path.join(installedPackage, 'lib'), path.join(sqlite, 'lib'), {recursive: true});
  copyFileSync(path.join(installedPackage, 'package.json'), path.join(sqlite, 'package.json'));
  writeFileSync(path.join(directory, 'package.json'), '{"name":"vpn-subscription-proxy","type":"module"}');
  const broken = path.join(sqlite, 'prebuilds', `${target}-${process.arch}.node`);
  writeFileSync(broken, 'incompatible-vendor-binary');
  const state = path.join(directory, 'live-state.sqlite');
  writeFileSync(state, 'must-not-be-opened-or-modified');
  const gyp = path.join(directory, 'node_modules', 'node-gyp', 'bin', 'node-gyp.js');
  if (withGyp) {mkdirSync(path.dirname(gyp), {recursive: true}); writeFileSync(gyp, '// compiler stub');}
  return {directory, sqlite, broken, state, gyp};
}

function simulatedCompiler(candidate: ReturnType<typeof fixture>, {failBuild = false, writeBinary = true, glibcFailure = false} = {}) {
  let builds = 0;
  let probes = 0;
  const execute = (command: string, args: string[], options: SpawnSyncOptions) => {
    assert.equal(options.env?.VPN_PANEL_TOKEN, undefined);
    assert.equal(options.env?.STATE_DIRECTORY, undefined);
    assert.equal(options.env?.NODE_OPTIONS, undefined);
    if (args[0] === candidate.gyp) {
      builds++;
      assert.equal(existsSync(path.join(candidate.sqlite, 'prebuilds')), false);
      assert.equal(options.cwd, candidate.sqlite);
      assert.ok(args.includes('--force_build=1'));
      assert.ok(args.includes('--jobs=1'));
      if (failBuild) return {status: 1};
      if (writeBinary) {
        const release = path.join(candidate.sqlite, 'build', 'Release');
        mkdirSync(release, {recursive: true});
        // Simulate compilation without running any compiler: use the working host addon.
        copyFileSync(nativeBinary, path.join(release, 'better_sqlite3.node'));
      }
      return {status: 0};
    }
    assert.equal(args.at(-1), '--probe');
    probes++;
    if (glibcFailure && probes === 1) return {status: 1, stdout: JSON.stringify({ok: false, code: 'ERR_DLOPEN_FAILED',
      message: '/lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.33\' not found'})};
    return spawnSync(command, args, {...options, encoding: 'utf8'});
  };
  return {execute, builds: () => builds, probes: () => probes};
}

test('a usable native SQLite is probed in a fresh process and never rebuilt', () => {
  let probes = 0;
  const report = ensureSQLite(project, {log: () => {}, execute: (command: string, args: string[], options: SpawnSyncOptions) => {
    assert.equal(args.at(-1), '--probe'); probes++;
    return spawnSync(command, args, {...options, encoding: 'utf8'});
  }});
  assert.equal(report.ok, true);
  assert.match(report.version, /^\d+\.\d+/);
  assert.equal(probes, 1);
});

test('an incompatible vendor addon is quarantined and default loading uses the rebuilt addon, also without dev tools', t => {
  const candidate = fixture(t);
  const compiler = simulatedCompiler(candidate);
  const messages: string[] = [];
  const env = {...process.env, VPN_PANEL_TOKEN: 'private-fixture-token', STATE_DIRECTORY: candidate.state, NODE_OPTIONS: '--invalid-fixture-option'};
  assert.equal(ensureSQLite(candidate.directory, {execute: compiler.execute, log: (text: string) => messages.push(text), env}).ok, true);
  assert.equal(compiler.builds(), 1);
  assert.equal(compiler.probes(), 2);
  assert.equal(existsSync(candidate.broken), false);
  const disabled = readdirSync(candidate.sqlite).find(name => name.startsWith('prebuilds.disabled-'))!;
  assert.equal(readFileSync(path.join(candidate.sqlite, disabled, path.basename(candidate.broken)), 'utf8'), 'incompatible-vendor-binary');
  assert.equal(readFileSync(candidate.state, 'utf8'), 'must-not-be-opened-or-modified');
  assert.ok(messages.every(text => !text.includes('private-fixture-token')));
  unlinkSync(candidate.gyp); // Equivalent to removing the dev tool after preparation.
  assert.equal(ensureSQLite(candidate.directory, {execute: compiler.execute, repair: false, log: () => {}}).ok, true);
  assert.equal(compiler.builds(), 1);
});

test('the reported GLIBC_2.33/ERR_DLOPEN_FAILED combination triggers the same local-source fallback', t => {
  const candidate = fixture(t);
  const compiler = simulatedCompiler(candidate, {glibcFailure: true});
  assert.equal(ensureSQLite(candidate.directory, {execute: compiler.execute, log: () => {}}).ok, true);
  assert.equal(compiler.builds(), 1);
});

test('a failed compiler stops preparation and a retry succeeds with prebuilds already disabled', t => {
  const candidate = fixture(t);
  const failure = simulatedCompiler(candidate, {failBuild: true});
  assert.throws(() => ensureSQLite(candidate.directory, {execute: failure.execute, log: () => {}}), /Не удалось собрать SQLite/);
  const retry = simulatedCompiler(candidate);
  assert.equal(ensureSQLite(candidate.directory, {execute: retry.execute, log: () => {}}).ok, true);
  assert.equal(retry.builds(), 1);
  assert.equal(readFileSync(candidate.state, 'utf8'), 'must-not-be-opened-or-modified');
});

test('check-only mode reports incompatible native binaries without modifying files or invoking a compiler', t => {
  const candidate = fixture(t, false);
  const compiler = simulatedCompiler(candidate);
  assert.throws(() => ensureSQLite(candidate.directory, {execute: compiler.execute, repair: false, log: () => {}}), /SQLite не прошла проверку/);
  assert.equal(compiler.builds(), 0);
  assert.equal(existsSync(candidate.broken), true);
});

test('missing build tools produce an actionable error before vendor files are changed', t => {
  const candidate = fixture(t, false);
  const compiler = simulatedCompiler(candidate);
  assert.throws(() => ensureSQLite(candidate.directory, {execute: compiler.execute, log: () => {}}), /npm ci --include=dev/);
  assert.equal(compiler.builds(), 0);
  assert.equal(existsSync(candidate.broken), true);
});

test('unexpected probe errors, malformed reports and timeouts are not mistaken for a native load failure', t => {
  const candidate = fixture(t);
  for (const response of [{status: 1, stdout: JSON.stringify({ok: false, code: 'SQLITE_ERROR', message: 'unexpected SQL failure'})},
    {status: 1, stdout: 'invalid report'}, {status: null, error: {code: 'ETIMEDOUT'}}]) {
    let calls = 0;
    assert.throws(() => ensureSQLite(candidate.directory, {execute: () => {calls++; return response;}, log: () => {}}));
    assert.equal(calls, 1);
    assert.equal(existsSync(candidate.broken), true);
  }
});

test('successful compiler exit is insufficient: the resulting native database must pass a fresh-process probe', t => {
  const candidate = fixture(t);
  const compiler = simulatedCompiler(candidate, {writeBinary: false});
  assert.throws(() => ensureSQLite(candidate.directory, {execute: compiler.execute, log: () => {}}), /Собранная SQLite не загружается/);
  assert.equal(compiler.builds(), 1);
  assert.equal(compiler.probes(), 2);
});
