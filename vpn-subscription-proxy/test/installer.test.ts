import assert from 'node:assert/strict';
import {existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {loadConfig} from '../src/config.js';

// The deployment helper runs on Node 24 before npm install and uses only core modules.
const libraryUrl = new URL('../deploy/setup-lib.mjs', import.meta.url);
const {DEFAULTS, parseEnvironment, serializeEnvironment, validatePath, validateLayout, renderInstallationDropIn, executeDeployment, sanitizedChildEnvironment, atomicWrite, restoreFileSnapshots, copyClosedState, serviceFlags, assertNoSymlinks} = await import(libraryUrl.href);
const setupUrl = new URL('../deploy/setup.mjs', import.meta.url);
const {previousService} = await import(setupUrl.href);

const commandResult = (output = '', status: number | null = 0, errorOutput = '', executionError?: string) =>
  ({success: status === 0 && !executionError, status, output, errorOutput, executionError});

function systemdFixture(files = commandResult(), loaded = commandResult(), states: Record<string, {active: string; enabled: string}> = {}) {
  const calls: string[][] = [];
  const execute = (command: string, args: string[], options: {capture?: boolean; allowFailure?: boolean} = {}) => {
    assert.equal(command, 'systemctl');
    assert.equal(options.capture, true);
    calls.push(args);
    let result;
    switch (args[0]) {
      case 'list-unit-files':
        assert.ok(args.includes('dragonet-subscription-proxy@*.service'));
        result = files; break;
      case 'list-units':
        assert.ok(args.includes('dragonet-subscription-proxy@*.service'));
        result = loaded; break;
      case 'show': result = commandResult(states[args.at(-1)!]?.active ?? 'inactive'); break;
      case 'is-enabled': {
        const state = states[args.at(-1)!]?.enabled ?? 'disabled';
        result = commandResult(state, state === 'disabled' ? 1 : 0); break;
      }
      default: throw new Error(`Unexpected systemctl operation: ${args[0]}`);
    }
    if (!result.success && !options.allowFailure) throw new Error(`systemctl ${args[0]}: ${result.errorOutput}`);
    return result;
  };
  return {execute, calls};
}

const temporaryDirectory = (t: import('node:test').TestContext) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'dragonet-installer-test-'));
  t.after(() => {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
    assert.ok(path.basename(resolved).startsWith('dragonet-installer-test-'));
    rmSync(resolved, {recursive: true, force: true});
  });
  return directory;
};

test('oneshot/static units are not treated as boot-enabled; activating services and runtime enables are preserved', () => {
  assert.deepEqual(serviceFlags('inactive', 'static'), {active: false, enabled: false, runtime: false});
  assert.deepEqual(serviceFlags('activating', 'enabled-runtime'), {active: true, enabled: true, runtime: true});
  assert.deepEqual(serviceFlags('active', 'enabled'), {active: true, enabled: true, runtime: false});
});

test('fresh installation and retries accept empty unit-file lists on systemd 247 and newer versions', () => {
  // v247 list-unit-files returns ENOENT/exit 1 without stdout or stderr for no matches.
  for (const status of [1, 0]) {
    const fixture = systemdFixture(commandResult('', status));
    for (let attempt = 0; attempt < 2; attempt++) assert.equal(previousService({}, fixture.execute), undefined);
    assert.deepEqual(fixture.calls.map(args => args[0]), ['list-unit-files', 'list-units', 'list-unit-files', 'list-units']);
  }
});

test('discovery finds an active instance even when it only appears in loaded units', () => {
  const unit = 'dragonet-subscription-proxy@proxy.example.com.service';
  const fixture = systemdFixture(commandResult('', 1), commandResult(`${unit} loaded active running Proxy`),
    {[unit]: {active: 'active', enabled: 'disabled'}});
  assert.equal(previousService({}, fixture.execute), unit);
});

test('discovery deduplicates installed/loaded instances and preserves a saved inactive instance', () => {
  const unit = 'dragonet-subscription-proxy@proxy.example.com.service';
  const fixture = systemdFixture(commandResult(`${unit} enabled enabled\ndragonet-subscription-proxy@.service disabled enabled`),
    commandResult(`${unit} loaded inactive dead Proxy`), {[unit]: {active: 'inactive', enabled: 'enabled'}});
  assert.equal(previousService({}, fixture.execute), unit);
  assert.equal(fixture.calls.filter(args => args[0] === 'show').length, 1);
  assert.equal(previousService({service: unit}, systemdFixture(commandResult('', 1)).execute), unit);
});

test('discovery still refuses multiple running/enabled instances and invalid saved service names', () => {
  const first = 'dragonet-subscription-proxy@one.example.com.service';
  const second = 'dragonet-subscription-proxy@two.example.com.service';
  const fixture = systemdFixture(commandResult(`${first} enabled enabled\n${second} enabled enabled`), commandResult(),
    {[first]: {active: 'active', enabled: 'enabled'}, [second]: {active: 'inactive', enabled: 'enabled'}});
  assert.throws(() => previousService({}, fixture.execute), /несколько/);
  const unused = systemdFixture();
  assert.throws(() => previousService({service: 'unrelated.service'}, unused.execute), /Некорректный service/);
  assert.equal(unused.calls.length, 0);
});

test('empty-list handling does not swallow systemd diagnostics, unexpected output, exec errors or timeouts', () => {
  const failures = [commandResult('', 1, 'Failed to connect to bus: Permission denied'), commandResult('unexpected output', 1),
    commandResult('', 2), commandResult('', null, '', 'ETIMEDOUT'), commandResult('', 1, '', 'ENOENT')];
  for (const failure of failures) {
    const fixture = systemdFixture(failure);
    assert.throws(() => previousService({}, fixture.execute), error => error instanceof Error
      && error.message.includes('systemctl list-unit-files')
      && (!failure.errorOutput || error.message.includes(failure.errorOutput)));
    assert.equal(fixture.calls.length, 1);
  }
  assert.throws(() => previousService({}, systemdFixture(commandResult('', 1), commandResult('', 1, 'Failed to list units')).execute), /Failed to list units/);
});

test('path validation rejects symlink/junction ancestors while accepting missing paths for a fresh install', t => {
  const directory = temporaryDirectory(t);
  assertNoSymlinks(path.join(directory, 'not-created', 'config.env'));
  const target = path.join(directory, 'target'), link = path.join(directory, 'link');
  mkdirSync(target);
  symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => assertNoSymlinks(path.join(link, 'config.env')), /Symlink/);
});

test('rollback restores prior env/unit contents and modes while removing newly created files', t => {
  const directory = temporaryDirectory(t);
  const env = path.join(directory, 'config.env');
  const unit = path.join(directory, 'proxy.service');
  const snapshots = new Map([[env, {content: Buffer.from('OLD=preserved\n'), mode: 0o600}], [unit, undefined]]);
  atomicWrite(env, 'NEW=secret\n', 0o600); atomicWrite(unit, '[Service]\n', 0o644);
  restoreFileSnapshots(snapshots);
  assert.equal(readFileSync(env, 'utf8'), 'OLD=preserved\n');
  assert.equal(existsSync(unit), false);
  if (process.platform !== 'win32') assert.equal(statSync(env).mode & 0o777, 0o600);
});

test('an interrupted atomic write leaves the old env intact and removes its temporary file for a retry', t => {
  const directory = temporaryDirectory(t);
  const filename = path.join(directory, 'config.env');
  writeFileSync(filename, 'OLD=preserved');
  assert.throws(() => atomicWrite(filename, {invalidWritePayload: true}, 0o600));
  assert.equal(readFileSync(filename, 'utf8'), 'OLD=preserved');
  assert.equal(existsSync(`${filename}.installer-${process.pid}`), false);
  atomicWrite(filename, 'NEW=valid', 0o600);
  assert.equal(readFileSync(filename, 'utf8'), 'NEW=valid');
});

test('failed first installation retains its generated HMAC/env so a retry can open existing SQLite', t => {
  const directory = temporaryDirectory(t);
  const env = path.join(directory, 'config.env');
  const metadata = path.join(directory, 'installation.json');
  const value = serializeEnvironment({DEMO_COOLDOWN_HMAC_KEY: 'generated-fixture-key'});
  atomicWrite(env, value, 0o600); atomicWrite(metadata, '{}', 0o600);
  restoreFileSnapshots(new Map([[env, undefined], [metadata, undefined]]), new Set([env]));
  assert.equal(parseEnvironment(readFileSync(env, 'utf8')).DEMO_COOLDOWN_HMAC_KEY, 'generated-fixture-key');
  assert.equal(existsSync(metadata), false);
});

test('closed state migration and rollback copy current SQLite and remove stale destination WAL/SHM', t => {
  const directory = temporaryDirectory(t);
  const oldState = path.join(directory, 'old'); const newState = path.join(directory, 'new');
  mkdirSync(oldState); mkdirSync(newState);
  writeFileSync(path.join(oldState, 'demo-cooldowns.sqlite'), 'old-db');
  writeFileSync(path.join(oldState, 'demo-cooldowns.sqlite-wal'), 'old-wal');
  copyClosedState(oldState, newState);
  assert.equal(readFileSync(path.join(newState, 'demo-cooldowns.sqlite-wal'), 'utf8'), 'old-wal');
  writeFileSync(path.join(newState, 'demo-cooldowns.sqlite'), 'current-db-with-new-demo');
  rmSync(path.join(newState, 'demo-cooldowns.sqlite-wal'));
  writeFileSync(path.join(oldState, 'demo-cooldowns.sqlite-shm'), 'stale-shm');
  copyClosedState(newState, oldState);
  assert.equal(readFileSync(path.join(oldState, 'demo-cooldowns.sqlite'), 'utf8'), 'current-db-with-new-demo');
  assert.equal(existsSync(path.join(oldState, 'demo-cooldowns.sqlite-wal')), false);
  assert.equal(existsSync(path.join(oldState, 'demo-cooldowns.sqlite-shm')), false);
});

test('installer preserves existing env values and unknown fields without evaluating shell text', () => {
  const parsed = parseEnvironment('# heading\r\nVPN_PANEL_TOKEN=literal-$(touch /tmp/never-run)\r\nSTATE_DIRECTORY=/var/lib/proxy\r\nCUSTOM=value\r\n');
  assert.equal(parsed.VPN_PANEL_TOKEN, 'literal-$(touch /tmp/never-run)');
  assert.equal(parsed.CUSTOM, 'value');
  const values = {...DEFAULTS, ...parsed};
  const restored = parseEnvironment(serializeEnvironment(values));
  assert.equal(restored.VPN_PANEL_TOKEN, parsed.VPN_PANEL_TOKEN);
  assert.equal(restored.STATE_DIRECTORY, '/var/lib/proxy');
  assert.equal(restored.CUSTOM, 'value');
  assert.equal(restored.PROXY_LISTEN_PORT, '8443');
});

test('EnvironmentFile round-trip preserves quotes, hashes, dollar/backtick/backslash, spaces and multiline unknown values', () => {
  const values = {TOKEN: `a#'"\\$HOME\`literal\` trailing `, OTHER: 'first\nsecond', EMPTY: ''};
  assert.deepEqual({...parseEnvironment(serializeEnvironment(values))}, values);
  assert.equal(parseEnvironment("TOKEN='literal $HOME # backslash \\'\n").TOKEN, 'literal $HOME # backslash \\');
  assert.equal(parseEnvironment('TOKEN="a\\\nb"\n').TOKEN, 'ab');
  assert.equal(parseEnvironment('TOKEN=a\\\nb\n').TOKEN, 'ab');
  assert.equal(parseEnvironment('TOKEN=one\nTOKEN=two\n').TOKEN, 'two');
});

test('invalid env reports only line/field information, never a secret value', () => {
  for (const raw of ['TOKEN="private-secret', 'TOKEN="private-secret" executable', 'export TOKEN=private-secret']) {
    assert.throws(() => parseEnvironment(raw), error => error instanceof Error && !error.message.includes('private-secret'));
  }
  assert.throws(() => serializeEnvironment({'X\nTOKEN': 'private-secret'}));
  assert.equal(Object.hasOwn(parseEnvironment('__proto__=literal\n'), '__proto__'), true);
});

const layout = {installDir: '/opt/vpn-subscription-proxy', envFile: '/etc/dragonet-subscription-proxy.env', stateDir: '/var/lib/dragonet-subscription-proxy', backupRoot: '/var/backups/dragonet-subscription-proxy'};
test('installer supports distinct custom code/env/state paths and rejects overlaps and system roots', () => {
  validateLayout(layout);
  validateLayout({...layout, installDir: '/srv/proxy', envFile: '/etc/proxy/config.env', stateDir: '/srv/proxy-data'});
  for (const value of ['/', '/root/cert', '/opt', '/var/lib', '/opt/proxy/../other', '/opt//proxy', '/opt/my proxy', '/tmp/release']) assert.throws(() => validatePath(value));
  assert.throws(() => validateLayout({...layout, envFile: '/opt/vpn-subscription-proxy/.env'}));
  assert.throws(() => validateLayout({...layout, stateDir: '/etc/ssh'}));
  assert.throws(() => validateLayout({...layout, stateDir: layout.backupRoot + '/db'}));
});

test('systemd installation drop-in selects only the chosen credential source and custom paths', () => {
  const sui = renderInstallationDropIn({...layout, certificate: {source: 's-ui', name: 'proxy.example.com'}});
  assert.ok(sui.includes('LoadCredential=\nLoadCredential=fullchain.pem:/root/cert/proxy.example.com/fullchain.pem'));
  assert.ok(sui.includes('LoadCredential=privkey.pem:/root/cert/proxy.example.com/privkey.pem'));
  assert.ok(!sui.includes('/etc/letsencrypt'));
  assert.ok(!sui.includes('LoadCredential=fullchain.pem:"'));
  assert.ok(sui.includes('EnvironmentFile=\nEnvironmentFile=/etc/dragonet-subscription-proxy.env'));
  assert.ok(sui.includes('StateDirectory=\nReadWritePaths=\nReadWritePaths=/var/lib/dragonet-subscription-proxy'));
  const le = renderInstallationDropIn({...layout, certificate: {source: 'letsencrypt', name: 'proxy.example.com-0001'}});
  assert.ok(le.includes('/etc/letsencrypt/live/proxy.example.com-0001/privkey.pem'));
  assert.ok(!le.includes('/root/cert'));
  assert.throws(() => renderInstallationDropIn({...layout, certificate: {source: 's-ui', name: '../escape'}}));
});

test('deployment builds and tests before downtime, backs up after stop, and verifies after start', async () => {
  const events: string[] = [];
  const operations = Object.fromEntries(['prepare', 'stop', 'backup', 'activate', 'start', 'verify', 'rollback'].map(name => [name, async () => {events.push(name);} ]));
  await executeDeployment(operations);
  assert.deepEqual(events, ['prepare', 'stop', 'backup', 'activate', 'start', 'verify']);
});

for (const failure of ['prepare', 'stop', 'backup', 'activate', 'start', 'verify']) {
  test(`deployment recovers safely from a ${failure} failure without rolling back SQLite`, async () => {
    const events: string[] = [];
    const operations = Object.fromEntries(['prepare', 'stop', 'backup', 'activate', 'start', 'verify', 'rollback'].map(name => [name, async () => {
      events.push(name);
      if (name === failure) throw new Error('controlled failure');
    }]));
    await assert.rejects(executeDeployment(operations), /controlled failure/);
    assert.equal(events.includes('rollback'), failure !== 'prepare');
    if (failure !== 'prepare') assert.equal(events.at(-1), 'rollback');
    assert.equal(events.includes('restoreDatabase'), false);
  });
}

test('failed rollback is explicitly reported instead of claiming a working previous service', async () => {
  const noop = async () => undefined;
  await assert.rejects(executeDeployment({prepare: noop, stop: noop, backup: noop, activate: noop, start: noop,
    verify: async () => {throw new Error('health failure');}, rollback: async () => {throw new Error('restore failure');}}), /health failure.*откат не завершён/);
});

test('npm/tests do not inherit production secrets, state, credentials or Node injection options', () => {
  const env = sanitizedChildEnvironment({PATH: '/usr/bin', VPN_PANEL_TOKEN: 'private-secret', STATE_DIRECTORY: '/var/lib/live', CREDENTIALS_DIRECTORY: '/run/credentials/live', NODE_OPTIONS: '--require=secret', NODE_ENV: 'production', NPM_CONFIG_OMIT: 'dev'});
  assert.deepEqual(env, {PATH: '/usr/bin', NODE_ENV: 'development'});
});

test('optional PROXY_PUBLIC_HOST keeps old env compatible and validates the selected hostname', () => {
  const env = {...DEFAULTS, VPN_PANEL_BASE_URL: 'https://panel.example.com/hidden', VPN_PANEL_TOKEN: 'fixture', DEMO_COOLDOWN_HMAC_KEY: 'a'.repeat(64)};
  assert.equal(loadConfig(env).publicHostname, undefined);
  assert.equal(loadConfig({...env, PROXY_PUBLIC_HOST: 'Proxy.Example.com'}).publicHostname, 'proxy.example.com');
  for (const hostname of ['*.example.com', '127.0.0.1', 'proxy.example.com/route']) assert.throws(() => loadConfig({...env, PROXY_PUBLIC_HOST: hostname}));
});

test('config accepts HTTPS panel paths and rejects malformed/unsupported URLs without exposing their values', () => {
  const env = {...DEFAULTS, VPN_PANEL_TOKEN: 'fixture', DEMO_COOLDOWN_HMAC_KEY: 'a'.repeat(64)};
  assert.equal(loadConfig({...env, VPN_PANEL_BASE_URL: 'https://panel.example.com/hidden/'}).panelBaseUrl, 'https://panel.example.com/hidden');
  for (const url of ['private-secret', 'http://panel.example.com/private-secret', 'https://private-secret@panel.example.com',
    'https://panel.example.com/?token=private-secret', 'https://panel.example.com/#private-secret']) {
    assert.throws(() => loadConfig({...env, VPN_PANEL_BASE_URL: url}), {message: 'Invalid VPN_PANEL_BASE_URL'});
  }
});

test('config validates parsed inbound JSON separately and still deduplicates valid positive IDs', () => {
  const env = {...DEFAULTS, VPN_PANEL_BASE_URL: 'https://panel.example.com/hidden', VPN_PANEL_TOKEN: 'fixture', DEMO_COOLDOWN_HMAC_KEY: 'a'.repeat(64)};
  assert.deepEqual(loadConfig({...env, VPN_DEMO_INBOUNDS: '[12,13,12]'}).demoInbounds, [12, 13]);
  for (const raw of ['private-secret', 'null', '{}', '[]', '[0]', '[-1]', '[1.5]', '["12"]']) {
    assert.throws(() => loadConfig({...env, VPN_DEMO_INBOUNDS: raw}), {message: 'Invalid VPN_DEMO_INBOUNDS'});
  }
});

test('Linux bootstrap has LF and its help prints attribution/colors without installing anything', t => {
  const filename = fileURLToPath(new URL('../deploy/install.sh', import.meta.url));
  const content = readFileSync(filename, 'utf8');
  assert.equal(content.includes('\r'), false);
  const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
  if (!existsSync(bash)) { t.skip('Bash unavailable'); return; }
  const result = spawnSync(bash, ['--noprofile', '--norc', filename.replace(/\\/g, '/'), '--help'], {encoding: 'utf8', env: {...process.env, BASH_ENV: '', ENV: ''}});
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('\x1b[32mDragonSavA\x1b[0m'));
  assert.ok(result.stdout.replace(/\x1b\[[0-9;]*m/g, '').includes('Developed by DragonSavA with Codex'));
  assert.ok(!result.stdout.includes('[1/8]'));
});
